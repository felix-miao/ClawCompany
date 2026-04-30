import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

import { sanitizeUserInput } from '../utils/prompt-sanitizer'
import { createGatewayClient, getGatewayClient, OpenClawGatewayClient, SpawnOptions } from './client'

// ---------------------------------------------------------------------------
// P0-4: Worker crash detection helpers
// ---------------------------------------------------------------------------

const MAX_SPAWN_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

function recordWorkerStatus(
  agentRole: string,
  event: 'crash' | 'retry' | 'recovered' | 'failed',
  details: Record<string, unknown>,
): void {
  try {
    const dir = path.join(os.homedir(), '.clawcompany', 'blackboard')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'workerStatus.json')
    let current: Record<string, unknown[]> = {}
    try { current = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* fresh start */ }
    if (!Array.isArray(current[agentRole])) current[agentRole] = []
    ;(current[agentRole] as unknown[]).push({ event, timestamp: new Date().toISOString(), ...details })
    fs.writeFileSync(file, JSON.stringify(current, null, 2), 'utf8')
  } catch (err) {
    console.error('[executor] Failed to write workerStatus blackboard:', err)
  }
}

// Default project cwd for ACP sessions (where opencode will write files)
const PROJECT_CWD = process.env.CLAWCOMPANY_CWD || path.resolve(__dirname, '../../../..')

const ROLE_TO_SESSION_PREFIX: Record<string, string> = {
  pm: 'sidekick-claw',
  dev: 'dev-claw',
  review: 'reviewer-claw',
  tester: 'tester-claw',
}

export interface AgentSpawnConfig {
  runtime: 'subagent' | 'acp'
  model?: string
  thinking?: 'low' | 'medium' | 'high'
  timeout?: number
}

export interface AgentExecutionResult {
  success: boolean
  sessionKey?: string
  runId?: string
  content?: string
  error?: string
}

const AGENT_CONFIGS: Record<string, AgentSpawnConfig> = {
  pm: {
    runtime: 'subagent',
    thinking: 'high',
    timeout: 300
  },
  dev: {
    runtime: 'acp',
    thinking: 'medium',
    timeout: 600
  },
  review: {
    runtime: 'subagent',
    thinking: 'medium',
    timeout: 180
  }
}

export class OpenClawAgentExecutor {
  private client: OpenClawGatewayClient
  private connected: boolean = false

