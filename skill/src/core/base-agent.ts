import { AgentRole, AgentConfig } from './types'

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
  }): Promise<any> {
    const sessions_spawn = (global as any).sessions_spawn
    if (typeof sessions_spawn !== 'function') {
      throw new Error('OpenClaw sessions_spawn not available')
    }

    return await sessions_spawn({
      runtime: options?.runtime || 'subagent',
      agentId: options?.agentId,
      task,
      thinking: this.config.thinking || 'high',
      mode: 'run',
      model: this.config.model,
      cwd: options?.cwd,
    })
  }

  protected async parseJSONFromSession<T>(session: any, defaultValue: T): Promise<T> {
    const sessions_history = (global as any).sessions_history
    if (typeof sessions_history !== 'function') {
      return defaultValue
    }

    try {
      if (!session || !session.sessionKey) {
        return defaultValue
      }

      const history = await sessions_history({ sessionKey: session.sessionKey })
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

  protected checkOpenClawAPI(): { available: boolean; missing: string[] } {
    const missing: string[] = []

    if (typeof (global as any).sessions_spawn !== 'function') {
      missing.push('sessions_spawn')
    }

    if (typeof (global as any).sessions_history !== 'function') {
      missing.push('sessions_history')
    }

    return {
      available: missing.length === 0,
      missing,
    }
  }
}
