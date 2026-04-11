import { Orchestrator, validateSubTasks } from '../index'

import type { Task, AgentContext, AgentResponse } from '@/lib/core/types'
import { agentManager } from '@/lib/agents/manager'
import { taskManager } from '@/lib/tasks/manager'
import { chatManager } from '@/lib/chat/manager'

jest.mock('@/lib/agents/manager')
jest.mock('@/lib/tasks/manager')
jest.mock('@/lib/chat/manager')

describe('Orchestrator - Edge Cases', () => {
  let orchestrator: Orchestrator

  const fastRetry = { maxRetries: 1, initialDelay: 1, maxDelay: 10, backoffMultiplier: 1 }

  afterEach(() => {
    jest.resetAllMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    orchestrator = new Orchestrator('test-edge', fastRetry)

    ;(chatManager.sendUserMessage as jest.Mock).mockImplementation(() => {})
    ;(chatManager.broadcast as jest.Mock).mockImplementation(() => {})
    ;(chatManager.getHistory as jest.Mock).mockReturnValue([])
    ;(chatManager.clearHistory as jest.Mock).mockImplementation(() => {})
    ;(taskManager.updateTaskStatus as jest.Mock).mockImplementation(() => {})
    ;(taskManager.clearTasks as jest.Mock).mockImplementation(() => {})
    ;(taskManager.getAllTasks as jest.Mock).mockReturnValue([])
    ;(taskManager.getStats as jest.Mock).mockReturnValue({
      total: 0, pending: 0, in_progress: 0, review: 0, done: 0,
    })
    // executeReviewPipeline delegates to executeAgent('review') for test compat
    ;(agentManager.executeReviewPipeline as jest.Mock).mockImplementation(
      async (task: Task, context: AgentContext) => {
        const reviewResult = await (agentManager.executeAgent as jest.Mock)('review', task, context)
        return { reviewResult: reviewResult as AgentResponse, daTriggered: false }
      }
    )
  })

  const makeTask = (id: string, deps: string[] = [], assignedTo: 'dev' | 'review' = 'dev') => ({
    id,
    title: `Task ${id}`,
    description: `Task ${id}`,
    assignedTo,
    dependencies: deps,
    files: [] as string[],
    status: 'pending' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  describe('empty user message', () => {
    it('should handle empty string user message', async () => {
      ;(taskManager.createTask as jest.Mock).mockReturnValue(makeTask('pm-task'))
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done',
        tasks: [],
      })

      const result = await orchestrator.executeUserRequest('')

      expect(result.success).toBe(true)
      expect(taskManager.createTask).toHaveBeenCalledWith('', '', 'pm', [], [])
    })

    it('should handle whitespace-only user message', async () => {
      ;(taskManager.createTask as jest.Mock).mockReturnValue(makeTask('pm-task'))
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done',
        tasks: [],
      })

      const result = await orchestrator.executeUserRequest('   ')

      expect(result.success).toBe(true)
    })
  })

  describe('PM returns malformed tasks', () => {
    it('should handle PM returning tasks as undefined', async () => {
      ;(taskManager.createTask as jest.Mock).mockReturnValue(makeTask('pm-task'))
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done',
        tasks: undefined,
      })

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(0)
    })

    it('should handle PM returning non-array tasks', async () => {
      ;(taskManager.createTask as jest.Mock).mockReturnValue(makeTask('pm-task'))
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done',
        tasks: 'not an array',
      })

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(0)
    })

    it('should handle PM returning tasks with number as a task element', async () => {
      ;(taskManager.createTask as jest.Mock).mockReturnValue(makeTask('pm-task'))
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done',
        tasks: [42],
      })

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(0)
    })
  })

  describe('self-referencing dependency', () => {
    it('should detect self-dependency as circular', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockImplementation((title, desc, assignedTo, deps, files) => ({
          id: title === 'PM' ? 'pm-task' : 'dev-1',
          title,
          description: desc,
          assignedTo,
          dependencies: deps,
          files,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        }))

      ;(agentManager.executeAgent as jest.Mock).mockResolvedValueOnce({
        message: 'PM done',
        tasks: [
          { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: ['Task 1'], files: [] },
        ],
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await orchestrator.executeUserRequest('test self-dep')

      expect(result.success).toBe(false)
      expect(result.error?.message).toMatch(/Circular|Missing/i)

      consoleSpy.mockRestore()
    })
  })

  describe('abort edge cases', () => {
    it('should handle abort called before any tasks', () => {
      expect(() => orchestrator.abortWorkflow()).not.toThrow()
    })

    it('should handle abort called multiple times', () => {
      orchestrator.abortWorkflow()
      orchestrator.abortWorkflow()
      orchestrator.abortWorkflow()
    })

    it('should handle task queue stats after abort', async () => {
      orchestrator = new Orchestrator('test-edge', fastRetry, undefined, { concurrency: 1 })

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('dev-1'))
        .mockReturnValueOnce(makeTask('dev-2'))

      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => ({
          message: 'PM done',
          tasks: [
            { title: 'T1', description: 'T1', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'T2', description: 'T2', assignedTo: 'dev', dependencies: [], files: [] },
          ],
        }))
        .mockImplementationOnce(async () => {
          await new Promise(r => setTimeout(r, 200))
          return { message: 'done', files: [] }
        })

      const workflowPromise = orchestrator.executeUserRequest('test')
      await new Promise(r => setTimeout(r, 50))
      orchestrator.abortWorkflow()

      const _result = await workflowPromise
      const queueStats = orchestrator.getTaskQueueStats()
      expect(queueStats).toBeDefined()
    })
  })

  describe('dev agent returns no files field', () => {
    it('should handle dev response without files', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('dev-1'))

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [{ title: 'T1', description: 'T1', assignedTo: 'dev', dependencies: [], files: [] }],
        })
        .mockResolvedValueOnce({
          message: 'Dev done',
        })
        .mockResolvedValueOnce({
          message: 'Review OK',
          status: 'success',
        })

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(true)
      expect(result.files).toEqual([])
    })
  })

  describe('review agent returns without status field', () => {
    it('should treat missing status as non-success (failed)', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('dev-1'))

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [{ title: 'T1', description: 'T1', assignedTo: 'dev', dependencies: [], files: [] }],
        })
        .mockResolvedValueOnce({
          message: 'Dev done',
          files: [],
        })
        .mockResolvedValueOnce({
          message: 'Review response without status',
        })

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(false)
      expect(taskManager.updateTaskStatus).toHaveBeenCalledWith('dev-1', 'failed')

      consoleSpy.mockRestore()
    })
  })

  describe('validateSubTasks pure function edge cases', () => {
    it('should return empty for null input', () => {
      expect(validateSubTasks(null)).toEqual([])
    })

    it('should return empty for undefined input', () => {
      expect(validateSubTasks(undefined)).toEqual([])
    })

    it('should return empty for string input', () => {
      expect(validateSubTasks('not an array')).toEqual([])
    })

    it('should return empty for number input', () => {
      expect(validateSubTasks(42)).toEqual([])
    })

    it('should return empty for object input', () => {
      expect(validateSubTasks({})).toEqual([])
    })

    it('should skip elements that are null', () => {
      const result = validateSubTasks([
        { title: 'Task 1', description: 'desc', assignedTo: 'dev', dependencies: [] },
        null,
        { title: 'Task 2', description: 'desc', assignedTo: 'dev', dependencies: [] },
      ])
      expect(result).toHaveLength(2)
    })

    it('should skip elements that are undefined', () => {
      const result = validateSubTasks([
        { title: 'Task 1', description: 'desc', assignedTo: 'dev', dependencies: [] },
        undefined,
      ])
      expect(result).toHaveLength(1)
    })
  })

  describe('task with review assignedTo', () => {
    it('should execute review-only task without dev+review cycle', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('rev-1', [], 'review'))

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [{ title: 'Review Task', description: 'Review Task', assignedTo: 'review', dependencies: [], files: [] }],
        })
        .mockResolvedValueOnce({
          message: 'Review done',
          status: 'success',
        })

      const result = await orchestrator.executeUserRequest('review task')

      expect(result.success).toBe(true)
      expect(taskManager.updateTaskStatus).toHaveBeenCalledWith(expect.any(String), 'review')
      expect(taskManager.updateTaskStatus).toHaveBeenCalledWith(expect.any(String), 'completed')
    })
  })

  describe('large number of tasks', () => {
    it('should handle many tasks without errors', async () => {
      const taskCount = 20

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
      for (let i = 0; i < taskCount; i++) {
        ;(taskManager.createTask as jest.Mock).mockReturnValueOnce(makeTask(`dev-${i}`))
      }

      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => ({
          message: 'PM done',
          tasks: Array.from({ length: taskCount }, (_, i) => ({
            title: `T${i}`, description: `T${i}`, assignedTo: 'dev', dependencies: [], files: [],
          })),
        }))
        .mockImplementation(async (_role: string, task: Task) => {
          if (_role === 'dev') return { message: `${task.id} done`, files: [] }
          return { message: `${task.id} review done`, status: 'success' }
        })

      orchestrator = new Orchestrator('test-edge', fastRetry, undefined, { concurrency: 5 })
      const result = await orchestrator.executeUserRequest('many tasks')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(taskCount)
      expect(result.stats?.successfulTasks).toBe(taskCount)
    }, 15000)
  })

  describe('sequential executeUserRequest calls', () => {
    it('should handle two sequential workflow runs correctly', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValue(makeTask('pm-task'))

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValue({
          message: 'PM done',
          tasks: [],
        })

      const result1 = await orchestrator.executeUserRequest('first request')
      const result2 = await orchestrator.executeUserRequest('second request')

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })
  })

  describe('task with dependency on external (non-subtask) ID', () => {
    it('should detect missing dependency and fail gracefully', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockImplementation((title, desc, assignedTo, deps, files) => ({
          id: assignedTo === 'pm' ? 'pm-task' : 'dev-1',
          title,
          description: desc,
          assignedTo,
          dependencies: deps,
          files,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        }))

      ;(agentManager.executeAgent as jest.Mock).mockResolvedValueOnce({
        message: 'PM done',
        tasks: [
          { title: 'T1', description: 'T1', assignedTo: 'dev', dependencies: ['external-nonexistent-id'], files: [] },
        ],
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(false)
      expect(result.error?.message).toMatch(/Missing/i)

      consoleSpy.mockRestore()
    })
  })
})
