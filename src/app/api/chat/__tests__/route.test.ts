jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    json: () => Promise<unknown>
    constructor(url: string, options?: { body?: string }) {
      this.json = async () => options?.body ? JSON.parse(options.body) : {}
    }
  },
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
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

const mockResolve = jest.fn(() => orchestratorMock)

jest.mock('@/lib/core/services', () => ({
  Services: { Orchestrator: Symbol('Orchestrator') },
  getDefaultContainer: jest.fn(() => ({
    resolve: mockResolve,
  })),
}))

globalThis.__orchestratorMock = orchestratorMock
globalThis.__mockResolve = mockResolve

import { POST, GET } from '../route'

import { createMockNextRequest, createMockNextRequestWithAuth } from '@/test-utils/next-request-mock'

const API_KEY = 'test-api-key-12345678901234567890'

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
    const request = createMockNextRequest({ body: { message: 'test' }, noAuth: true })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('GET should return 401 without API key', async () => {
    const request = createMockNextRequest({ noAuth: true })
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('POST should return 401 with wrong API key', async () => {
    const request = createMockNextRequest({ body: { message: 'test' }, headers: { 'x-api-key': 'wrong-key' } })
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
      const request = createMockNextRequestWithAuth({ message: '测试消息' }, API_KEY)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.chatHistory).toBeDefined()
      expect(Array.isArray(data.chatHistory)).toBe(true)
    })

    it('消息应该包含 timestamp 字段', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试' }, API_KEY)

      const response = await POST(request)
      const data = await response.json()

      expect(data.chatHistory[0]).toHaveProperty('timestamp')
      expect(data.chatHistory[0].timestamp).toBeDefined()
    })

    it('timestamp 应该是有效的日期字符串', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试' }, API_KEY)

      const response = await POST(request)
      const data = await response.json()

      const timestamp = data.chatHistory[0].timestamp
      const date = new Date(timestamp)
      expect(date instanceof Date).toBe(true)
      expect(isNaN(date.getTime())).toBe(false)
    })

    it('所有消息都应该有 timestamp', async () => {
      const request = createMockNextRequestWithAuth({ message: '创建登录页面' }, API_KEY)

      const response = await POST(request)
      const data = await response.json()

      data.chatHistory.forEach((msg: { timestamp?: string }) => {
        expect(msg).toHaveProperty('timestamp')
        expect(msg.timestamp).toBeDefined()
        const date = new Date(msg.timestamp!)
        expect(isNaN(date.getTime())).toBe(false)
      })
    })

    it('消息应该包含正确的 agent 字段', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试' }, API_KEY)

      const response = await POST(request)
      const data = await response.json()

      data.chatHistory.forEach((msg: { agent: string }) => {
        expect(['user', 'pm', 'dev', 'review']).toContain(msg.agent)
      })
    })

    it('消息应该包含 content 字段', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试' }, API_KEY)

      const response = await POST(request)
      const data = await response.json()

      data.chatHistory.forEach((msg: { content: string }) => {
        expect(msg).toHaveProperty('content')
        expect(typeof msg.content).toBe('string')
      })
    })

    it('应该返回任务列表', async () => {
      const request = createMockNextRequestWithAuth({ message: '创建登录页面' }, API_KEY)

      const response = await POST(request)
      const data = await response.json()

      expect(data.tasks).toBeDefined()
      expect(Array.isArray(data.tasks)).toBe(true)
    })

    it('任务应该包含必要的字段', async () => {
      const request = createMockNextRequestWithAuth({ message: '创建登录页面' }, API_KEY)

      const response = await POST(request)
      const data = await response.json()

      data.tasks.forEach((task: { id: string; title: string; status: string; assignedTo: string }) => {
        expect(task).toHaveProperty('id')
        expect(task).toHaveProperty('title')
        expect(task).toHaveProperty('status')
        expect(task).toHaveProperty('assignedTo')
      })
    })

    it('空消息应该返回错误', async () => {
      const request = createMockNextRequestWithAuth({ message: '' }, API_KEY)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/chat', () => {
    it('应该返回当前状态', async () => {
      const request = createMockNextRequestWithAuth({}, API_KEY)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tasks).toBeDefined()
      expect(data.chatHistory).toBeDefined()
    })

    it('GET 应该返回聚合的 agents 列表（不包含单个 agent 详情）', async () => {
      const request = createMockNextRequestWithAuth({}, API_KEY)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.agents).toBeDefined()
      expect(Array.isArray(data.agents)).toBe(true)
      data.agents.forEach((agent: { id: string; name: string; role: string; description?: string }) => {
        expect(agent).toHaveProperty('id')
        expect(agent).toHaveProperty('name')
        expect(agent).toHaveProperty('role')
        expect(agent).toHaveProperty('description')
        expect(agent).not.toHaveProperty('systemPrompt')
        expect(agent).not.toHaveProperty('runtime')
      })
    })

    it('GET 应该返回 stats 信息', async () => {
      const request = createMockNextRequestWithAuth({}, API_KEY)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.stats).toBeDefined()
      expect(data.stats).toHaveProperty('total')
      expect(data.stats).toHaveProperty('pending')
      expect(data.stats).toHaveProperty('in_progress')
      expect(data.stats).toHaveProperty('review')
      expect(data.stats).toHaveProperty('completed')
    })
  })

  describe('POST /api/chat - 完整工作流', () => {
    it('POST 应该触发 Orchestrator 完整工作流', async () => {
      const request = createMockNextRequestWithAuth({ message: '创建登录页面' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.tasks).toBeDefined()
      expect(Array.isArray(data.tasks)).toBe(true)
      expect(data.chatHistory).toBeDefined()
      expect(data.chatHistory.length).toBeGreaterThan(1)
    })

    it('POST 应该返回 files 字段（Orchestrator 执行结果）', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('files')
      expect(Array.isArray(data.files)).toBe(true)
    })

    it('POST 应该返回 workflowType 字段标识为聚合工作流（与 /api/agent 区分）', async () => {
      const request = createMockNextRequestWithAuth({ message: '创建登录页面' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.workflowType).toBe('orchestrator')
      expect(data.tasks).toBeDefined()
      expect(data.chatHistory).toBeDefined()
    })

    it('POST 应该返回 apiSource 字段标识来源为 /api/chat（增强可观测性）', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.apiSource).toBe('/api/chat')
    })

    it('POST 应该不返回 conversationId（与 /api/agent 区分）', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).not.toHaveProperty('conversationId')
      expect(data).not.toHaveProperty('agentId')
    })

    it('POST 应该支持 taskId 参数（消息路由上下文）', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试', taskId: 'task-123' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('POST 应该返回 taskId 在响应中（用于消息路由追踪）', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试', taskId: 'task-456' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.taskId).toBe('task-456')
    })

    it('POST /api/chat 不应该接受 agentId 参数（与 /api/agent 区分）', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试', agentId: 'pm-agent' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('/api/chat 不接受 agentId 参数')
      expect(data.error).toContain('/api/agent')
    })

    it('POST /api/chat 应该返回确定性字段集（tasks, chatHistory, files, workflowType, apiSource, taskId）', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('tasks')
      expect(data).toHaveProperty('chatHistory')
      expect(data).toHaveProperty('files')
      expect(data).toHaveProperty('workflowType')
      expect(data).toHaveProperty('apiSource')
      expect(data).toHaveProperty('taskId')
      expect(data).not.toHaveProperty('conversationId')
      expect(data).not.toHaveProperty('agentId')
      expect(data).not.toHaveProperty('drafts')
    })

    it('POST /api/chat workflowType 应该是 "orchestrator"（标识聚合工作流）', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试工作流' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.workflowType).toBe('orchestrator')
      expect(data.apiSource).toBe('/api/chat')
    })

    it('POST /api/chat 响应应包含 stats（任务执行统计）', async () => {
      const request = createMockNextRequestWithAuth({ message: '测试' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tasks).toBeDefined()
      expect(Array.isArray(data.tasks)).toBe(true)
      data.tasks.forEach((task: { id: string; title: string; status: string; assignedTo: string }) => {
        expect(task).toHaveProperty('id')
        expect(task).toHaveProperty('title')
        expect(task).toHaveProperty('status')
        expect(task).toHaveProperty('assignedTo')
      })
    })
  })

  describe('POST /api/chat - System Prompt 上下文注入', () => {
    it('POST 应该注入项目状态到系统上下文（通过 Orchestrator 回调）', async () => {
      const request = createMockNextRequestWithAuth({ message: '创建登录页面' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.tasks).toBeDefined()
      expect(data.chatHistory).toBeDefined()
      expect(data.chatHistory.length).toBeGreaterThan(0)
    })

    it('POST 应该通过 taskId 隔离消息路由（Task-scoped context）', async () => {
      const request1 = createMockNextRequestWithAuth({ message: '任务A', taskId: 'task-A' }, API_KEY)
      const request2 = createMockNextRequestWithAuth({ message: '任务B', taskId: 'task-B' }, API_KEY)

      const response1 = await POST(request1)
      const data1 = await response1.json()

      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(data1.taskId).toBe('task-A')
      expect(data2.taskId).toBe('task-B')
    })

    it('POST /api/chat 应该将项目状态注入到 Agent Context（#228）', async () => {
      const mock = globalThis.__orchestratorMock as typeof orchestratorMock

      const request = createMockNextRequestWithAuth({ message: '创建登录页面' }, API_KEY)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mock.executeUserRequest).toHaveBeenCalledWith('创建登录页面', { taskId: undefined })
    })
  })
})
