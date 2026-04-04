import { BaseOpenClawAgent as SharedBaseOpenClawAgent } from '@ai-team-demo/lib/core/base-agent'
import { AgentRole, AgentConfig } from '@ai-team-demo/lib/core/types'

export { AgentRole, AgentConfig }

export { BaseOpenClawAgent }

abstract class BaseOpenClawAgent<TConfig extends AgentConfig = AgentConfig> extends SharedBaseOpenClawAgent<TConfig> {
  protected getDefaultResult(): unknown {
    return null
  }

  checkOpenClawAPI(): { available: boolean; missing: string[] } {
    const missing: string[] = []

    if (typeof globalThis.sessions_spawn !== 'function') {
      missing.push('sessions_spawn')
    }

    if (typeof globalThis.sessions_history !== 'function') {
      missing.push('sessions_history')
    }

    return {
      available: missing.length === 0,
      missing,
    }
  }
}
