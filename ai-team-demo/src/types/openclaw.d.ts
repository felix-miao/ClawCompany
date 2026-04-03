declare global {
  // eslint-disable-next-line no-var
  var sessions_spawn: ((opts: {
    runtime?: string
    agentId?: string
    task: string
    thinking?: string
    mode?: string
    model?: string
    cwd?: string
  }) => Promise<unknown>) | undefined

  // eslint-disable-next-line no-var
  var sessions_history: ((opts: {
    sessionKey: string
  }) => Promise<{ messages?: Array<{ content?: string }> }>) | undefined

  function sessions_send(options: {
    sessionKey: string
    message: string
  }): Promise<void>
}

export {}
