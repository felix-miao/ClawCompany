declare module 'openclaw' {
  export interface SpawnOptions {
    runtime?: 'subagent' | 'acp'
    task: string
    thinking?: 'low' | 'medium' | 'high'
    mode?: 'run' | 'session'
    model?: string
    agentId?: string
    cwd?: string
    runTimeoutSeconds?: number
  }

  export interface SessionResult {
    sessionKey: string
    status: 'running' | 'completed' | 'failed'
  }

  export interface HistoryOptions {
    sessionKey: string
    limit?: number
    includeTools?: boolean
  }

  export interface HistoryMessage {
    role: string
    content: string
  }

  export interface HistoryResult {
    messages: HistoryMessage[]
  }

  export function sessions_spawn(options: SpawnOptions): Promise<SessionResult>
  export function sessions_history(options: HistoryOptions): Promise<HistoryResult>
  export function sessions_send(options: { sessionKey: string; message: string }): Promise<void>
  export function sessions_yield(options?: { message?: string }): Promise<void>
}

interface OpenClawGlobal {
  sessions_spawn?: (options: import('openclaw').SpawnOptions) => Promise<import('openclaw').SessionResult>
  sessions_history?: (options: import('openclaw').HistoryOptions) => Promise<import('openclaw').HistoryResult>
}

declare global {
  var openclaw: OpenClawGlobal | undefined
}
