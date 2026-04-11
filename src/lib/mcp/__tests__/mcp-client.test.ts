/**
 * MCP Client unit tests
 * Tests MCPClient, MCPToolAdapter, and registerMCPTools using fetch mocks.
 */

import { MCPClient, MCPClientError } from '../mcp-client'
import { MCPToolAdapter, createMCPToolAdapters } from '../mcp-tool-adapter'
import { DefaultAgentToolRegistry } from '../../tools/registry'
import { registerMCPTools } from '../index'

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

type FetchMock = jest.Mock<Promise<Response>>

function makeFetchMock(responses: object[]): FetchMock {
  let callCount = 0
  return jest.fn().mockImplementation(() => {
    const body = responses[callCount++] ?? {}
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(body),
    } as Response)
  })
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const initializeResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    protocolVersion: '2024-11-05',
    serverInfo: { name: 'test-mcp-server', version: '1.0.0' },
    capabilities: { tools: {} },
  },
}

const listToolsResponse = {
  jsonrpc: '2.0',
  id: 2,
  result: {
    tools: [
      {
        name: 'search',
        description: 'Search the web',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'calculator',
        description: 'Perform arithmetic',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Math expression' },
          },
          required: ['expression'],
        },
      },
    ],
  },
}

const callToolResponse = {
  jsonrpc: '2.0',
  id: 3,
  result: {
    content: [{ type: 'text', text: 'result: 42' }],
    isError: false,
  },
}

// ---------------------------------------------------------------------------
// MCPClient tests
// ---------------------------------------------------------------------------

describe('MCPClient', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('connect() performs initialize handshake and returns serverInfo', async () => {
    global.fetch = makeFetchMock([
      initializeResponse,
      // notifications/initialized (fire-and-forget)
      { jsonrpc: '2.0' },
    ])

    const client = new MCPClient('http://localhost:3001/mcp')
    const info = await client.connect()

    expect(info.name).toBe('test-mcp-server')
    expect(info.version).toBe('1.0.0')
    expect(info.protocolVersion).toBe('2024-11-05')
    expect(client.isConnected()).toBe(true)
  })

  test('connect() throws if no URL provided', async () => {
    const saved = process.env.MCP_SERVER_URL
    delete process.env.MCP_SERVER_URL

    const client = new MCPClient()
    await expect(client.connect()).rejects.toThrow(MCPClientError)

    if (saved) process.env.MCP_SERVER_URL = saved
  })

  test('listTools() returns tool list', async () => {
    global.fetch = makeFetchMock([
      initializeResponse,
      {},               // initialized notification
      listToolsResponse,
    ])

    const client = new MCPClient('http://localhost:3001/mcp')
    await client.connect()
    const tools = await client.listTools()

    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('search')
    expect(tools[1].name).toBe('calculator')
  })

  test('listTools() throws if not connected', async () => {
    const client = new MCPClient('http://localhost:3001/mcp')
    await expect(client.listTools()).rejects.toThrow('not connected')
  })

  test('callTool() invokes the tool and returns result', async () => {
    global.fetch = makeFetchMock([
      initializeResponse,
      {},
      callToolResponse,
    ])

    const client = new MCPClient('http://localhost:3001/mcp')
    await client.connect()
    const result = await client.callTool('calculator', { expression: '6 * 7' })

    expect(result.content[0].text).toBe('result: 42')
    expect(result.isError).toBe(false)
  })

  test('throws MCPClientError on JSON-RPC error response', async () => {
    global.fetch = makeFetchMock([
      initializeResponse,
      {},
      {
        jsonrpc: '2.0',
        id: 3,
        error: { code: -32601, message: 'Method not found' },
      },
    ])

    const client = new MCPClient('http://localhost:3001/mcp')
    await client.connect()
    await expect(client.callTool('nonexistent', {})).rejects.toThrow('Method not found')
  })

  test('disconnect() resets state', async () => {
    global.fetch = makeFetchMock([initializeResponse, {}])
    const client = new MCPClient('http://localhost:3001/mcp')
    await client.connect()

    client.disconnect()
    expect(client.isConnected()).toBe(false)
    expect(client.getServerInfo()).toBeNull()
  })

  test('uses MCP_SERVER_URL env var when no URL passed', async () => {
    process.env.MCP_SERVER_URL = 'http://env-server/mcp'
    global.fetch = makeFetchMock([initializeResponse, {}])

    const client = new MCPClient()
    const info = await client.connect()
    expect(info.name).toBe('test-mcp-server')

    delete process.env.MCP_SERVER_URL
  })
})

