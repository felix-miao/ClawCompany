/**
 * task-lifecycle-phase.test.ts
 * 
 * 任务生命周期端到端测试 - 阶段追踪版
 * 
 * 测试目标：用户提交需求 → agent 协作 → 结果返回的完整链路
 * 
 * 优势：通过明确的阶段追踪，让测试失败时能快速定位卡在哪个阶段：
 * - phase 1: 请求提交 (request submission)
 * - phase 2: 协作编排 (agent collaboration) 
 * - phase 3: 结果聚合 (result aggregation)
 */

import { Orchestrator } from '@/lib/orchestrator/index'
import { AgentManager } from '@/lib/agents/manager'
import { TaskManager } from '@/lib/tasks/manager'
import { ChatManager } from '@/lib/chat/manager'
import { SandboxedFileWriter } from '@/lib/security/sandbox'
import type { AgentRole, Task, AgentResponse, AgentContext } from '@/lib/core/types'

type LifecyclePhase = 'request_submitted' | 'pm_analyzing' | 'pm_completed' | 'dev_executing' | 'dev_completed' | 'review_executing' | 'review_completed' | 'result_aggregated'

interface PhaseRecord {
  phase: LifecyclePhase
  timestamp: number
  data?: Record<string, unknown>
}

jest.mock('@/lib/gateway/executor', () => ({
  getAgentExecutor: jest.fn(() => ({
    isConnected: jest.fn().mockReturnValue(false),
    connect: jest.fn().mockResolvedValue(undefined),
    executeDevAgent: jest.fn().mockResolvedValue({ success: false, error: 'Mock mode' }),
  })),
}))

jest.mock('@/lib/llm/factory', () => ({
  getLLMProvider: jest.fn().mockReturnValue(null),
}))

const FAST_RETRY = { maxRetries: 1, initialDelay: 1, maxDelay: 10, backoffMultiplier: 1 }

