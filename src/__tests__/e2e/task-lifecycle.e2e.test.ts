import { Orchestrator } from '@/lib/orchestrator/index'
import { AgentManager } from '@/lib/agents/manager'
import { TaskManager } from '@/lib/tasks/manager'
import { ChatManager } from '@/lib/chat/manager'
import { SandboxedFileWriter } from '@/lib/security/sandbox'
import { AgentRole, AgentResponse, FileChange, Task, AgentContext } from '@/lib/core/types'

interface ExecutionLogEntry {
  role: AgentRole | 'user'
  action: string
  taskId?: string
  timestamp: number
}

describe('Task Lifecycle E2E', () => {
  let orchestrator: Orchestrator
  let mockAgentManager: jest.Mocked<AgentManager>
  let mockChatManager: jest.Mocked<ChatManager>
  let mockSandboxedWriter: jest.Mocked<SandboxedFileWriter>
  let realTaskManager: TaskManager
  let executionLog: ExecutionLogEntry[]

  beforeEach(() => {
    executionLog = []
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

  const setupDefaultAgentResponses = () => {
    mockAgentManager.executeAgent.mockImplementation(
      async (role: AgentRole, task: Task): Promise<AgentResponse> => {
        executionLog.push({ role, action: 'executeAgent', taskId: task.id, timestamp: Date.now() })

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

  describe('Normal Flow: Simple task completes successfully', () => {
    it('should complete full workflow from user request to result return', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('创建一个带测试的 hello world 页面')

      expect(result.success).toBe(true)
      expect(result.tasks.length).toBeGreaterThan(0)
      expect(result.messages.length).toBeGreaterThan(0)
      expect(result.files).toBeDefined()
      expect(result.files!.length).toBeGreaterThanOrEqual(1)
      expect(result.stats).toBeDefined()
      expect(result.stats!.totalTasks).toBe(2)
      expect(result.stats!.successfulTasks).toBe(2)
    })

    it('should execute agents in correct order: pm -> dev -> review', async () => {
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole, task: Task): Promise<AgentResponse> => {
          executionLog.push({ role, action: 'executeAgent', taskId: task.id, timestamp: Date.now() })

          if (role === 'pm') {
            return {
              agent: 'pm',
              message: 'Task analyzed',
              tasks: [{ title: 'Task', description: 'Task', assignedTo: 'dev', status: 'pending', dependencies: [], files: [] }],
              status: 'success',
            }
          }
          if (role === 'dev') {
            return { agent: 'dev', message: 'Done', status: 'success' }
          }
          if (role === 'review') {
            return { agent: 'review', message: 'Approved', status: 'success' }
          }
          throw new Error(`Unexpected role: ${role}`)
        }
      )

      await orchestrator.executeUserRequest('Simple task')

      const agentExecutions = executionLog.filter(e => e.action === 'executeAgent')
      const roles = agentExecutions.map(e => e.role)

      expect(roles).toEqual(['pm', 'dev', 'review'])
    })
  })

  describe('Status changes at each stage', () => {
    it('should verify task status transitions', async () => {
      const statusChanges: Array<{ taskId: string; status: string; timestamp: number }> = []

      jest.spyOn(realTaskManager, 'updateTaskStatus').mockImplementation(
        (taskId: string, status: string) => {
          statusChanges.push({ taskId, status, timestamp: Date.now() })
          const task = realTaskManager.getTask(taskId)
          if (task) {
            ;(task as { status: string }).status = status
            task.updatedAt = new Date()
          }
          return task
        }
      )

      setupDefaultAgentResponses()

      await orchestrator.executeUserRequest('Test task')

      const taskIds = [...new Set(statusChanges.map(s => s.taskId))]
      expect(taskIds.length).toBeGreaterThan(0)

      const hasCompletedStatus = statusChanges.some(s => s.status === 'completed')
      expect(hasCompletedStatus).toBe(true)
    })

    it('should emit workflow events', async () => {
      setupDefaultAgentResponses()

      const eventBus = orchestrator.getEventBus()
      const events: Array<{ type: string; data: Record<string, unknown> }> = []

      const unsubscribe = eventBus.subscribe((event) => {
        events.push({ type: event.type, data: event.data || {} })
      })

      await orchestrator.executeUserRequest('Test task')

      const eventTypes = events.map(e => e.type)
      expect(eventTypes).toContain('workflow:started')
      expect(eventTypes).toContain('task:started')
      expect(eventTypes).toContain('task:completed')
      expect(eventTypes).toContain('workflow:completed')

      unsubscribe()
    })
  })

  describe('Error handling: agent failure', () => {
    it('should handle PM agent failure gracefully', async () => {
      mockAgentManager.executeAgent.mockRejectedValue(new Error('PM service unavailable'))

      const result = await orchestrator.executeUserRequest('Task that will fail')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.message).toContain('PM')
    })

    it('should handle dev agent failure and still complete with review', async () => {
      let devAttempts = 0
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole, task: Task): Promise<AgentResponse> => {
          if (role === 'pm') {
            return {
              agent: 'pm',
              message: 'Task created',
              tasks: [{ title: 'Task', description: 'Task', assignedTo: 'dev', status: 'pending', dependencies: [], files: [] }],
              status: 'success',
            }
          }
          if (role === 'dev') {
            devAttempts++
            if (devAttempts <= 1) {
              throw new Error('Dev failed')
            }
            return { agent: 'dev', message: 'Done', status: 'success' }
          }
          if (role === 'review') {
            return { agent: 'review', message: 'Approved', status: 'success' }
          }
          throw new Error(`Unexpected role: ${role}`)
        }
      )

      orchestrator = new Orchestrator('e2e-test-project', { maxRetries: 1, initialDelay: 10, maxDelay: 10 }, {}, {}, {
        agentManager: mockAgentManager,
        taskManager: realTaskManager,
        chatManager: mockChatManager,
        sandboxedWriter: mockSandboxedWriter,
      })

      const result = await orchestrator.executeUserRequest('Task')

      expect(devAttempts).toBeGreaterThanOrEqual(2)
      expect(result.success).toBe(true)
    })

    it('should record failed tasks in result', async () => {
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
          throw new Error('Dev error')
        }
      )

      const result = await orchestrator.executeUserRequest('Task')

      expect(result.success).toBe(false)
      if (result.failedTasks) {
        expect(result.failedTasks.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Result aggregation', () => {
    it('should aggregate all messages from agents', async () => {
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole): Promise<AgentResponse> => {
          return { agent: role, message: `Message from ${role}`, status: 'success' }
        }
      )

      const result = await orchestrator.executeUserRequest('Test')

      const agentMessages = result.messages.filter(m => m.agent !== 'user')
      expect(agentMessages.length).toBeGreaterThan(0)
    })

    it('should aggregate all files from agents', async () => {
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole): Promise<AgentResponse> => {
          if (role === 'pm') {
            return {
              agent: 'pm',
              message: 'Done',
              tasks: [
                { title: 'T1', description: 'T1', assignedTo: 'dev', status: 'pending', dependencies: [], files: [] },
                { title: 'T2', description: 'T2', assignedTo: 'dev', status: 'pending', dependencies: [], files: [] },
              ],
              status: 'success',
            }
          }
          return {
            agent: role,
            message: 'Done',
            files: [{ path: `${role}.ts`, content: 'content', action: 'create' as const }],
            status: 'success',
          }
        }
      )

      const result = await orchestrator.executeUserRequest('Test')

      expect(result.files).toBeDefined()
      expect(result.files!.length).toBeGreaterThanOrEqual(2)
    })

    it('should include workflow stats', async () => {
      setupDefaultAgentResponses()

      const result = await orchestrator.executeUserRequest('Test')

      expect(result.stats).toEqual(expect.objectContaining({
        totalTasks: expect.any(Number),
        successfulTasks: expect.any(Number),
        failedTasks: expect.any(Number),
        totalRetries: expect.any(Number),
        executionTime: expect.any(Number),
      }))
    })
  })
})