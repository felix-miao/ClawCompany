import { OpenClawGatewayClient, SpawnOptions, SpawnResult, getGatewayClient } from './client'

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
      spawnOptions.streamTo = 'parent'
    } else if (agentRole === 'review') {
      spawnOptions.label = `Review: ${task.substring(0, 50)}`
    }

    try {
      const result = await this.client.sessions_spawn(spawnOptions)

      if (result.status !== 'accepted') {
        return {
          success: false,
          error: result.error || 'Spawn failed'
        }
      }

      const completionTimeout = (config.timeout || 300) * 1000
      const content = await this.client.waitForCompletion(
        result.childSessionKey!,
        completionTimeout
      )

      return {
        success: true,
        sessionKey: result.childSessionKey,
        runId: result.runId,
        content
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async executePMAgent(task: string): Promise<AgentExecutionResult> {
    const prompt = `You are a PM Claw. Analyze the following requirement and break it down into tasks.

Requirement: ${task}

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
    const prompt = `You are a Dev Claw. Implement the following task.

Task: ${task}
${description ? `Description: ${description}` : ''}

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
    const prompt = `You are a Reviewer Claw. Review the following implementation.

Task: ${task}
${code ? `Code to review:\n\`\`\`\n${code}\n\`\`\`` : ''}

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

  isConnected(): boolean {
    return this.connected && this.client.isConnected()
  }
}

let defaultExecutor: OpenClawAgentExecutor | null = null

export function getAgentExecutor(): OpenClawAgentExecutor {
  if (!defaultExecutor) {
    defaultExecutor = new OpenClawAgentExecutor()
  }
  return defaultExecutor
}

export function resetAgentExecutor(): void {
  if (defaultExecutor) {
    defaultExecutor.disconnect().catch(console.error)
    defaultExecutor = null
  }
}
