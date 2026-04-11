/**
 * MCP Client - Model Context Protocol Client Prototype
 *
 * Implements the MCP JSON-RPC 2.0 protocol over HTTP/SSE.
 * Connects to an MCP server, lists tools, and calls them.
 *
 * Protocol reference: https://modelcontextprotocol.io/specification
 *
 * Note: Implemented without the @modelcontextprotocol/sdk to avoid
 * additional dependencies. Uses the MCP HTTP transport (JSON-RPC 2.0).
 */

// ---------------------------------------------------------------------------
// MCP Protocol Types
// ---------------------------------------------------------------------------

export interface MCPToolParameter {
  type: string
  description?: string
  enum?: string[]
  properties?: Record<string, MCPToolParameter>
  required?: string[]
  items?: MCPToolParameter
  default?: unknown
}

export interface MCPToolSchema {
  type: 'object'
  properties?: Record<string, MCPToolParameter>
  required?: string[]
}

export interface MCPTool {
  name: string
  description?: string
  inputSchema: MCPToolSchema
}

export interface MCPCallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

export interface MCPServerInfo {
  name: string
  version: string
  protocolVersion?: string
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 helpers
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: { code: number; message: string; data?: unknown }
}

// ---------------------------------------------------------------------------
// MCPClient
// ---------------------------------------------------------------------------

export class MCPClientError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly data?: unknown,
  ) {
    super(message)
    this.name = 'MCPClientError'
  }
}

export interface MCPClientOptions {
  /** Request timeout in ms. Default: 30000 */
  timeoutMs?: number
  /** Additional headers (e.g. auth) */
  headers?: Record<string, string>
}

/**
 * MCPClient connects to an MCP server via HTTP transport.
 *
 * Usage:
 *   const client = new MCPClient('http://localhost:3001/mcp')
 *   await client.connect()
 *   const tools = await client.listTools()
 *   const result = await client.callTool('myTool', { param: 'value' })
 */
export class MCPClient {
  private serverUrl: string
  private options: MCPClientOptions
  private requestId = 0
  private connected = false
  private serverInfo: MCPServerInfo | null = null

  constructor(serverUrl?: string, options: MCPClientOptions = {}) {
    this.serverUrl = serverUrl ?? process.env.MCP_SERVER_URL ?? ''
    this.options = {
      timeoutMs: options.timeoutMs ?? 30_000,
      headers: options.headers ?? {},
    }
  }

  /**
   * Connect to the MCP server and perform the initialize handshake.
   * Must be called before listTools() or callTool().
   */
  async connect(serverUrl?: string): Promise<MCPServerInfo> {
    if (serverUrl) {
      this.serverUrl = serverUrl
    }

    if (!this.serverUrl) {
      throw new MCPClientError(
        'No MCP server URL provided. Pass a URL to connect() or set MCP_SERVER_URL env var.',
      )
    }

    const result = await this.request<{
      protocolVersion: string
      serverInfo: { name: string; version: string }
      capabilities: Record<string, unknown>
    }>('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: {
        name: 'ClawCompany-MCPClient',
        version: '0.1.0',
      },
      capabilities: {
        tools: {},
      },
    })

    this.serverInfo = {
      name: result.serverInfo.name,
      version: result.serverInfo.version,
      protocolVersion: result.protocolVersion,
    }

    // Send initialized notification (fire-and-forget, no response expected)
    await this.notify('notifications/initialized')

    this.connected = true
    return this.serverInfo
  }

  /**
   * List all tools available on the connected MCP server.
   */
  async listTools(): Promise<MCPTool[]> {
    this.ensureConnected()
    const result = await this.request<{ tools: MCPTool[] }>('tools/list', {})
    return result.tools ?? []
  }

  /**
   * Call a tool by name with the given parameters.
   */
  async callTool(
    name: string,
    params: Record<string, unknown> = {},
  ): Promise<MCPCallToolResult> {
    this.ensureConnected()
    const result = await this.request<MCPCallToolResult>('tools/call', {
      name,
      arguments: params,
    })
    return result
  }

  /**
   * Returns the server info from the last successful connect().
   */
  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo
  }

  isConnected(): boolean {
    return this.connected
  }

  /** Disconnect (reset state). HTTP transport is stateless, so just resets flags. */
  disconnect(): void {
    this.connected = false
    this.serverInfo = null
  }

  // ---------------------------------------------------------------------------
  // Internal: JSON-RPC over HTTP
  // ---------------------------------------------------------------------------

  private nextId(): number {
    return ++this.requestId
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new MCPClientError(
        'MCPClient is not connected. Call connect() first.',
      )
    }
  }

  private async request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method,
      params,
    }

    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 30_000,
    )

    let response: Response
    try {
      response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.options.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err: unknown) {
      clearTimeout(timer)
      const e = err as Error
      throw new MCPClientError(`Network error calling MCP server: ${e.message}`)
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      throw new MCPClientError(
        `MCP server returned HTTP ${response.status}: ${response.statusText}`,
        response.status,
      )
    }

    let json: JsonRpcResponse<T>
    try {
      json = await response.json() as JsonRpcResponse<T>
    } catch {
      throw new MCPClientError('Failed to parse MCP server response as JSON')
    }

    if (json.error) {
      throw new MCPClientError(
        `MCP error [${json.error.code}]: ${json.error.message}`,
        json.error.code,
        json.error.data,
      )
    }

    return json.result as T
  }

  /** Send a JSON-RPC notification (no id, no response expected). */
  private async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const body = {
      jsonrpc: '2.0',
      method,
      ...(params ? { params } : {}),
    }

    try {
      await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.options.headers,
        },
        body: JSON.stringify(body),
      })
    } catch {
      // Notifications are fire-and-forget; swallow errors
    }
  }
}