// ---------------------------------------------------------------------------
// MCPToolAdapter tests
// ---------------------------------------------------------------------------

describe('MCPToolAdapter', () => {
  const mockTool = {
    name: 'search',
    description: 'Search the web',
    inputSchema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Query' } },
      required: ['query'],
    },
  }

  test('wraps MCP tool with mcp__ prefix', () => {
    const client = new MCPClient('http://localhost/mcp')
    const adapter = new MCPToolAdapter(mockTool, client)

    expect(adapter.name).toBe('mcp__search')
    expect(adapter.description).toBe('Search the web')
  })

  test('execute() calls client.callTool and maps to ToolResult', async () => {
    const client = new MCPClient('http://localhost/mcp')
    jest.spyOn(client, 'callTool').mockResolvedValue({
      content: [{ type: 'text', text: 'search results' }],
      isError: false,
    })
    // Satisfy isConnected check
    Object.defineProperty(client, 'connected', { value: true })

    const adapter = new MCPToolAdapter(mockTool, client)
    const result = await adapter.execute({ query: 'hello' })

    expect(result.success).toBe(true)
    expect(result.data?.content[0].text).toBe('search results')
  })

  test('formatResult() extracts text content', () => {
    const client = new MCPClient('http://localhost/mcp')
    const adapter = new MCPToolAdapter(mockTool, client)

    const formatted = adapter.formatResult({
      success: true,
      data: {
        content: [{ type: 'text', text: 'line 1' }, { type: 'text', text: 'line 2' }],
      },
    })

    expect(formatted).toBe('line 1\nline 2')
  })

  test('formatResult() handles error result', () => {
    const client = new MCPClient('http://localhost/mcp')
    const adapter = new MCPToolAdapter(mockTool, client)

    const formatted = adapter.formatResult({
      success: false,
      error: 'Tool failed',
    })

    expect(formatted).toBe('[mcp tool error] Tool failed')
  })
})

// ---------------------------------------------------------------------------
// createMCPToolAdapters tests
// ---------------------------------------------------------------------------

describe('createMCPToolAdapters', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('returns adapters for all tools from server', async () => {
    global.fetch = makeFetchMock([
      initializeResponse,
      {},
      listToolsResponse,
    ])

    const adapters = await createMCPToolAdapters('http://localhost/mcp')
    expect(adapters).toHaveLength(2)
    expect(adapters.map(a => a.name)).toEqual(['mcp__search', 'mcp__calculator'])
  })
})

// ---------------------------------------------------------------------------
// registerMCPTools tests
// ---------------------------------------------------------------------------

describe('registerMCPTools', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('registers all MCP tools into the registry', async () => {
    global.fetch = makeFetchMock([
      initializeResponse,
      {},
      listToolsResponse,
    ])

    const registry = new DefaultAgentToolRegistry()
    const result = await registerMCPTools('http://localhost/mcp', registry)

    expect(result.serverName).toBe('test-mcp-server')
    expect(result.toolsRegistered).toHaveLength(2)
    expect(result.toolsRegistered).toContain('mcp__search')
    expect(result.toolsRegistered).toContain('mcp__calculator')

    const tools = registry.listAll()
    expect(tools.find(t => t.name === 'mcp__search')).toBeDefined()
  })

  test('throws if no URL and no env var', async () => {
    delete process.env.MCP_SERVER_URL
    await expect(registerMCPTools()).rejects.toThrow('MCP_SERVER_URL')
  })

  test('registered tools appear in toOpenAIFunctions()', async () => {
    global.fetch = makeFetchMock([
      initializeResponse,
      {},
      listToolsResponse,
    ])

    const registry = new DefaultAgentToolRegistry()
    await registerMCPTools('http://localhost/mcp', registry)

    const functions = registry.toOpenAIFunctions()
    const searchFn = functions.find(f => f.function.name === 'mcp__search')
    expect(searchFn).toBeDefined()
    expect(searchFn?.function.description).toBe('Search the web')
  })
})
