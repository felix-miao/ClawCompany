import { NextRequest } from 'next/server'

jest.mock('next/server', () => {
  class NextResponse {
    status: number
    private _body: unknown
    constructor(body: unknown, init?: { status?: number }) {
      this._body = body
      this.status = init?.status ?? 200
    }
    json() {
      return Promise.resolve(this._body)
    }
    static json(body: unknown, init?: { status?: number }) {
      return new NextResponse(body, init)
    }
  }
  class NextRequest {
    url: string
    headers: { get: (name: string) => string | null }
    json: () => Promise<unknown>
    signal: AbortSignal
    constructor(input: string | URL, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.toString()
      this.headers = { get: () => null }
      this.json = () => Promise.resolve({})
      this.signal = new AbortController().signal
    }
  }
  return { NextRequest, NextResponse }
})

jest.mock('@/lib/gateway/client', () => {
  return {
    createGatewayClient: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      sessions_send: jest.fn(),
    })),
    __mockClient: {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      sessions_send: jest.fn(),
    },
  }
})

jest.mock('@/lib/security/utils', () => ({
  InputValidator: {
    sanitize: (str: string) => str.replace(/[`$]/g, ''),
  },
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
}))

jest.mock('@/lib/api/schemas', () => {
  const actual = jest.requireActual('@/lib/api/schemas')
  const z = require('zod')
  const VALID_EVENT_TYPES = new Set([
    'agent:status-change', 'agent:task-assigned', 'agent:task-completed',
    'agent:navigation-request', 'agent:emotion-change',
    'session:started', 'session:completed', 'session:progress',
    'connection:open', 'connection:close', 'connection:error',
    'task:assigned', 'task:progress', 'task:completed', 'task:failed', 'task:handover',
    'task:submitted', 'task:started',
    'openclaw:send',
    'workflow:started', 'workflow:completed',
  ])
  return {
    ...actual,
    GameEventPostSchema: z.object({
      type: z.string().min(1).refine((t: string) => VALID_EVENT_TYPES.has(t), 'Invalid event type'),
      timestamp: z.number().optional(),
      agentId: z.string().optional(),
    }).passthrough(),
  }
})

jest.mock('@/lib/gateway/executor', () => ({
  getAgentExecutor: jest.fn(() => ({
    isConnected: jest.fn().mockReturnValue(false),
    connect: jest.fn().mockResolvedValue(undefined),
    executeDevAgent: jest.fn().mockResolvedValue({
      success: false,
      error: 'Mock mode',
    }),
  })),
}))

jest.mock('@/lib/llm/factory', () => ({
  getLLMProvider: jest.fn().mockReturnValue(null),
}))

import { GameEventStore, resetGameEventStore, setGameEventStore, createGameEventStore } from '@/game/data/GameEventStore'
import { POST as GameEventsPOST } from '@/app/api/game-events/route'
import { POST as SendPOST } from '@/app/api/openclaw/send/route'
import { Orchestrator } from '@/lib/orchestrator/index'
import { AgentManager } from '@/lib/agents/manager'
import { TaskManager } from '@/lib/tasks/manager'
import { ChatManager } from '@/lib/chat/manager'
import { SandboxedFileWriter } from '@/lib/security/sandbox'
import { AgentRole, AgentResponse, AgentContext, Task } from '@/lib/core/types'
import { __mockClientWithJest as __mockClient } from '@/lib/gateway/client'
import type { GameEvent } from '@/game/types/GameEvents'

const API_KEY = 'test-api-key-12345678901234567890'

function createMockRequest(body: Record<string, unknown>, options?: { noAuth?: boolean }) {
  const headers: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    'content-type': 'application/json',
    ...(options?.noAuth ? {} : { 'x-api-key': API_KEY }),
  }
  return {
    url: 'http://localhost/api/game-events',
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

function createSendMockRequest(body: Record<string, unknown>, options?: { noAuth?: boolean }) {
  const headers: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    'content-type': 'application/json',
    ...(options?.noAuth ? {} : { 'x-api-key': API_KEY }),
  }
  return {
    url: 'http://localhost/api/openclaw/send',
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

describe('Task Lifecycle E2E Integration', () => {
  let testStore: GameEventStore
  let orchestrator: Orchestrator
  let mockAgentManager: jest.Mocked<AgentManager>
  let mockChatManager: jest.Mocked<ChatManager>
  let mockSandboxedWriter: jest.Mocked<SandboxedFileWriter>
  let realTaskManager: TaskManager
  const executionLog: Array<{ role: AgentRole | 'user' | 'system'; action: string; timestamp: number }> = []

  beforeAll(() => {
    process.env.AGENT_API_KEY = API_KEY
  })

  afterAll(() => {
    delete process.env.AGENT_API_KEY
  })

  beforeEach(() => {
    jest.clearAllMocks()
    executionLog.length = 0
    testStore = createGameEventStore(100)
    setGameEventStore(testStore)
    realTaskManager = new TaskManager('e2e-test')

    mockAgentManager = {
      getAgent: jest.fn(),
      getAllAgents: jest.fn(),
      executeAgent: jest.fn(),
      executeReviewPipeline: jest.fn(),
      getAgentInfo: jest.fn(),
    } as unknown as jest.Mocked<AgentManager>

    // Make executeReviewPipeline delegate to executeAgent('review') for backward compat
    ;(mockAgentManager.executeReviewPipeline as jest.Mock).mockImplementation(
      async (task: Task, context: AgentContext) => {
        const reviewResult = await (mockAgentManager.executeAgent as jest.Mock)('review', task, context)
        return { reviewResult, daTriggered: false }
      }
    )

    const chatMessages: Array<{ agent: 'user' | AgentRole; content: string; timestamp: Date }> = []
    mockChatManager = {
      sendUserMessage: jest.fn((msg: string) => {
        chatMessages.push({ agent: 'user', content: msg, timestamp: new Date() })
      }),
      broadcast: jest.fn((agent: AgentRole, msg: string) => {
        chatMessages.push({ agent, content: msg, timestamp: new Date() })
      }),
      getHistory: jest.fn(() => [...chatMessages]),
      clearHistory: jest.fn(() => { chatMessages.length = 0 }),
      addMessage: jest.fn(),
      getMessage: jest.fn(),
    } as unknown as jest.Mocked<ChatManager>

    mockSandboxedWriter = {
      writeFile: jest.fn().mockResolvedValue({ success: true, warnings: [] }),
      readFile: jest.fn(),
      deleteFile: jest.fn(),
      listFiles: jest.fn().mockResolvedValue({ success: true, files: [] }),
      exists: jest.fn().mockResolvedValue(false),
      validatePath: jest.fn().mockReturnValue({ allowed: true, sanitizedPath: 'test' }),
      validateContent: jest.fn().mockReturnValue({ allowed: true }),
      readAllowed: jest.fn().mockResolvedValue({ success: true }),
      getSandboxDir: jest.fn().mockReturnValue('/sandbox'),
      getAllowedExtensions: jest.fn().mockReturnValue(['.js', '.ts', '.tsx']),
    } as unknown as jest.Mocked<SandboxedFileWriter>

    jest.spyOn(realTaskManager, 'updateTaskStatus').mockImplementation(
      (taskId: string, status: string) => {
        const task = realTaskManager.getTask(taskId)
        if (task) {
          ;(task as { status: string }).status = status
          task.updatedAt = new Date()
        }
        return task
      }
    )

    orchestrator = new Orchestrator('e2e-test-project', { maxRetries: 1, initialDelay: 10, maxDelay: 10 }, {}, {}, {
      agentManager: mockAgentManager,
      taskManager: realTaskManager,
      chatManager: mockChatManager,
      sandboxedWriter: mockSandboxedWriter,
    })
  })

  afterEach(() => {
    resetGameEventStore()
  })

  const setupDefaultAgentResponses = () => {
    mockAgentManager.executeAgent.mockImplementation(
      async (role: AgentRole): Promise<AgentResponse> => {
        executionLog.push({ role, action: 'executeAgent', timestamp: Date.now() })

        switch (role) {
          case 'pm':
            return {
              agent: 'pm',
              message: '任务分析完成，已拆分为开发任务',
              tasks: [
                {
                  title: '创建 hello world 页面',
                  description: '创建一个简单的 hello world 页面',
                  assignedTo: 'dev',
                  status: 'pending',
                  dependencies: [],
                  files: [],
                },
                {
                  title: '编写测试用例',
                  description: '为 hello world 页面编写测试',
                  assignedTo: 'tester',
                  status: 'pending',
                  dependencies: [],
                  files: [],
                },
              ],
              status: 'success',
            }
          case 'dev':
            return {
              agent: 'dev',
              message: '已完成代码实现',
              files: [
                {
                  path: 'src/app/hello/page.tsx',
                  content: 'export default function HelloPage() { return <h1>Hello World</h1> }',
                  action: 'create' as const,
                },
              ],
              status: 'success',
            }
          case 'tester':
            return {
              agent: 'tester',
              message: '测试用例已生成',
              files: [
                {
                  path: 'src/app/hello/page.test.tsx',
                  content: 'describe("HelloPage", () => { it("renders", () => {}) })',
                  action: 'create' as const,
                },
              ],
              status: 'success',
            }
          case 'review':
            return {
              agent: 'review',
              message: '代码审查通过',
              status: 'success',
            }
          default:
            throw new Error(`Unknown role: ${role}`)
        }
      }
    )
  }

  describe('1. User submits task via POST /api/game-events', () => {
    it('should accept task submission and store event', async () => {
      const taskEvent = {
        type: 'task:submitted' as const,
        taskId: 'task-123',
        title: '创建 hello world 页面',
        description: '用户请求创建一个 hello world 页面',
        userId: 'user-1',
      }

      const request = createMockRequest(taskEvent)
      const response = await GameEventsPOST(request)

      expect(response.status).toBe(200)

      const data = await (response as unknown as { json: () => Promise<{ success: boolean; event: GameEvent }> }).json()
      expect(data.success).toBe(true)
      expect(data.event.type).toBe('task:submitted')
      expect(data.event.taskId).toBe('task-123')

      const events = testStore.getEvents()
      expect(events).toHaveLength(1)
      expect(events[0].taskId).toBe('task-123')
    })

    it('should reject invalid event type', async () => {
      const invalidEvent = {
        type: 'invalid:event' as any,
        timestamp: Date.now(),
      }

      const request = createMockRequest(invalidEvent)
      const response = await GameEventsPOST(request)

      expect(response.status).toBe(400)
    })
  })

  describe('2. Game Event System verification', () => {
    it('should broadcast events to subscribers', async () => {
      const callback = jest.fn()
      testStore.subscribe(callback)

      const event = {
        type: 'task:submitted' as const,
        taskId: 'task-456',
        title: 'Test task',
        userId: 'user-1',
      }

      testStore.push(event)
      expect(callback).toHaveBeenCalledWith(event)
    })

    it('should limit events to maxEvents', () => {
      const smallStore = createGameEventStore(3)

      for (let i = 0; i < 5; i++) {
        smallStore.push({
          type: 'task:submitted' as const,
          taskId: `task-${i}`,
          title: `Task ${i}`,
          userId: 'user-1',
        })
      }

      const events = smallStore.getEvents()
      expect(events).toHaveLength(3)
    })

    it('should filter events by timestamp', () => {
      testStore.push({ type: 'task:submitted' as const, taskId: 't1', title: 'T1', userId: 'u1', timestamp: 100 })
      testStore.push({ type: 'task:submitted' as const, taskId: 't2', title: 'T2', userId: 'u1', timestamp: 200 })
      testStore.push({ type: 'task:submitted' as const, taskId: 't3', title: 'T3', userId: 'u1', timestamp: 300 })

      const filtered = testStore.getEvents(150)
      expect(filtered).toHaveLength(2)
    })
  })

  describe('3. Orchestrator Scheduling - PM → Dev → Tester → Reviewer', () => {
    it('should dispatch tasks through full chain', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('创建一个带测试的 hello world 页面')

      expect(result.success).toBe(true)

      const executedRoles = executionLog.filter(l => l.action === 'executeAgent').map(l => l.role as string)
      expect(executedRoles).toContain('pm')
      expect(executedRoles).toContain('dev')
      expect(executedRoles).toContain('tester')
      expect(executedRoles).toContain('review')

      const pmIdx = executedRoles.indexOf('pm')
      const devIdx = executedRoles.indexOf('dev')
      const testerIdx = executedRoles.indexOf('tester')
      const reviewIdx = executedRoles.indexOf('review')

      expect(pmIdx).toBeLessThan(devIdx)
      expect(devIdx).toBeLessThan(testerIdx)
      expect(testerIdx).toBeLessThan(reviewIdx)
    })

    it('should execute tasks without tester when not needed', async () => {
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole): Promise<AgentResponse> => {
          executionLog.push({ role, action: 'executeAgent', timestamp: Date.now() })

          if (role === 'pm') {
            return {
              agent: 'pm',
              message: '任务分析完成',
              tasks: [
                {
                  title: '创建页面',
                  description: '创建页面',
                  assignedTo: 'dev',
                  status: 'pending',
                  dependencies: [],
                  files: [],
                },
              ],
              status: 'success',
            }
          }
          if (role === 'dev') {
            return { agent: 'dev', message: 'Done', status: 'success' }
          }
          if (role === 'review') {
            return { agent: 'review', message: 'Review done', status: 'success' }
          }
          throw new Error(`Unexpected role: ${role}`)
        }
      )

      const result = await orchestrator.executeUserRequest('简单任务')

      expect(result.success).toBe(true)
      const roles = executionLog.filter(l => l.action === 'executeAgent').map(l => l.role as string)
      expect(roles).toContain('pm')
      expect(roles).toContain('dev')
      expect(roles).toContain('review')
      expect(roles).not.toContain('tester')
    })

    it('should handle orchestrator failure gracefully', async () => {
      mockAgentManager.executeAgent.mockRejectedValue(new Error('Network error'))

      const result = await orchestrator.executeUserRequest('失败任务')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('4. sessions_send API verification', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should send message with correct sessionKey', async () => {
      __mockClient.sessions_send.mockResolvedValue({
        status: 'sent',
        messageId: 'msg-123',
      })

      const request = createSendMockRequest({
        sessionKey: 'agent:main:subagent:dev-001',
        message: 'Execute task: create hello world page',
      })

      const response = await SendPOST(request)
      const data = await (response as unknown as { json: () => Promise<{ success: boolean; result: unknown }> }).json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(__mockClient.sessions_send).toHaveBeenCalledWith(
        'agent:main:subagent:dev-001',
        'Execute task: create hello world page'
      )
    })

    it('should return 400 when sessionKey is missing', async () => {
      const request = createSendMockRequest({
        message: 'test message',
      })

      const response = await SendPOST(request)
      const data = await (response as unknown as { json: () => Promise<{ success: boolean; error: string }> }).json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should return 400 when message is missing', async () => {
      const request = createSendMockRequest({
        sessionKey: 'agent:main:subagent:test',
      })

      const response = await SendPOST(request)
      const data = await (response as unknown as { json: () => Promise<{ success: boolean; error: string }> }).json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should handle gateway connection errors', async () => {
      __mockClient.sessions_send.mockRejectedValue(new Error('Connection failed'))

      const request = createSendMockRequest({
        sessionKey: 'agent:main:subagent:test',
        message: 'test',
      })

      const response = await SendPOST(request)

      expect(response.status).toBe(500)
    })
  })

  describe('5. Result return verification', () => {
    it('should return correct tasks in result', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('创建 hello world 页面')

      expect(result.success).toBe(true)
      expect(result.tasks).toBeDefined()
      expect(result.tasks.length).toBeGreaterThan(0)

      const devTask = result.tasks.find(t => t.assignedTo === 'dev')
      expect(devTask).toBeDefined()
      expect(devTask?.title).toBe('创建 hello world 页面')
    })

    it('should return correct files in result', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('创建页面')

      expect(result.success).toBe(true)
      expect(result.files).toBeDefined()
      expect(result.files!.length).toBeGreaterThan(0)

      const devFile = result.files!.find(f => f.path === 'src/app/hello/page.tsx')
      expect(devFile).toBeDefined()
      expect(devFile?.content).toContain('Hello World')
    })

    it('should return correct messages in result', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('测试消息')

      expect(result.success).toBe(true)
      expect(result.messages).toBeDefined()
      expect(result.messages.length).toBeGreaterThan(0)

      const pmMessages = result.messages.filter(m => m.agent === 'pm')
      expect(pmMessages.length).toBeGreaterThan(0)
    })

    it('should include workflow stats in result', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('测试统计')

      expect(result.success).toBe(true)
      expect(result.stats).toBeDefined()
      expect(result.stats!.totalTasks).toBeGreaterThan(0)
      expect(result.stats!.successfulTasks).toBeGreaterThan(0)
    })
  })

  describe('6. SSE State Sync verification', () => {
    it('should emit workflow events for SSE', () => {
      const workflowCallbacks: GameEvent[] = []

      const unsub = testStore.subscribe((event) => {
        if (event.type.startsWith('workflow:') || event.type.startsWith('task:')) {
          workflowCallbacks.push(event)
        }
      })

      testStore.push({
        type: 'workflow:started' as const,
        timestamp: Date.now(),
        userMessage: 'Test task',
      })

      testStore.push({
        type: 'task:started' as const,
        timestamp: Date.now() + 1,
        taskId: 'task-1',
        taskTitle: 'Test task',
        agentId: 'pm',
      })

      testStore.push({
        type: 'task:completed' as const,
        timestamp: Date.now() + 2,
        taskId: 'task-1',
        taskTitle: 'Test task',
        agentId: 'pm',
        result: 'success' as const,
        duration: 100,
      })

      testStore.push({
        type: 'workflow:completed' as const,
        timestamp: Date.now() + 3,
        success: true,
        completed: 1,
        total: 1,
        failed: 0,
      })

      expect(workflowCallbacks).toHaveLength(4)
      expect(workflowCallbacks[0].type).toBe('workflow:started')
      expect(workflowCallbacks[1].type).toBe('task:started')
      expect(workflowCallbacks[2].type).toBe('task:completed')
      expect(workflowCallbacks[3].type).toBe('workflow:completed')

      unsub()
    })

    it('should track agent status changes', () => {
      const agentCallbacks: GameEvent[] = []

      const unsub = testStore.subscribe((event) => {
        if (event.type.startsWith('agent:')) {
          agentCallbacks.push(event)
        }
      })

      testStore.push({
        type: 'agent:status-change' as const,
        timestamp: Date.now(),
        agentId: 'dev',
        status: 'busy',
      })

      testStore.push({
        type: 'agent:status-change' as const,
        timestamp: Date.now() + 1,
        agentId: 'dev',
        status: 'idle',
      })

      expect(agentCallbacks).toHaveLength(2)
      expect(agentCallbacks[0].status).toBe('busy')
      expect(agentCallbacks[1].status).toBe('idle')

      unsub()
    })
  })

  describe('Error scenarios', () => {
    it('should handle missing API key', async () => {
      const taskEvent = {
        type: 'task:submitted' as const,
        taskId: 'task-123',
        title: 'Test',
      }

      const headers: Record<string, string> = {
        'x-forwarded-for': '1.2.3.4',
        'content-type': 'application/json',
      }
      const request = {
        url: 'http://localhost/api/game-events',
        headers: { get: (name: string) => headers[name.toLowerCase()] || null },
        json: () => Promise.resolve(taskEvent),
      } as unknown as NextRequest

      const response = await GameEventsPOST(request)
      expect(response.status).toBe(401)
    })

    it('should handle orchestrator with task dependencies', async () => {
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole, task): Promise<AgentResponse> => {
          executionLog.push({ role, action: `executeAgent:${task.title}`, timestamp: Date.now() })
          return { agent: role, message: 'done', status: 'success' }
        }
      )

      const result = await orchestrator.executeUserRequest('多步骤任务')

      expect(result.success).toBe(true)
    })

    it('should handle file write failures', async () => {
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole): Promise<AgentResponse> => {
          if (role === 'pm') {
            return {
              agent: 'pm',
              message: 'Task created',
              tasks: [{ title: 'Task', description: 'Task', assignedTo: 'dev', status: 'pending', dependencies: [], files: [] }],
              status: 'success',
            }
          }
          if (role === 'dev') {
            return {
              agent: 'dev',
              message: 'Done',
              files: [{ path: 'test.ts', content: 'content', action: 'create' as const }],
              status: 'success',
            }
          }
          return { agent: role, message: 'done', status: 'success' }
        }
      )

      mockSandboxedWriter.writeFile.mockRejectedValue(new Error('Write failed'))

      const result = await orchestrator.executeUserRequest('File task')

      expect(result.success).toBe(true)
      expect(result.files).toBeDefined()
      expect(result.files!.length).toBeGreaterThan(0)
    })
  })
})
