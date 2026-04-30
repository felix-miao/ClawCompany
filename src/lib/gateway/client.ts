import { PendingCall, RPCRequest, RPCResponse } from '../core/types'
import { logger } from '../core/logger'

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

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

export type OpenClawToolType = 
  | 'read' | 'write' | 'edit' | 'delete' | 'mkdir'
  | 'bash' | 'shell' | 'grep' | 'find' | 'glob'
  | 'browser' | 'screenshot' | 'click' | 'type'
  | 'search' | 'fetch' | 'http'
  | 'git' | 'npm' | 'python' | 'node'
  | 'test' | 'lint' | 'build' | 'deploy'
  | 'unknown'

export interface HistoryToolMetadata {
  name: OpenClawToolType
  rawName?: string
  duration?: number
  success?: boolean
}

export interface HistoryFileMetadata {
  paths: string[]
  operation: 'read' | 'write' | 'edit' | 'delete' | 'list'
}

export interface HistoryArtifactMetadata {
  paths: string[]
  type: 'html' | 'tsx' | 'code' | 'image' | 'markdown' | 'json' | 'test-report' | 'url'
}

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'toolResult'
  content: string
  status?: 'pending' | 'running' | 'completed' | 'failed'
  timestamp?: string
  tool?: HistoryToolMetadata
  files?: HistoryFileMetadata[]
  artifacts?: HistoryArtifactMetadata[]
  messageId?: string
  parentId?: string
}

interface SessionListEntry {
  key: string
  status?: string
  endedAt?: string | null
}

export interface SendOptions {
  role?: 'user' | 'assistant' | 'system'
}

export interface SendResult {
  status: 'sent' | 'error'
  messageId?: string
  error?: string
}

export interface GatewayOptions {
  timeout?: number
  token?: string
}

interface OpenClawConfig {
  gateway?: {
    url?: string
    wsUrl?: string
    remote?: {
      url?: string
    }
    auth?: {
      token?: string
    }
  }
}

export interface GatewayConfig {
  url: string
  token?: string
  tokenSource: 'options' | 'env' | 'openclaw-config' | 'missing'
}

const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789'

function isServerRuntime(): boolean {
  return typeof window === 'undefined' || process.env.NODE_ENV === 'test'
}

function normalizeGatewayUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`
  return trimmed
}

function readOpenClawConfig(): OpenClawConfig | null {
  if (!isServerRuntime()) return null

  const configPath = process.env.OPENCLAW_CONFIG_PATH
    || path.join(os.homedir(), '.openclaw', 'openclaw.json')

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as OpenClawConfig
  } catch (error) {
    logger.warn('OpenClaw config discovery failed', {
      configPath,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export function resolveGatewayConfig(options: GatewayOptions = {}, url?: string): GatewayConfig {
  const explicitUrl = normalizeGatewayUrl(url)
  const config = explicitUrl ? null : readOpenClawConfig()
  const resolvedUrl = normalizeGatewayUrl(url)
    || normalizeGatewayUrl(process.env.OPENCLAW_GATEWAY_URL)
    || normalizeGatewayUrl(config?.gateway?.wsUrl)
    || normalizeGatewayUrl(config?.gateway?.url)
    || normalizeGatewayUrl(config?.gateway?.remote?.url)
    || DEFAULT_GATEWAY_URL

  if (options.token) {
    return { url: resolvedUrl, token: options.token, tokenSource: 'options' }
  }

  if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    return { url: resolvedUrl, token: process.env.OPENCLAW_GATEWAY_TOKEN, tokenSource: 'env' }
  }

  if (config?.gateway?.auth?.token) {
    return { url: resolvedUrl, token: config.gateway.auth.token, tokenSource: 'openclaw-config' }
  }

  return { url: resolvedUrl, tokenSource: 'missing' }
}

export class OpenClawGatewayClient {
  private url: string
  private token?: string
  private tokenSource: GatewayConfig['tokenSource']
  private timeout: number
  private ws: WebSocket | null = null
  private requestId = 0
  private pendingCalls = new Map<number, PendingCall>()
  private connecting = false

  constructor(url?: string, options: GatewayOptions = {}) {
    const config = resolveGatewayConfig(options, url)
    this.url = config.url
    this.token = config.token
    this.tokenSource = config.tokenSource
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
            logger.warn('Gateway response parse failed', { error: e, raw: event.data })
          }
        }

        this.ws.onclose = () => {
          this.pendingCalls.forEach(({ reject }, id) => {
            const authHint = this.token
              ? `token source: ${this.tokenSource}`
              : 'missing OPENCLAW_GATEWAY_TOKEN and gateway.auth.token in ~/.openclaw/openclaw.json'
            reject(new Error(`WebSocket connection closed while calling gateway at ${this.url} (${authHint})`))
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

  async sessions_send(sessionKey: string, message: string, options?: SendOptions): Promise<SendResult> {
    const params: Record<string, unknown> = {
      sessionKey,
      message,
    }

    if (options?.role) params.role = options.role

    return this.call<SendResult>('sessions.send', params)
  }

  async waitForCompletion(sessionKey: string, timeout: number = 60000): Promise<string> {
    const startTime = Date.now()
    const pollInterval = 2000

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.call<{ sessions?: SessionListEntry[] }>('sessions.list')
        const session = result.sessions?.find(currentSession => currentSession.key === sessionKey)

        if (session?.endedAt) {
          const history = await this.sessions_history(sessionKey, 1)
          const lastMessage = history[0]

          if (session.status === 'failed') {
            throw new Error(`Session failed: ${lastMessage?.content ?? 'Unknown error'}`)
          }

          return lastMessage?.content ?? ''
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

let _gatewayClient: OpenClawGatewayClient | null = null

export function createGatewayClient(url?: string, options?: GatewayOptions): OpenClawGatewayClient {
  return new OpenClawGatewayClient(url, options)
}

export function getGatewayClient(): OpenClawGatewayClient {
  if (!_gatewayClient) {
    _gatewayClient = createGatewayClient()
  }
  return _gatewayClient
}

export function resetGatewayClient(): void {
  _gatewayClient = null
}

export function setGatewayClient(client: OpenClawGatewayClient): void {
  _gatewayClient = client
}

export const __mockClient = {
  connect: () => Promise.resolve(undefined),
  disconnect: () => Promise.resolve(undefined),
  isConnected: () => true,
  sessions_send: () => {},
}
