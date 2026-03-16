// 全局类型声明

declare global {
  // OpenClaw API
  function sessions_spawn(options: {
    runtime: 'subagent' | 'acp'
    agentId?: string
    task: string
    thinking?: 'low' | 'medium' | 'high'
    mode: 'run'
  }): Promise<string>

  function sessions_history(options: {
    sessionKey: string
    limit?: number
  }): Promise<Array<{
    status: 'pending' | 'running' | 'completed' | 'failed'
    content: string
    error?: string
  }>>

  function sessions_send(options: {
    sessionKey: string
    message: string
  }): Promise<void>
}

export {}
