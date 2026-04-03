import type { SessionResult } from 'openclaw'
import { AgentRole, AgentConfig } from './types'

type SpawnOptions = {
  runtime?: 'subagent' | 'acp'
  task: string
  thinking?: 'low' | 'medium' | 'high'
  mode?: 'run'
  model?: string
  agentId?: string
  cwd?: string
}

interface HistoryResult {
  messages: Array<{ role: string; content: string }>
}

type SpawnFn = (options: SpawnOptions) => Promise<SessionResult>
type HistoryFn = (options: { sessionKey: string }) => Promise<HistoryResult>

interface OpenClawAPI {
  sessions_spawn: SpawnFn
  sessions_history: HistoryFn
}

function getGlobalFunction(name: string): unknown {
  const g = globalThis as Record<string, unknown>
  return g[name]
}

function asSpawnFn(fn: unknown): SpawnFn | null {
  return typeof fn === 'function' ? (fn as SpawnFn) : null
}

function asHistoryFn(fn: unknown): HistoryFn | null {
  return typeof fn === 'function' ? (fn as HistoryFn) : null
}

export abstract class BaseOpenClawAgent<TConfig extends AgentConfig = AgentConfig> {
  readonly role: AgentRole
  protected config: TConfig

  constructor(role: AgentRole, config: TConfig) {
    this.role = role
    this.config = config
  }

  protected abstract buildPrompt(...args: unknown[]): string

  protected async spawnAgent(task: string, options?: {
    runtime?: 'subagent' | 'acp'
    agentId?: string
    cwd?: string
  }): Promise<SessionResult> {
    const fn = asSpawnFn(getGlobalFunction('sessions_spawn'))
    if (!fn) {
      throw new Error('OpenClaw sessions_spawn not available')
    }

    return await fn({
      runtime: options?.runtime || 'subagent',
      agentId: options?.agentId,
      task,
      thinking: this.config.thinking || 'high',
      mode: 'run',
      model: this.config.model,
      cwd: options?.cwd,
    })
  }

  protected async parseJSONFromSession<T>(session: SessionResult | null | undefined, defaultValue: T): Promise<T> {
    const fn = asHistoryFn(getGlobalFunction('sessions_history'))
    if (!fn) {
      return defaultValue
    }

    try {
      if (!session?.sessionKey) {
        return defaultValue
      }

      const history = await fn({ sessionKey: session.sessionKey })
      const lastMessage = history.messages?.[history.messages.length - 1]

      if (lastMessage?.content) {
        const content = lastMessage.content
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      }
    } catch (error) {
      this.log(`解析 Session 结果失败: ${error}`)
    }

    return defaultValue
  }

  protected log(message: string): void {
    const roleEmoji: Record<string, string> = {
      pm: '📋',
      dev: '💻',
      review: '🔍',
    }
    console.log(`${roleEmoji[this.role] || '🤖'} [${this.role.toUpperCase()} Agent] ${message}`)
  }

  checkOpenClawAPI(): { available: boolean; missing: string[] } {
    const missing: string[] = []

    if (!asSpawnFn(getGlobalFunction('sessions_spawn'))) {
      missing.push('sessions_spawn')
    }

    if (!asHistoryFn(getGlobalFunction('sessions_history'))) {
      missing.push('sessions_history')
    }

    return {
      available: missing.length === 0,
      missing,
    }
  }
}