  constructor(client?: OpenClawGatewayClient) {
    this.client = client || getGatewayClient()
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect()
      this.connected = true
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect()
      this.connected = false
    }
  }

  async executeAgent(
    agentRole: 'pm' | 'dev' | 'review',
    task: string,
    options?: Partial<AgentSpawnConfig>
  ): Promise<AgentExecutionResult> {
    if (!this.connected) {
      await this.connect()
    }

    const config = { ...AGENT_CONFIGS[agentRole], ...options }

    const spawnOptions: SpawnOptions = {
      task,
      runtime: config.runtime,
      thinking: config.thinking,
      model: config.model,
      runTimeoutSeconds: config.timeout
    }

    if (agentRole === 'pm') {
      spawnOptions.label = `PM Analysis: ${task.substring(0, 50)}`
    } else if (agentRole === 'dev') {
      spawnOptions.label = `Dev Implementation: ${task.substring(0, 50)}`
      // P0-3: removed streamTo:'parent' — no parent-side stream consumer exists
      // ACP: route to opencode for real file writing
      spawnOptions.agentId = 'opencode'
      spawnOptions.cwd = PROJECT_CWD
    } else if (agentRole === 'review') {
      spawnOptions.label = `Review: ${task.substring(0, 50)}`
    }

    // P0-4: retry loop with exponential backoff + crash detection
    let lastError: Error | undefined
    for (let attempt = 0; attempt < MAX_SPAWN_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
        console.warn(`[executor] Retrying ${agentRole} agent (attempt ${attempt + 1}/${MAX_SPAWN_RETRIES}) after ${backoffMs}ms`)
        recordWorkerStatus(agentRole, 'retry', { attempt, backoffMs, error: lastError?.message })
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }

      try {
        const result = await this.client.sessions_spawn(spawnOptions)

        if (result.status !== 'accepted') {
          const err = new Error(result.error || 'Spawn failed')
          recordWorkerStatus(agentRole, 'crash', { attempt, error: err.message, runId: result.runId })
          lastError = err
          continue
        }

        if (!result.childSessionKey) {
          const err = new Error(`Spawn accepted but no childSessionKey returned (runId: ${result.runId ?? 'unknown'})`)
          recordWorkerStatus(agentRole, 'crash', { attempt, error: err.message, runId: result.runId })
          lastError = err
          continue
        }

        const completionTimeout = (config.timeout || 300) * 1000
        let content: string
        try {
          content = await this.client.waitForCompletion(result.childSessionKey, completionTimeout)
        } catch (completionError) {
          const err = completionError instanceof Error ? completionError : new Error(String(completionError))
          console.error(`[executor] ${agentRole} session crashed:`, err.message)
          recordWorkerStatus(agentRole, 'crash', { attempt, error: err.message, sessionKey: result.childSessionKey })
          lastError = err
          continue
        }

        if (attempt > 0) recordWorkerStatus(agentRole, 'recovered', { attempt, sessionKey: result.childSessionKey })

        return {
          success: true,
          sessionKey: result.childSessionKey,
          runId: result.runId,
          content
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        console.error(`[executor] ${agentRole} spawn error (attempt ${attempt + 1}):`, err.message)
        recordWorkerStatus(agentRole, 'crash', { attempt, error: err.message })
        lastError = err
      }
    }

    // All retries exhausted
    recordWorkerStatus(agentRole, 'failed', { error: lastError?.message, maxRetries: MAX_SPAWN_RETRIES })
    return {
      success: false,
      error: lastError?.message ?? 'Unknown error'
    }
  }

  async executePMAgent(task: string): Promise<AgentExecutionResult> {
    const sanitizedTask = sanitizeUserInput(task)
    const prompt = `You are a PM Claw. Analyze the following requirement and break it down into tasks.

${sanitizedTask}

Please provide:
1. Task breakdown (list of specific tasks)
2. Dependencies between tasks
3. Recommended agent assignments (pm/dev/review)

Format your response as JSON:
{
  "analysis": "Brief analysis",
  "tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "assignedTo": "dev",
      "dependencies": [],
      "files": []
    }
  ]
}`

    return this.executeAgent('pm', prompt, { thinking: 'high' })
  }

  async executeDevAgent(task: string, description?: string): Promise<AgentExecutionResult> {
    const sanitizedTask = sanitizeUserInput(task)
    const sanitizedDesc = description ? sanitizeUserInput(description) : ''
    const prompt = `You are a Dev Claw. Implement the following task.

${sanitizedTask}
${sanitizedDesc ? sanitizedDesc : ''}

Please:
1. Implement the required functionality
2. Write clean, well-documented code
3. Follow best practices

Provide the complete implementation.`

    return this.executeAgent('dev', prompt, {
      thinking: 'medium',
      timeout: 600
    })
  }

  async executeReviewAgent(task: string, code?: string): Promise<AgentExecutionResult> {
    const sanitizedTask = sanitizeUserInput(task)
    const sanitizedCode = code ? sanitizeUserInput(code) : ''
    const prompt = `You are a Reviewer Claw. Review the following implementation.

${sanitizedTask}
${sanitizedCode ? sanitizedCode : ''}

Please check:
1. Code quality
2. Best practices
3. Potential issues
4. Suggestions for improvement

Provide your review with APPROVED or NEEDS_CHANGES verdict.`

    return this.executeAgent('review', prompt, {
      thinking: 'medium',
      timeout: 180
    })
  }

  async sendToAgent(agentRole: string, message: string): Promise<AgentExecutionResult> {
    if (!this.connected) {
      await this.connect()
    }

    try {
      const prefix = ROLE_TO_SESSION_PREFIX[agentRole]
      if (!prefix) {
        return {
          success: false,
          error: `Unknown agent role: ${agentRole}`,
        }
      }

      const sessions = await this.client.call<Array<{ key: string; status: string }>>(
        'sessions.list',
        { status: 'running' }
      )

      const activeSession = sessions.find(s =>
        s.key.includes(prefix) && s.status === 'running'
      )

      if (!activeSession) {
        return {
          success: false,
          error: `No active session found for role: ${agentRole}`,
        }
      }

      const sendResult = await this.client.sessions_send(activeSession.key, message)

      return {
        success: sendResult.status === 'sent',
        sessionKey: activeSession.key,
        content: sendResult.messageId,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  isConnected(): boolean {
    return this.connected && this.client.isConnected()
  }
}

let _agentExecutor: OpenClawAgentExecutor | null = null

export function createAgentExecutor(client?: OpenClawGatewayClient): OpenClawAgentExecutor {
  const resolvedClient = client || createGatewayClient()
  return new OpenClawAgentExecutor(resolvedClient)
}

export function getAgentExecutor(): OpenClawAgentExecutor {
  if (!_agentExecutor) {
    _agentExecutor = createAgentExecutor()
  }
  return _agentExecutor
}

export function resetAgentExecutor(): void {
  _agentExecutor = null
}

export function setAgentExecutor(executor: OpenClawAgentExecutor): void {
  _agentExecutor = executor
}

export { createGatewayClient } from './client'
