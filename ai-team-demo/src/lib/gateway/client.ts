import { PendingCall, RPCRequest, RPCResponse } from '../core/types'

export interface SpawnOptions {
  task: string
  label?: string
  runtime?: 'subagent' | 'acp'
  agentId?: string
  model?: string
  thinking?: 'low' | 'medium' | 'high'
  cwd?: string
  runTimeoutSeconds?: number
  thread?: boolean
  mode?: 'run' | 'session'
  cleanup?: 'delete' | 'keep'
  sandbox?: 'inherit' | 'require'
  streamTo?: 'parent'
}

export interface SpawnResult {
  status: 'accepted' | 'error'
  runId?: string
  childSessionKey?: string
  error?: string
}

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'toolResult'
  content: string
  status?: 'pending' | 'running' | 'completed' | 'failed'
}

export interface GatewayOptions {
  timeout?: number
  token?: string
}

export class OpenClawGatewayClient {
  private url: string
  private token?: string
  private timeout: number
  private ws: WebSocket | null = null
  private requestId = 0
  private pendingCalls = new Map<number, PendingCall>()
  private connecting = false

  constructor(url: string = 'ws://127.0.0.1:18789', options: GatewayOptions = {}) {
    this.url = url
    this.token = options.token
    this.timeout = options.timeout || 30000
  }

  async connect(): Promise<void> {
    if (this.connecting) {
      throw new Error('Already connecting')
    }
    this.connecting = true

    try {
      return await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'))
        this.ws?.close()
      }, this.timeout)

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          clearTimeout(timeoutId)
          resolve()
        }

        this.ws.onerror = () => {
          clearTimeout(timeoutId)
          reject(new Error('WebSocket connection failed'))
        }

        this.ws.onmessage = (event) => {
          try {
            const response: RPCResponse = JSON.parse(event.data)
            this.handleResponse(response)
          } catch (e) {
            console.error('[GatewayClient] Failed to parse response:', e)
          }
        }

        this.ws.onclose = () => {
          this.pendingCalls.forEach(({ reject }, id) => {
            reject(new Error('WebSocket connection closed'))
            this.pendingCalls.delete(id)
          })
        }
      } catch (e) {
        clearTimeout(timeoutId)
        reject(e)
      }
    })
    } finally {
      this.connecting = false
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.ws || !this.isConnected()) {
      throw new Error('Not connected to Gateway')
    }

    const id = ++this.requestId
    const request: RPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params: {
        ...params,
        ...(this.token ? { auth: { token: this.token } } : {})
      }
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingCalls.delete(id)
        reject(new Error(`RPC call timeout: ${method}`))
      }, this.timeout)

      this.pendingCalls.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timeoutId)
          resolve(value as T)
        },
        reject: (error) => {
          clearTimeout(timeoutId)
          reject(error)
        }
      })

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        clearTimeout(timeoutId)
        this.pendingCalls.delete(id)
        reject(new Error('WebSocket disconnected before sending request'))
        return
      }
      this.ws.send(JSON.stringify(request))
    })
  }

  private handleResponse(response: RPCResponse): void {
    const pending = this.pendingCalls.get(response.id)
    if (!pending) {
      return
    }

    this.pendingCalls.delete(response.id)

    if (response.error) {
      pending.reject(new Error(response.error.message))
    } else {
      pending.resolve(response.result)
    }
  }

  async sessions_spawn(options: SpawnOptions): Promise<SpawnResult> {
    const params: Record<string, unknown> = {
      task: options.task,
    }

    if (options.label) params.label = options.label
    if (options.runtime) params.runtime = options.runtime
    if (options.agentId) params.agentId = options.agentId
    if (options.model) params.model = options.model
    if (options.thinking) params.thinking = options.thinking
    if (options.cwd) params.cwd = options.cwd
    if (options.runTimeoutSeconds) params.runTimeoutSeconds = options.runTimeoutSeconds
    if (options.thread !== undefined) params.thread = options.thread
    if (options.mode) params.mode = options.mode
    if (options.cleanup) params.cleanup = options.cleanup
    if (options.sandbox) params.sandbox = options.sandbox
    if (options.streamTo) params.streamTo = options.streamTo

    return this.call<SpawnResult>('sessions.spawn', params)
  }

  async sessions_history(sessionKey: string, limit: number = 50): Promise<HistoryMessage[]> {
    return this.call<HistoryMessage[]>('sessions.history', {
      sessionKey,
      limit,
      includeTools: false
    })
  }

  async waitForCompletion(sessionKey: string, timeout: number = 60000): Promise<string> {
    const startTime = Date.now()
    const pollInterval = 2000

    while (Date.now() - startTime < timeout) {
      try {
        const history = await this.sessions_history(sessionKey, 1)
        
        if (history.length > 0) {
          const lastMessage = history[0]
          
          if (lastMessage.status === 'completed') {
            return lastMessage.content
          }
          
          if (lastMessage.status === 'failed') {
            throw new Error(`Session failed: ${lastMessage.content}`)
          }
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval))
      } catch (e) {
        if (e instanceof Error && e.message.includes('Session failed')) {
          throw e
        }
      }
    }

    throw new Error('Wait for completion timeout')
  }
}

let defaultClient: OpenClawGatewayClient | null = null

export function getGatewayClient(): OpenClawGatewayClient {
  if (!defaultClient) {
    const url = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789'
    const token = process.env.OPENCLAW_GATEWAY_TOKEN
    defaultClient = new OpenClawGatewayClient(url, { token })
  }
  return defaultClient
}

export function setGatewayClient(client: OpenClawGatewayClient | null): void {
  defaultClient = client
}

export function resetGatewayClient(): void {
  if (defaultClient) {
    defaultClient.disconnect().catch(console.error)
    defaultClient = null
  }
}

export function createGatewayClient(url?: string, options?: GatewayOptions): OpenClawGatewayClient {
  return new OpenClawGatewayClient(
    url || process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
    { token: process.env.OPENCLAW_GATEWAY_TOKEN, ...options },
  )
}