function makeTestOrchestrator() {
  const realTaskManager = new TaskManager('phase-test')

  const mockAgentManager = {
    getAgent: jest.fn(),
    getAllAgents: jest.fn(),
    executeAgent: jest.fn(),
    getAgentInfo: jest.fn(),
  } as unknown as jest.Mocked<AgentManager>

  const chatMessages: Array<{ agent: 'user' | AgentRole; content: string; timestamp: Date }> = []
  const mockChatManager = {
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

  const mockSandboxedWriter = {
    writeFile: jest.fn().mockResolvedValue({ success: true, warnings: [] }),
    readFile: jest.fn().mockResolvedValue(null),
    deleteFile: jest.fn(),
    listFiles: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(false),
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

  const orchestrator = new Orchestrator('phase-test-project', FAST_RETRY, {}, {}, {
    agentManager: mockAgentManager,
    taskManager: realTaskManager,
    chatManager: mockChatManager,
    sandboxedWriter: mockSandboxedWriter,
  })

  return { 
    orchestrator, 
    mockAgentManager, 
    mockChatManager, 
    mockSandboxedWriter, 
    realTaskManager,
    chatMessages 
  }
}

describe('Task Lifecycle - Phase Tracking', () => {
  let mocks: ReturnType<typeof makeTestOrchestrator>

  beforeEach(() => {
    jest.clearAllMocks()
    mocks = makeTestOrchestrator()
  })

  describe('完整生命周期 - 3阶段追踪', () => {
    it('should track all 3 phases: request → collaboration → result', async () => {
      const { orchestrator, mockAgentManager } = mocks
      const phases: PhaseRecord[] = []
      
      const recordPhase = (phase: LifecyclePhase, data?: Record<string, unknown>) => {
        phases.push({ phase, timestamp: Date.now(), data })
      }

      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole, task: Task): Promise<AgentResponse> => {
          if (role === 'pm') {
            recordPhase('pm_analyzing', { taskId: task.id, title: task.title })
            return {
              agent: 'pm',
              message: 'PM分析完成',
              tasks: [{
                title: '创建登录表单',
                description: '实现用户登录',
                assignedTo: 'dev',
                dependencies: [],
                files: [],
              }],
              status: 'success',
            }
          }

          if (role === 'dev') {
            recordPhase('dev_executing', { taskId: task.id })
            return {
              agent: 'dev',
              message: '登录表单已实现',
              files: [{
                path: 'src/components/LoginForm.tsx',
                content: 'export default function Login() { return <div>Login</div> }',
                action: 'create',
              }],
              status: 'success',
            }
          }

          if (role === 'review') {
            recordPhase('review_executing', { taskId: task.id })
            return {
              agent: 'review',
              message: '代码审查通过',
              status: 'success',
            }
          }

          throw new Error(`Unexpected role: ${role}`)
        }
      )

      recordPhase('request_submitted', { message: '创建一个登录组件' })
      const result = await orchestrator.executeUserRequest('创建一个登录组件')
      recordPhase('result_aggregated', { success: result.success })

      expect(phases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ phase: 'request_submitted' }),
          expect.objectContaining({ phase: 'pm_analyzing' }),
          expect.objectContaining({ phase: 'dev_executing' }),
          expect.objectContaining({ phase: 'review_executing' }),
          expect.objectContaining({ phase: 'result_aggregated' }),
        ])
      )

      const phaseOrder = phases.map(p => p.phase)
      expect(phaseOrder.indexOf('request_submitted')).toBeLessThan(phaseOrder.indexOf('pm_analyzing'))
      expect(phaseOrder.indexOf('pm_analyzing')).toBeLessThan(phaseOrder.indexOf('dev_executing'))
      expect(phaseOrder.indexOf('dev_executing')).toBeLessThan(phaseOrder.indexOf('review_executing'))
      expect(phaseOrder.indexOf('review_executing')).toBeLessThan(phaseOrder.indexOf('result_aggregated'))

      expect(result.success).toBe(true)
      expect(result.tasks?.length).toBeGreaterThan(0)
      expect(result.files?.length).toBeGreaterThan(0)
    })

    it('should fail at collaboration phase when PM fails', async () => {
      const { orchestrator, mockAgentManager } = mocks
      const phases: PhaseRecord[] = []
      
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole): Promise<AgentResponse> => {
          phases.push({ 
            phase: role === 'pm' ? 'pm_analyzing' : 'dev_executing', 
            timestamp: Date.now() 
          })
          
          if (role === 'pm') {
            throw new Error('PM agent failed')
          }
          return { agent: role, message: 'done', status: 'success' }
        }
      )

      phases.push({ phase: 'request_submitted', timestamp: Date.now() })
      const result = await orchestrator.executeUserRequest('创建一个登录组件')
      phases.push({ phase: 'result_aggregated', timestamp: Date.now() })

      expect(result.success).toBe(false)
      
      const hasPMFailure = phases.some(p => p.phase === 'pm_analyzing')
      expect(hasPMFailure).toBe(true)
      
      const phaseTypes = phases.map(p => p.phase)
      expect(phaseTypes).not.toContain('dev_executing')
      expect(phaseTypes).not.toContain('review_executing')
    })

    it('should fail at collaboration phase when Dev fails after retries', async () => {
      const { orchestrator, mockAgentManager } = mocks
      const phases: PhaseRecord[] = []
      let devAttempts = 0
      
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole, task: Task): Promise<AgentResponse> => {
          if (role === 'pm') {
            phases.push({ phase: 'pm_analyzing', timestamp: Date.now() })
            return {
              agent: 'pm',
              message: 'PM done',
              tasks: [{ title: 'Task', description: 'Task', assignedTo: 'dev', dependencies: [], files: [] }],
              status: 'success',
            }
          }

          if (role === 'dev') {
            devAttempts++
            phases.push({ phase: 'dev_executing', timestamp: Date.now(), data: { attempt: devAttempts } })
            throw new Error(`Dev attempt ${devAttempts} failed`)
          }

          if (role === 'review') {
            return { agent: 'review', message: 'Review done', status: 'success' }
          }

          throw new Error(`Unexpected role: ${role}`)
        }
      )

      phases.push({ phase: 'request_submitted', timestamp: Date.now() })
      const result = await orchestrator.executeUserRequest('创建一个组件')
      phases.push({ phase: 'result_aggregated', timestamp: Date.now() })

      expect(result.success).toBe(false)
      
      const devPhases = phases.filter(p => p.phase === 'dev_executing')
      expect(devPhases.length).toBeGreaterThan(1)
      
      const phaseTypes = phases.map(p => p.phase)
      expect(phaseTypes).not.toContain('review_executing')
    })

    it('should succeed through all phases with result containing all data', async () => {
      const { orchestrator, mockAgentManager } = mocks
      const phases: PhaseRecord[] = []
      
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole, task: Task): Promise<AgentResponse> => {
          if (role === 'pm') {
            return {
              agent: 'pm',
              message: 'PM分析',
              tasks: [
                { title: 'Task 1', description: 'Desc 1', assignedTo: 'dev', dependencies: [], files: [] },
                { title: 'Task 2', description: 'Desc 2', assignedTo: 'dev', dependencies: [], files: [] },
              ],
              status: 'success',
            }
          }

          if (role === 'dev') {
            return {
              agent: 'dev',
              message: 'Dev done',
              files: [{ path: 'src/file.ts', content: 'content', action: 'create' }],
              status: 'success',
            }
          }

          if (role === 'review') {
            return { agent: 'review', message: 'Review ok', status: 'success' }
          }

          throw new Error(`Unexpected role: ${role}`)
        }
      )

      phases.push({ phase: 'request_submitted', timestamp: Date.now() })
      const result = await orchestrator.executeUserRequest('多任务请求')
      phases.push({ phase: 'result_aggregated', timestamp: Date.now() })

      expect(result.success).toBe(true)
      expect(result.tasks).toBeDefined()
      expect(result.tasks!.length).toBeGreaterThanOrEqual(2)
      expect(result.files).toBeDefined()
      expect(result.files!.length).toBeGreaterThanOrEqual(1)
      expect(result.messages).toBeDefined()
      expect(result.messages!.length).toBeGreaterThan(0)
      expect(result.stats).toBeDefined()
      expect(result.stats!.totalTasks).toBeGreaterThanOrEqual(2)
      expect(result.stats!.successfulTasks).toBeGreaterThanOrEqual(2)
    })
  })

  describe('阶段失败定位', () => {
    it('should clearly identify which phase failed via result fields', async () => {
      const { orchestrator, mockAgentManager } = mocks
      
      mockAgentManager.executeAgent.mockRejectedValue(new Error('Network error'))

      const result = await orchestrator.executeUserRequest('测试请求')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBeDefined()
      
      expect(result.tasks).toBeDefined()
    })

    it('should include stats even when workflow fails', async () => {
      const { orchestrator, mockAgentManager } = mocks
      
      mockAgentManager.executeAgent.mockRejectedValue(new Error('Complete failure'))

      const result = await orchestrator.executeUserRequest('失败请求')

      expect(result.success).toBe(false)
      expect(result.stats).toBeDefined()
      expect(result.stats?.totalTasks).toBe(0)
      expect(result.stats?.failedTasks).toBe(1)
    })
  })

  describe('迭代场景下的阶段追踪', () => {
    it('should track multiple review iterations correctly', async () => {
      const { orchestrator, mockAgentManager } = mocks
      const phases: PhaseRecord[] = []
      let devCount = 0
      let reviewCount = 0
      
      mockAgentManager.executeAgent.mockImplementation(
        async (role: AgentRole): Promise<AgentResponse> => {
          if (role === 'pm') {
            return {
              agent: 'pm',
              message: 'PM done',
              tasks: [{ title: 'Task', description: 'Task', assignedTo: 'dev', dependencies: [], files: [] }],
              status: 'success',
            }
          }

          if (role === 'dev') {
            devCount++
            phases.push({ phase: 'dev_executing', timestamp: Date.now(), data: { iteration: devCount } })
            return {
              agent: 'dev',
              message: `Dev v${devCount}`,
              files: [{ path: 'src/a.ts', content: `v${devCount}`, action: 'create' }],
              status: 'success',
            }
          }

          if (role === 'review') {
            reviewCount++
            phases.push({ phase: 'review_executing', timestamp: Date.now(), data: { iteration: reviewCount } })
            
            if (reviewCount < 3) {
              return {
                agent: 'review',
                message: 'Needs changes',
                status: 'need_input',
              }
            }
            return { agent: 'review', message: 'Approved', status: 'success' }
          }

          throw new Error(`Unexpected role: ${role}`)
        }
      )

      phases.push({ phase: 'request_submitted', timestamp: Date.now() })
      const result = await orchestrator.executeUserRequest('需要迭代的任务')
      phases.push({ phase: 'result_aggregated', timestamp: Date.now() })

      expect(result.success).toBe(true)
      expect(devCount).toBe(3)
      expect(reviewCount).toBe(3)
      
      const devPhases = phases.filter(p => p.phase === 'dev_executing')
      const reviewPhases = phases.filter(p => p.phase === 'review_executing')
      
      expect(devPhases.length).toBe(3)
      expect(reviewPhases.length).toBe(3)
    })
  })
})
