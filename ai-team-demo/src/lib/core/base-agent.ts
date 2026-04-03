import { z } from 'zod'

import { AgentRole, AgentResponse, AgentContext, Task, AgentConfig } from './types'
import { generateId } from '../utils/id'
import { extractJSONObject } from '../utils/json-parser'
import { getLLMProvider } from '../llm/factory'
import { createLogger } from './logger'

export type ParseResultSuccess<T> = { success: true; data: T }
export type ParseResultFailure = { success: false; error: string; raw: unknown }
export type ParseResult<T> = ParseResultSuccess<T> | ParseResultFailure

declare global {
   
  var sessions_spawn: ((opts: {
    runtime?: string;
    agentId?: string;
    task: string;
    thinking?: string;
    mode?: string;
    model?: string;
    cwd?: string;
  }) => Promise<unknown>) | undefined;
   
  var sessions_history: ((opts: {
    sessionKey: string;
  }) => Promise<{ messages?: Array<{ content?: string }> }>) | undefined;
}

export abstract class BaseAgent {
  readonly id: string
  readonly name: string
  readonly role: AgentRole
  readonly description: string
  private readonly logger = createLogger('agent')

  constructor(id: string, name: string, role: AgentRole, description: string) {
    this.id = id
    this.name = name
    this.role = role
    this.description = description
  }

  abstract execute(task: Task, context: AgentContext): Promise<AgentResponse>

  protected generateTaskId(): string {
    return generateId('task_')
  }

  protected log(message: string): void {
    this.logger.info(message, { agent: this.name })
  }

  protected getLLM() {
    return getLLMProvider()
  }

  protected async callLLM(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string | null> {
    const llm = this.getLLM()
    if (!llm) return null

    return llm.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  }

  protected parseJSONResponse<T>(response: string, schema: z.ZodType<T>): ParseResult<T>
  protected parseJSONResponse<T>(response: string): T | null
  protected parseJSONResponse<T>(response: string, schema?: z.ZodType<T>): ParseResult<T> | T | null {
    const raw = extractJSONObject(response)

    if (!schema) {
      if (!raw) return null
      return raw as T
    }

    if (!raw) {
      return { success: false, error: 'No JSON object found in response', raw: response }
    }

    const validated = schema.safeParse(raw)
    if (validated.success) {
      return { success: true, data: validated.data }
    }

    const errorMessages = validated.error.issues
      .map((issue) =>
        `${issue.path.join('.')}: ${issue.message}`
      )
      .join('; ')

    return { success: false, error: errorMessages, raw }
  }

  protected async executeWithLLMFallback<T extends AgentResponse>(
    task: Task,
    context: AgentContext,
    llmHandler: (response: string) => T,
    fallbackHandler: () => Promise<T>,
    systemPrompt: string,
    userPromptBuilder: (task: Task, context: AgentContext) => string,
  ): Promise<T> {
    const llm = this.getLLM()

    if (llm) {
      try {
        const userPrompt = userPromptBuilder(task, context)
        const response = await this.callLLM(systemPrompt, userPrompt)
        if (response) {
          return llmHandler(response)
        }
      } catch (error) {
        this.log(`LLM 调用失败，回退到规则系统: ${error}`)
      }
    }

    return fallbackHandler()
  }

  protected buildTaskPrompt(task: Task): string {
    return `任务：${task.title}\n描述：${task.description}`
  }

  protected toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '')
  }

  protected toKebabCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }
}

export abstract class BaseOpenClawAgent<TConfig extends AgentConfig = AgentConfig> {
  readonly role: AgentRole
  protected config: TConfig
  private readonly logger = createLogger('openclaw-agent')

  constructor(role: AgentRole, config: TConfig) {
    this.role = role
    this.config = config
  }

  protected abstract buildPrompt(...args: unknown[]): string
  protected abstract getDefaultResult(): unknown

  protected async spawnAgent(task: string, options?: {
    runtime?: 'subagent' | 'acp'
    agentId?: string
    cwd?: string
  }): Promise<unknown> {
    if (typeof globalThis.sessions_spawn !== 'function') {
      throw new Error('OpenClaw sessions_spawn not available')
    }

    return await globalThis.sessions_spawn({
      runtime: options?.runtime || 'subagent',
      agentId: options?.agentId,
      task,
      thinking: this.config.thinking || 'high',
      mode: 'run',
      model: this.config.model,
      cwd: options?.cwd,
    })
  }

  protected async parseJSONFromSession<T>(
    session: { sessionKey?: string } | null | undefined,
    defaultValue: T,
  ): Promise<T> {
    if (typeof globalThis.sessions_history !== 'function') {
      this.log('sessions_history not available, returning default')
      return defaultValue
    }

    try {
      if (!session || !session.sessionKey) {
        return defaultValue
      }

      const history = await globalThis.sessions_history!({ sessionKey: session.sessionKey })
      const lastMessage = history.messages?.[history.messages.length - 1]

      if (lastMessage?.content) {
        const content = lastMessage.content
        const parsed = extractJSONObject(content)
        if (parsed) {
          return parsed as T
        }
      }
    } catch (error) {
      this.log(`解析 Session 结果失败: ${error}`)
    }

    return defaultValue
  }

  protected log(message: string): void {
    this.logger.info(message, { role: this.role })
  }
}
