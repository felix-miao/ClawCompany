jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/security/utils', () => ({
  InputValidator: {
    sanitize: (str: string) => str.replace(/[`$]/g, ''),
  },
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
}))

jest.mock('@/lib/gateway/session-sync', () => {
  const mockSync: any = {
    fetchAgents: jest.fn(),
    fetchSessions: jest.fn(),
    mapToAgentInfo: jest.fn(),
    getDefaultAgents: jest.fn(),
    client: {
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
  }

  return {
    SessionSyncService: jest.fn(() => mockSync),
    mockSync,
  }
})

import { GET } from '../route'
import { mockSync } from '@/lib/gateway/session-sync'

const mockSyncClient = mockSync as any
const API_KEY = 'test-api-key-12345678901234567890'

function createMockRequest(options?: { noAuth?: boolean }): any {
  const headers: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    'content-type': 'application/json',
    ...(options?.noAuth ? {} : { 'x-api-key': API_KEY }),
  }
  return {
    url: 'http://localhost/api/openclaw/metrics',
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
    json: () => Promise.resolve({}),
  }
}

describe('/api/openclaw/metrics', () => {
  const originalApiKey = process.env.AGENT_API_KEY

  beforeAll(() => {
    process.env.AGENT_API_KEY = API_KEY
  })

  afterAll(() => {
    if (originalApiKey) {
      process.env.AGENT_API_KEY = originalApiKey
    } else {
      delete process.env.AGENT_API_KEY
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockSyncClient.client.connect.mockResolvedValue(undefined)
    mockSyncClient.client.disconnect.mockResolvedValue(undefined)
  })

  it('should return 401 without API key', async () => {
    const request = createMockRequest({ noAuth: true })
    const response = await GET(request as any)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('should return real metrics when gateway is connected', async () => {
    mockSyncClient.fetchAgents.mockResolvedValue([
      { id: 'sidekick-claw', name: 'PM', identity: { name: 'PM Claw' } },
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
    ])
    mockSyncClient.fetchSessions.mockResolvedValue([
      { key: 's1', agentId: 'sidekick-claw', label: 'task 1', model: 'glm-5', status: 'running', endedAt: null, usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
      { key: 's2', agentId: 'dev-claw', label: 'task 2', model: 'glm-5', status: 'completed', endedAt: '2026-04-10T00:00:00Z', usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 } },
      { key: 's3', agentId: 'dev-claw', label: 'task 3', model: 'glm-5', status: 'failed', endedAt: '2026-04-10T01:00:00Z' },
    ])
    mockSyncClient.mapToAgentInfo.mockReturnValue([
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'busy', emotion: 'neutral', currentTask: null },
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
    ])

    const request = createMockRequest()
    const response = await GET(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    const metrics = data.metrics
    expect(metrics.source).toBe('gateway')
    expect(metrics.agents.total).toBe(2)
    expect(metrics.agents.active).toBe(1)
    expect(metrics.agents.idle).toBe(1)
    expect(metrics.agents.byRole).toEqual({ pm: 1, dev: 1 })
    expect(metrics.sessions.total).toBe(3)
    expect(metrics.sessions.active).toBe(1)
    expect(metrics.sessions.completed).toBe(1)
    expect(metrics.sessions.failed).toBe(1)
    expect(metrics.tokens.promptTokens).toBe(300)
    expect(metrics.tokens.completionTokens).toBe(150)
    expect(metrics.tokens.totalTokens).toBe(450)
    expect(metrics.fetchedAt).toBeDefined()
  })

  it('should return fallback metrics when gateway is unreachable', async () => {
    mockSyncClient.client.connect.mockRejectedValue(new Error('Connection refused'))

    const request = createMockRequest()
    const response = await GET(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    const metrics = data.metrics
    expect(metrics.source).toBe('fallback')
    expect(metrics.agents.total).toBe(0)
    expect(metrics.sessions.total).toBe(0)
    expect(data.error).toContain('Connection refused')
  })

  it('should return fallback when fetchAgents throws', async () => {
    mockSyncClient.fetchAgents.mockRejectedValue(new Error('RPC timeout'))

    const request = createMockRequest()
    const response = await GET(request as any)
    const data = await response.json()

    expect(data.metrics.source).toBe('fallback')
    expect(data.error).toContain('RPC timeout')
  })

  it('should handle sessions without usage data', async () => {
    mockSyncClient.fetchAgents.mockResolvedValue([
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
    ])
    mockSyncClient.fetchSessions.mockResolvedValue([
      { key: 's1', agentId: 'dev-claw', label: 'task', model: 'glm-5', status: 'completed', endedAt: '2026-04-10T00:00:00Z' },
    ])
    mockSyncClient.mapToAgentInfo.mockReturnValue([
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
    ])

    const request = createMockRequest()
    const response = await GET(request as any)
    const data = await response.json()

    expect(data.metrics.tokens.promptTokens).toBe(0)
    expect(data.metrics.tokens.completionTokens).toBe(0)
    expect(data.metrics.tokens.totalTokens).toBe(0)
  })
})
