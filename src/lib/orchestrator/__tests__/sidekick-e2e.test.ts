import { Orchestrator } from '../index'
import { AgentManager } from '../../agents/manager'
import { ChatManager } from '../../chat/manager'
import { TaskManager } from '../../tasks/manager'
import { SandboxedFileWriter } from '../../security/sandbox'
import { AgentRole, Task, AgentResponse } from '../../core/types'

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

describe('E2E - Sidekick Task Dispatch Workflow', () => {
  let orchestrator: Orchestrator
  let mockAgentManager: jest.Mocked<AgentManager>
  let mockChatManager: jest.Mocked<ChatManager>
  let mockSandboxedWriter: jest.Mocked<SandboxedFileWriter>
  let realTaskManager: TaskManager

  const executionLog: Array<{ role: AgentRole | 'user' | 'system'; action: string; timestamp: number }> = []

  beforeEach(() => {
    jest.clearAllMocks()
    executionLog.length = 0
    realTaskManager = new TaskManager('e2e-test')

    // Mock AgentManager
    mockAgentManager = {
      getAgent: jest.fn(),
      getAllAgents: jest.fn(),
      executeAgent: jest.fn(),
      getAgentInfo: jest.fn(),
    } as jest.Mocked<AgentManager>

    // Mock ChatManager — use real array to capture messages
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

    // Mock SandboxedFileWriter
    mockSandboxedWriter = {
      writeFile: jest.fn().mockResolvedValue({ success: true, warnings: [] }),
      readFile: jest.fn(),
      deleteFile: jest.fn(),
      listFiles: jest.fn().mockResolvedValue([]),
      exists: jest.fn().mockResolvedValue(false),
    } as jest.Mocked<SandboxedFileWriter>

    // Allow all status transitions for testing (bypass state machine)
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

    orchestrator = new Orchestrator('e2e-test-project', {}, {}, {}, {
      agentManager: mockAgentManager,
      taskManager: realTaskManager,
      chatManager: mockChatManager,
      sandboxedWriter: mockSandboxedWriter,
    })
  })

  // ─── Helper: default agent responses ───
  const setupDefaultAgentResponses = () => {
    mockAgentManager.executeAgent.mockImplementation(
      async (role: AgentRole, task: Task): Promise<AgentResponse> => {
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
                  dependencies: [],
                  files: [],
                  status: 'pending',
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
          case 'review':
            return {
              agent: 'review',
              message: '代码审查通过',
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
          default:
            throw new Error(`Unknown role: ${role}`)
        }
      }
    )
  }

  // ═══════════════════════════════════════════
  // Test Suite: Complete workflow
  // ═══════════════════════════════════════════
  describe('Complete workflow: Sidekick → PM → Developer → Reviewer', () => {
    it('should dispatch task through full chain: sidekick receives request, calls PM, then dev, then reviewer', async () => {
      setupDefaultAgentResponses()

      const userRequest = '创建一个 hello world 页面'
      const result = await orchestrator.executeUserRequest(userRequest)

      expect(result.success).toBe(true)
      expect(mockChatManager.sendUserMessage).toHaveBeenCalledWith(userRequest)

      // Verify execution order: PM → Dev → Review
      const executedRoles = executionLog.filter(l => l.action === 'executeAgent').map(l => l.role as string)
      expect(executedRoles).toContain('pm')
      expect(executedRoles).toContain('dev')
      expect(executedRoles).toContain('review')

      // Verify tasks were created and tracked
      expect(result.tasks.length).toBeGreaterThan(0)
      const devTask = result.tasks.find(t => t.assignedTo === 'dev')
      expect(devTask).toBeDefined()
      expect(devTask?.status).toBe('completed')

      // Verify messages captured
      expect(result.messages.length).toBeGreaterThan(0)
      const pmMessages = result.messages.filter(m => m.agent === 'pm')
      expect(pmMessages.length).toBeGreaterThan(0)

      // Verify files
      expect(result.files).toBeDefined()
      expect(result.files!.length).toBeGreaterThan(0)
      expect(result.files![0].path).toBe('src/app/hello/page.tsx')
    })

    it('should handle workflow with tester agent included', async () => {
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole): Promise<AgentResponse> => {
          executionLog.push({ role, action: 'executeAgent', timestamp: Date.now() })

          if (role === 'pm') {
            return {
              agent: 'pm',
              message: '任务分析完成，需要开发、测试和审查',
              tasks: [
                {
                  title: '创建 hello world 页面',
                  description: '创建一个简单的 hello world 页面',
                  assignedTo: 'dev',
                  dependencies: [],
                  files: [],
                  status: 'pending',
                },
                {
                  title: '编写测试用例',
                  description: '为 hello world 页面编写测试',
                  assignedTo: 'tester',
                  dependencies: [],
                  files: [],
                  status: 'pending',
                },
              ],
              status: 'success',
            }
          }
          if (role === 'dev') {
            return {
              agent: 'dev',
              message: '代码实现完成',
              files: [{ path: 'src/app/hello/page.tsx', content: 'content', action: 'create' as const }],
              status: 'success',
            }
          }
          if (role === 'tester') {
            return {
              agent: 'tester',
              message: '测试用例已生成',
              files: [{ path: 'src/app/hello/page.test.tsx', content: 'test', action: 'create' as const }],
              status: 'success',
            }
          }
          if (role === 'review') {
            return { agent: 'review', message: '审查通过', status: 'success' }
          }
          throw new Error(`Unknown role: ${role}`)
        }
      )

      const result = await orchestrator.executeUserRequest('创建一个带测试的 hello world 页面')

      expect(result.success).toBe(true)

      const executedRoles = executionLog.filter(l => l.action === 'executeAgent').map(l => l.role as string)
      expect(executedRoles).toContain('pm')
      expect(executedRoles).toContain('dev')
      expect(executedRoles).toContain('tester')
      expect(executedRoles).toContain('review')

      // Verify tester task exists and completed
      const testerTask = result.tasks.find(t => t.assignedTo === 'tester')
      expect(testerTask).toBeDefined()
      expect(testerTask?.status).toBe('completed')
    })

    it('should correctly handle task dependencies', async () => {
      const executionOrder: string[] = []

      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole, task: Task): Promise<AgentResponse> => {
          executionOrder.push(`${role}:${task.title}`)
          executionLog.push({ role, action: 'executeAgent', timestamp: Date.now() })

          if (role === 'pm') {
            return {
              agent: 'pm',
              message: '任务分析完成',
              tasks: [
                {
                  title: '步骤1',
                  description: '创建基础组件',
                  assignedTo: 'dev',
                  dependencies: [],
                  files: [],
                  status: 'pending',
                },
                {
                  title: '步骤2',
                  description: '在基础组件上添加业务逻辑',
                  assignedTo: 'dev',
                  dependencies: ['步骤1'],
                  files: [],
                  status: 'pending',
                },
                {
                  title: '步骤3',
                  description: '集成测试',
                  assignedTo: 'dev',
                  dependencies: ['步骤2'],
                  files: [],
                  status: 'pending',
                },
              ],
              status: 'success',
            }
          }

          return {
            agent: role,
            message: `${role} done`,
            status: 'success',
          }
        }
      )

      const result = await orchestrator.executeUserRequest('多步骤任务')

      expect(result.success).toBe(true)

      const devExecutions = executionOrder.filter(o => o.startsWith('dev:'))
      expect(devExecutions.indexOf('dev:步骤1')).toBeLessThan(
        devExecutions.indexOf('dev:步骤2')
      )
      expect(devExecutions.indexOf('dev:步骤2')).toBeLessThan(
        devExecutions.indexOf('dev:步骤3')
      )
    })

    it('should save files returned by dev agent', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('创建一个页面')

      expect(result.success).toBe(true)
      expect(result.files).toBeDefined()
      expect(result.files!.length).toBeGreaterThan(0)

      expect(mockSandboxedWriter.writeFile).toHaveBeenCalledWith(
        'src/app/hello/page.tsx',
        'export default function HelloPage() { return <h1>Hello World</h1> }'
      )
    })

    it('should broadcast messages from each agent', async () => {
      setupDefaultAgentResponses()

      await orchestrator.executeUserRequest('测试消息广播')

      expect(mockChatManager.broadcast).toHaveBeenCalled()
      const broadcastCalls = mockChatManager.broadcast.mock.calls

      const broadcastRoles = broadcastCalls.map((c: unknown[]) => c[0] as string)
      expect(broadcastRoles).toContain('pm')
      expect(broadcastRoles).toContain('dev')
      expect(broadcastRoles).toContain('review')
    })

    it('should track workflow events', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('测试事件追踪')

      expect(result.success).toBe(true)

      const eventBus = orchestrator.getEventBus()
      const eventHistory = eventBus.getHistory()

      expect(eventHistory.find(e => e.type === 'workflow:started')).toBeDefined()
      expect(eventHistory.filter(e => e.type === 'task:started').length).toBeGreaterThan(0)
      expect(eventHistory.filter(e => e.type === 'task:completed').length).toBeGreaterThan(0)
      expect(eventHistory.find(e => e.type === 'workflow:completed')).toBeDefined()
    })

    it('should return workflow statistics', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('测试统计')

      expect(result.success).toBe(true)
      expect(result.stats).toBeDefined()
      expect(result.stats!.totalTasks).toBeGreaterThan(0)
      expect(result.stats!.successfulTasks).toBeGreaterThan(0)
      expect(result.stats!.failedTasks).toBe(0)
    })

    it('should handle workflow failure gracefully', async () => {
      mockAgentManager.executeAgent.mockImplementation(async (role: AgentRole): Promise<AgentResponse> => {
        if (role === 'pm') {
          return {
            agent: 'pm',
            message: 'PM done',
            tasks: [
              { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [], status: 'pending' },
            ],
            status: 'success',
          }
        }
        if (role === 'dev') {
          throw new Error('Dev agent failed')
        }
        return { agent: role, message: 'done', status: 'success' }
      })

      const result = await orchestrator.executeUserRequest('测试失败处理')

      expect(result.success).toBe(false)
      expect(result.failedTasks).toBeDefined()
      expect(result.failedTasks!.length).toBeGreaterThan(0)
    }, 15000)

    it('should retry failed agent execution', async () => {
      let attemptCount = 0

      mockAgentManager.executeAgent.mockImplementation(async (role: AgentRole): Promise<AgentResponse> => {
        if (role === 'pm') {
          attemptCount++
          if (attemptCount < 3) {
            throw new Error('Temporary failure')
          }
          return {
            agent: 'pm',
            message: 'Success after retries',
            tasks: [{ title: 'Task', description: 'Task', assignedTo: 'dev', dependencies: [], files: [], status: 'pending' }],
            status: 'success',
          }
        }
        return { agent: role, message: 'done', status: 'success' }
      })

      const result = await orchestrator.executeUserRequest('测试重试')

      expect(result.success).toBe(true)
      expect(attemptCount).toBeGreaterThanOrEqual(3)
    })

    it('should support parallel execution of independent tasks', async () => {
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole, task: Task): Promise<AgentResponse> => {
          executionLog.push({ role, action: `executeAgent:${task.title}`, timestamp: Date.now() })
          return { agent: role, message: `${task.title} done`, status: 'success' }
        }
      )

      const result = await orchestrator.executeUserRequest('并行任务')

      expect(result.success).toBe(true)
    })

    it('should clear state on reset', async () => {
      setupDefaultAgentResponses()

      await orchestrator.executeUserRequest('测试重置')

      orchestrator.reset()

      expect(realTaskManager.getAllTasks()).toHaveLength(0)
    })
  })

  // ═══════════════════════════════════════════
  // Test Suite: Sidekick entry point integration
  // ═══════════════════════════════════════════
  describe('Sidekick entry point integration', () => {
    it('should accept user request from sidekick entry point', async () => {
      setupDefaultAgentResponses()

      const sidekickMessage = '请帮我创建一个简单的登录页面，包含用户名和密码输入框，以及登录按钮'

      const result = await orchestrator.executeUserRequest(sidekickMessage)

      expect(result.success).toBe(true)
      expect(mockChatManager.sendUserMessage).toHaveBeenCalledWith(sidekickMessage)
    })

    it('should handle natural language task descriptions', async () => {
      setupDefaultAgentResponses()

      const naturalLanguageRequest = '我需要一个能够显示当前时间的时钟组件，最好有多种主题样式可以切换'

      const result = await orchestrator.executeUserRequest(naturalLanguageRequest)

      expect(result.success).toBe(true)
      expect(result.tasks.length).toBeGreaterThan(0)
    })

    it('should provide meaningful error messages on failure', async () => {
      mockAgentManager.executeAgent.mockRejectedValue(new Error('Network error'))

      const result = await orchestrator.executeUserRequest('测试错误消息')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    }, 15000)
  })
})
