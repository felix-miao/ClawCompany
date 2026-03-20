/**
 * OpenClaw 内置工具类型声明
 * 
 * 这些工具在 OpenClaw 环境中全局可用
 */

declare global {
  interface SessionsSpawnOptions {
    runtime?: 'subagent' | 'acp'
    task: string
    thinking?: 'low' | 'medium' | 'high'
    mode?: 'run' | 'session'
    model?: string
    agentId?: string
    cwd?: string
    timeoutSeconds?: number
    thread?: boolean
    cleanup?: 'delete' | 'keep'
    label?: string
  }

  interface SessionsSpawnResult {
    sessionKey: string
    status: 'running' | 'completed' | 'failed'
  }

  interface SessionsHistoryOptions {
    sessionKey: string
    limit?: number
    includeTools?: boolean
  }

  interface SessionsHistoryResult {
    messages: Array<{
      role: string
      content: string
      timestamp?: string
    }>
  }

  interface SessionsSendOptions {
    message: string
    sessionKey?: string
    label?: string
    agentId?: string
    timeoutSeconds?: number
  }

  function sessions_spawn(options: SessionsSpawnOptions): Promise<SessionsSpawnResult>
  function sessions_history(options: SessionsHistoryOptions): Promise<SessionsHistoryResult>
  function sessions_send(options: SessionsSendOptions): Promise<void>
}

export {}
