jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    json: () => Promise<any>
    constructor(url: string, options?: any) {
      this.json = async () => options?.body ? JSON.parse(options.body) : {}
    }
  },
  NextResponse: {
    json: (data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/security/utils', () => ({
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
  InputValidator: {
    validateAgentId: jest.fn(() => true),
    validateMessage: (message: string) => {
      if (!message || message.trim().length === 0) {
        return { valid: false, error: 'Message cannot be empty' }
      }
      return { valid: true }
    },
    validatePath: jest.fn(() => true),
  },
  SecurityManager: {
    getFromEnv: jest.fn(() => null),
  },
}))

jest.mock('@/lib/core/services', () => {
  const orchestratorMock = {
    executeUserRequest: jest.fn(() => Promise.resolve({
      success: true,
      messages: [
        { agent: 'user', content: '创建登录页面', timestamp: new Date().toISOString() },
        { agent: 'pm', content: '好的！我已经分析了需求。\n我将其拆分为以下 2 个子任务：', timestamp: new Date().toISOString() },
        { agent: 'dev', content: '我已完成创建表单组件的实现。', timestamp: new Date().toISOString() },
        { agent: 'review', content: '代码审查报告 - 审查通过', timestamp: new Date().toISOString() },
      ],
      tasks: [
        { id: 'task-1', title: '创建表单组件', status: 'completed', assignedTo: 'dev' },
        { id: 'task-2', title: '添加表单验证', status: 'completed', assignedTo: 'dev' },
      ],
      files: [],
      stats: {
        totalTasks: 2,
        successfulTasks: 2,
        failedTasks: 0,
        totalRetries: 0,
        executionTime: 1500,
      },
    })),
    getStatus: jest.fn(() => ({
      projectId: 'default',
      tasks: [],
      messages: [],
      stats: { total: 0, pending: 0, in_progress: 0, review: 0, completed: 0 },
    })),
    reset: jest.fn(),
  }
  return {
    Services: { Orchestrator: Symbol('Orchestrator') },
    getDefaultContainer: jest.fn(() => ({
      resolve: jest.fn(() => orchestratorMock),
    })),
  }
})

import { POST, GET } from '../route'

const API_KEY = 'test-api-key-12345678901234567890'

function createMockRequest(body: any, options?: { noAuth?: boolean }): any {
  const headers: Record<string, string> = {
    ...(options?.noAuth ? {} : { 'x-api-key': API_KEY }),
  }
  return {
    json: async () => body,
    headers: {
      get: (name: string) => headers[name] || null,
    },
  } as any
}

describe('Authentication', () => {
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

  it('POST should return 401 without API key', async () => {
    const request = createMockRequest({ message: 'test' }, { noAuth: true })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('GET should return 401 without API key', async () => {
    const request = createMockRequest({}, { noAuth: true })
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('POST should return 401 with wrong API key', async () => {
    const request = {
      json: async () => ({ message: 'test' }),
      headers: { get: (name: string) => name === 'x-api-key' ? 'wrong-key' : null },
    } as any
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(401)
  })
})

describe('Chat API', () => {
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
  })

  describe('POST /api/chat', () => {
    it('应该返回正确的消息格式', async () => {
      const request = createMockRequest({ message: '测试消息' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.chatHistory).toBeDefined()
      expect(Array.isArray(data.chatHistory)).toBe(true)
    })

    it('消息应该包含 timestamp 字段', async () => {
      const request = createMockRequest({ message: '测试' })

      const response = await POST(request)
      const data = await response.json()

      expect(data.chatHistory[0]).toHaveProperty('timestamp')
      expect(data.chatHistory[0].timestamp).toBeDefined()
    })

    it('timestamp 应该是有效的日期字符串', async () => {
      const request = createMockRequest({ message: '测试' })

      const response = await POST(request)
      const data = await response.json()

      const timestamp = data.chatHistory[0].timestamp
      const date = new Date(timestamp)
      expect(date instanceof Date).toBe(true)
      expect(isNaN(date.getTime())).toBe(false)
    })

    it('所有消息都应该有 timestamp', async () => {
      const request = createMockRequest({ message: '创建登录页面' })

      const response = await POST(request)
      const data = await response.json()

      data.chatHistory.forEach((msg: any) => {
        expect(msg).toHaveProperty('timestamp')
        expect(msg.timestamp).toBeDefined()
        const date = new Date(msg.timestamp)
        expect(isNaN(date.getTime())).toBe(false)
      })
    })

    it('消息应该包含正确的 agent 字段', async () => {
      const request = createMockRequest({ message: '测试' })

      const response = await POST(request)
      const data = await response.json()

      data.chatHistory.forEach((msg: any) => {
        expect(['user', 'pm', 'dev', 'review']).toContain(msg.agent)
      })
    })

    it('消息应该包含 content 字段', async () => {
      const request = createMockRequest({ message: '测试' })

      const response = await POST(request)
      const data = await response.json()

      data.chatHistory.forEach((msg: any) => {
        expect(msg).toHaveProperty('content')
        expect(typeof msg.content).toBe('string')
      })
    })

    it('应该返回任务列表', async () => {
      const request = createMockRequest({ message: '创建登录页面' })

      const response = await POST(request)
      const data = await response.json()

      expect(data.tasks).toBeDefined()
      expect(Array.isArray(data.tasks)).toBe(true)
    })

    it('任务应该包含必要的字段', async () => {
      const request = createMockRequest({ message: '创建登录页面' })

      const response = await POST(request)
      const data = await response.json()

      data.tasks.forEach((task: any) => {
        expect(task).toHaveProperty('id')
        expect(task).toHaveProperty('title')
        expect(task).toHaveProperty('status')
        expect(task).toHaveProperty('assignedTo')
      })
    })

    it('空消息应该返回错误', async () => {
      const request = createMockRequest({ message: '' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/chat', () => {
    it('应该返回当前状态', async () => {
      const request = createMockRequest({})
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tasks).toBeDefined()
      expect(data.chatHistory).toBeDefined()
    })
  })
})
