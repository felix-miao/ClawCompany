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
    client: {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      sessions_history: jest.fn().mockResolvedValue([]),
    },
  }

  return {
    SessionSyncService: jest.fn(() => mockSync),
    getDefaultAgents: jest.fn(() => []),
    __mockSync: mockSync,
  }
})

import { GET } from '../route'
import { __mockSync } from '@/lib/gateway/session-sync'

const API_KEY = 'test-api-key-12345678901234567890'

function createMockRequest(options?: { noAuth?: boolean }) {
  const headers: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    'content-type': 'application/json',
    ...(options?.noAuth ? {} : { 'x-api-key': API_KEY }),
  }
  return {
    url: 'http://localhost/api/openclaw/snapshot',
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
    json: () => Promise.resolve({}),
  }
}

describe('/api/openclaw/snapshot', () => {
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
    __mockSync.client.connect.mockResolvedValue(undefined)
    __mockSync.client.disconnect.mockResolvedValue(undefined)
    __mockSync.client.sessions_history.mockResolvedValue([])
  })

  it('should derive current work from OpenClaw sessions and history', async () => {
    __mockSync.fetchAgents.mockResolvedValue([
      { id: 'sidekick-claw', name: 'PM', identity: { name: 'PM Claw' } },
    ])
    __mockSync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-1',
        agentId: 'sidekick-claw',
        label: '用你的团队给我写一个网站出来',
        model: 'gpt-5',
        status: 'running',
        startedAt: '2026-04-14T00:00:00Z',
        endedAt: null,
      },
    ])
    __mockSync.mapToAgentInfo.mockReturnValue([
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'busy', emotion: 'neutral', currentTask: null },
    ])
    __mockSync.client.sessions_history.mockResolvedValue([
      { role: 'assistant', content: '已收到，PM 正在分析...', status: 'running' },
      { role: 'toolResult', content: '已生成初始任务拆分', status: 'completed' },
    ])

    const response = await GET(createMockRequest() as any)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.connected).toBe(true)
    expect(data.agents[0].status).toBe('working')
    expect(data.agents[0].currentTask).toContain('用你的团队给我写一个网站出来')
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0]).toMatchObject({
      sessionKey: 'sess-1',
      agentId: 'sidekick-claw',
      agentName: 'PM Claw',
      role: 'pm',
      label: '用你的团队给我写一个网站出来',
      status: 'running',
      startedAt: '2026-04-14T00:00:00Z',
      endedAt: null,
      currentWork: '用你的团队给我写一个网站出来',
      latestThought: '已收到，PM 正在分析...',
      latestResultSummary: '已生成初始任务拆分',
    })
    expect(data.tasks).toHaveLength(1)
    expect(data.tasks[0].taskId).toBe('sess-1')
    expect(data.tasks[0].currentAgentName).toBe('PM Claw')
    expect(data.tasks[0].description).toContain('用你的团队给我写一个网站出来')
  })

  it('should return fallback payload when gateway fails', async () => {
    __mockSync.client.connect.mockRejectedValue(new Error('gateway offline'))

    const response = await GET(createMockRequest() as any)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.connected).toBe(false)
    expect(data.tasks).toEqual([])
    expect(data.sessions).toEqual([])
  })
})
