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

  // 检查是否可以在没有完整 OpenClaw API 的情况下运行
  canRunInRestrictedMode(): boolean {
    const apiCheck = this.checkOpenClawAPI()
    // 至少需要其中一个 API 来运行基本功能
    return apiCheck.missing.length < 2
  }
}
