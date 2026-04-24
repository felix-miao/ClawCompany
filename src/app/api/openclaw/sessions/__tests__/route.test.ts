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
  const mockSync = {
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
    __mockSync: mockSync,
  }
})

import { GET } from '../route'
import { __mockSync } from '@/lib/gateway/session-sync'
import { resetOpenClawSnapshotCache } from '@/lib/gateway/poll-snapshot'

const API_KEY = 'test-api-key-12345678901234567890'

function createMockRequest(options?: { noAuth?: boolean }) {
  const headers: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    'content-type': 'application/json',
    ...(options?.noAuth ? {} : { 'x-api-key': API_KEY }),
  }
  return {
    url: 'http://localhost/api/openclaw/sessions',
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
    json: () => Promise.resolve({}),
  }
}

describe('/api/openclaw/sessions', () => {
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
    resetOpenClawSnapshotCache()
    __mockSync.client.connect.mockResolvedValue(undefined)
    __mockSync.client.disconnect.mockResolvedValue(undefined)
  })

  it('should return 401 without API key', async () => {
    const request = createMockRequest({ noAuth: true })
    const response = await GET(request as any)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('should return agents and sessions when gateway is connected', async () => {
    const agents = [
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
    ]
    const sessions = [
      { key: 's1', agentId: 'sidekick-claw', label: 'test', model: 'glm-5', status: 'completed', endedAt: '2026-04-10T00:00:00Z' },
    ]

    __mockSync.fetchAgents.mockResolvedValue([
      { id: 'sidekick-claw', name: 'PM', identity: { name: 'PM Claw' } },
    ])
    __mockSync.fetchSessions.mockResolvedValue(sessions)
    __mockSync.mapToAgentInfo.mockReturnValue(agents)

    const request = createMockRequest()
    const response = await GET(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.connected).toBe(true)
    expect(data.agents).toEqual(agents)
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].key).toBe('s1')
  })

  it('should return fallback data when gateway is unreachable', async () => {
    __mockSync.client.connect.mockRejectedValue(new Error('Connection refused'))
    __mockSync.getDefaultAgents.mockReturnValue([
      { id: 'alice', name: 'Alice', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
    ])

    const request = createMockRequest()
    const response = await GET(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.connected).toBe(false)
    expect(data.agents).toHaveLength(1)
    expect(data.sessions).toEqual([])
  })

  it('should return fallback data when fetchAgents throws', async () => {
    __mockSync.fetchAgents.mockRejectedValue(new Error('RPC timeout'))
    __mockSync.getDefaultAgents.mockReturnValue([
      { id: 'alice', name: 'Alice', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
    ])

    const request = createMockRequest()
    const response = await GET(request as any)
    const data = await response.json()

    expect(data.connected).toBe(false)
    expect(data.error).toContain('RPC timeout')
  })
})
