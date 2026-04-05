import { Orchestrator } from '../index'

import { agentManager } from '@/lib/agents/manager'
import { taskManager } from '@/lib/tasks/manager'
import { chatManager } from '@/lib/chat/manager'

jest.mock('@/lib/agents/manager')
jest.mock('@/lib/tasks/manager')
jest.mock('@/lib/chat/manager')

describe('Orchestrator - TaskQueue integration', () => {
  let orchestrator: Orchestrator

  beforeEach(() => {
    jest.clearAllMocks()

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
  })

  const makeTask = (id: string, deps: string[] = []) => ({
    id,
    title: `Task ${id}`,
    description: `Task ${id}`,
    assignedTo: 'dev' as const,
    dependencies: deps,
    files: [] as string[],
    status: 'pending' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  describe('bounded concurrency in parallel levels', () => {
    it('should limit concurrent task execution to configured concurrency', async () => {
      orchestrator = new Orchestrator('test-queue', {
        maxRetries: 1,
        initialDelay: 1,
        maxDelay: 10,
        backoffMultiplier: 1,
      }, undefined, { concurrency: 2 })

      let maxConcurrent = 0
      let currentConcurrent = 0

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('dev-1'))
        .mockReturnValueOnce(makeTask('dev-2'))
        .mockReturnValueOnce(makeTask('dev-3'))
        .mockReturnValueOnce(makeTask('dev-4'))
        .mockReturnValueOnce(makeTask('dev-5'))

      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => ({
          message: 'PM done',
          tasks: [
            { title: 'T1', description: 'T1', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'T2', description: 'T2', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'T3', description: 'T3', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'T4', description: 'T4', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'T5', description: 'T5', assignedTo: 'dev', dependencies: [], files: [] },
          ],
        }))
        .mockImplementation(async (_role: string, task: any) => {
          currentConcurrent++
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
          await new Promise(r => setTimeout(r, 50))
          currentConcurrent--
          if (_role === 'dev') return { message: `${task.id} done`, files: [] }
          return { message: `${task.id} review done`, status: 'success' }
        })

      await orchestrator.executeUserRequest('build 5 features')
      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('should default to concurrency of 3', async () => {
      orchestrator = new Orchestrator('test-queue', {
        maxRetries: 1,
        initialDelay: 1,
        maxDelay: 10,
        backoffMultiplier: 1,
      })

      let maxConcurrent = 0
      let currentConcurrent = 0

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('dev-1'))
        .mockReturnValueOnce(makeTask('dev-2'))
        .mockReturnValueOnce(makeTask('dev-3'))
        .mockReturnValueOnce(makeTask('dev-4'))
        .mockReturnValueOnce(makeTask('dev-5'))
        .mockReturnValueOnce(makeTask('dev-6'))

      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => ({
          message: 'PM done',
          tasks: Array.from({ length: 6 }, (_, i) => ({
            title: `T${i}`, description: `T${i}`, assignedTo: 'dev', dependencies: [], files: [],
          })),
        }))
        .mockImplementation(async (_role: string, task: any) => {
          currentConcurrent++
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
          await new Promise(r => setTimeout(r, 30))
          currentConcurrent--
          if (_role === 'dev') return { message: `${task.id} done`, files: [] }
          return { message: `${task.id} review done`, status: 'success' }
        })

      await orchestrator.executeUserRequest('build 6 features')
      expect(maxConcurrent).toBeLessThanOrEqual(3)
    })

    it('should still complete all tasks correctly with concurrency limit', async () => {
      orchestrator = new Orchestrator('test-queue', {
        maxRetries: 1,
        initialDelay: 1,
        maxDelay: 10,
        backoffMultiplier: 1,
      }, undefined, { concurrency: 1 })

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
        .mockImplementation(async (_role: string, task: any) => {
          if (_role === 'dev') return { message: `${task.id} done`, files: [] }
          return { message: `${task.id} review done`, status: 'success' }
        })

      const result = await orchestrator.executeUserRequest('build 2 features')
      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(2)
      expect(result.stats?.successfulTasks).toBe(2)
    })
  })

  describe('dependency order preserved under concurrency', () => {
    it('should respect dependency chains even with concurrency > 1', async () => {
      orchestrator = new Orchestrator('test-queue', {
        maxRetries: 1,
        initialDelay: 1,
        maxDelay: 10,
        backoffMultiplier: 1,
      }, undefined, { concurrency: 2 })

      const executionOrder: string[] = []

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('A'))
        .mockReturnValueOnce(makeTask('B', ['A']))
        .mockReturnValueOnce(makeTask('C', ['A']))
        .mockReturnValueOnce(makeTask('D', ['B', 'C']))

      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => ({
          message: 'PM done',
          tasks: [
            { title: 'A', description: 'A', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'B', description: 'B', assignedTo: 'dev', dependencies: ['A'], files: [] },
            { title: 'C', description: 'C', assignedTo: 'dev', dependencies: ['A'], files: [] },
            { title: 'D', description: 'D', assignedTo: 'dev', dependencies: ['B', 'C'], files: [] },
          ],
        }))
        .mockImplementation(async (_role: string, task: any) => {
          executionOrder.push(task.id)
          await new Promise(r => setTimeout(r, 20))
          if (_role === 'dev') return { message: `${task.id} done`, files: [] }
          return { message: `${task.id} review done`, status: 'success' }
        })

      const result = await orchestrator.executeUserRequest('diamond deps')
      expect(result.success).toBe(true)

      const aIdx = executionOrder.indexOf('A')
      const bIdx = executionOrder.indexOf('B')
      const cIdx = executionOrder.indexOf('C')
      const dIdx = executionOrder.indexOf('D')

      expect(aIdx).toBeLessThan(bIdx)
      expect(aIdx).toBeLessThan(cIdx)
      expect(bIdx).toBeLessThan(dIdx)
      expect(cIdx).toBeLessThan(dIdx)
    })
  })

  describe('abort propagates to task execution', () => {
    it('should abort pending tasks when abort is called', async () => {
      orchestrator = new Orchestrator('test-queue', {
        maxRetries: 1,
        initialDelay: 1,
        maxDelay: 10,
        backoffMultiplier: 1,
      }, undefined, { concurrency: 1 })

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('dev-1'))
        .mockReturnValueOnce(makeTask('dev-2'))

      let pmResolved = false
      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => {
          pmResolved = true
          return {
            message: 'PM done',
            tasks: [
              { title: 'T1', description: 'T1', assignedTo: 'dev', dependencies: [], files: [] },
              { title: 'T2', description: 'T2', assignedTo: 'dev', dependencies: [], files: [] },
            ],
          }
        })
        .mockImplementation(async (_role: string, task: any) => {
          if (task.id === 'dev-1') {
            await new Promise(r => setTimeout(r, 500))
          }
          if (_role === 'dev') return { message: `${task.id} done`, files: [] }
          return { message: `${task.id} review done`, status: 'success' }
        })

      const workflowPromise = orchestrator.executeUserRequest('test abort')
      await new Promise(r => setTimeout(r, 50))

      orchestrator.abortWorkflow()

      const result = await workflowPromise
      expect(pmResolved).toBe(true)
      expect(result.success).toBe(false)
    })
  })
})
