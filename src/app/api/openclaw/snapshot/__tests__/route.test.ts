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

jest.mock('@/lib/gateway/openclaw-snapshot', () => ({
  buildOpenClawSnapshot: jest.fn(),
}))

import { GET } from '../route'
import { __mockSync } from '@/lib/gateway/session-sync'
import { buildOpenClawSnapshot } from '@/lib/gateway/openclaw-snapshot'

const mockBuildOpenClawSnapshot = buildOpenClawSnapshot as jest.Mock

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
    const startedAt = new Date().toISOString()
    
    mockBuildOpenClawSnapshot.mockResolvedValue({
      agents: [
        { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'working', emotion: 'neutral', currentTask: '用你的团队给我写一个网站出来' },
      ],
      sessions: [
        {
          sessionKey: 'sess-1',
          agentId: 'sidekick-claw',
          agentName: 'PM Claw',
          role: 'pm',
          label: '用你的团队给我写一个网站出来',
          status: 'running',
          startedAt,
          endedAt: null,
          currentWork: '用你的团队给我写一个网站出来',
          latestThought: '已收到，PM 正在分析...',
          latestResultSummary: '已生成初始任务拆分',
          model: 'gpt-5',
          latestMessage: '已收到，PM 正在分析...',
          latestMessageRole: 'assistant',
          latestMessageStatus: 'running',
          history: [],
        },
      ],
      tasks: [
        {
          taskId: 'sess-1',
          description: '用你的团队给我写一个网站出来',
          currentPhase: 'pm_analysis',
          currentAgentId: 'sidekick-claw',
          currentAgentName: 'PM Claw',
          status: 'in_progress',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          phases: [],
        },
      ],
      metrics: {
        agents: { total: 1, active: 1, idle: 0, byRole: { pm: 1 } },
        sessions: { total: 1, active: 1, completed: 0, failed: 0 },
        tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        source: 'gateway',
        fetchedAt: new Date().toISOString(),
      },
      connected: true,
      fetchedAt: new Date().toISOString(),
    })

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
      startedAt,
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
    mockBuildOpenClawSnapshot.mockRejectedValue(new Error('gateway offline'))

    const response = await GET(createMockRequest() as any)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.connected).toBe(false)
    expect(data.tasks).toEqual([])
    expect(data.sessions).toEqual([])
  })
})
