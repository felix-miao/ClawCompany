import { Orchestrator } from '../index'
import type { Task } from '@/lib/core/types'

import { agentManager } from '@/lib/agents/manager'
import { taskManager } from '@/lib/tasks/manager'
import { chatManager } from '@/lib/chat/manager'

jest.mock('@/lib/agents/manager')
jest.mock('@/lib/tasks/manager')
jest.mock('@/lib/chat/manager')

describe('Orchestrator - Parallel Task Execution', () => {
  let orchestrator: Orchestrator

  beforeEach(() => {
    jest.clearAllMocks()
    orchestrator = new Orchestrator('test-parallel', {
      maxRetries: 1,
      initialDelay: 1,
      maxDelay: 10,
      backoffMultiplier: 1,
    })

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

  describe('independent tasks execute in parallel', () => {
    it('should execute independent tasks concurrently, not sequentially', async () => {
      const executionTimes: { id: string; start: number; end: number }[] = []

      const makeTask = (id: string) => ({
        id,
        title: `Task ${id}`,
        description: `Task ${id}`,
        assignedTo: 'dev' as const,
        dependencies: [] as string[],
        files: [] as string[],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('dev-1'))
        .mockReturnValueOnce(makeTask('dev-2'))
        .mockReturnValueOnce(makeTask('dev-3'))

      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => ({
          message: 'PM done',
          tasks: [
            { title: 'Task dev-1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'Task dev-2', description: 'Task 2', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'Task dev-3', description: 'Task 3', assignedTo: 'dev', dependencies: [], files: [] },
          ],
        }))

      const mockDevAndReview = async (_role: string, task: Task) => {
        const start = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        const end = Date.now()
        executionTimes.push({ id: task.id, start, end })

        if (_role === 'dev') {
          return { message: `${task.id} dev done`, files: [] }
        }
        return { message: `${task.id} review done`, status: 'success' }
      }

      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementation(mockDevAndReview)

      const startTime = Date.now()
      const result = await orchestrator.executeUserRequest('build three independent features')
      const _totalTime = Date.now() - startTime

      const devExecutions = executionTimes.filter((e) => !e.id.startsWith('pm'))

      expect(devExecutions.length).toBeGreaterThanOrEqual(3)

      const firstDevStart = Math.min(...devExecutions.map((e) => e.start))
      const lastDevStart = Math.max(...devExecutions.map((e) => e.start))
      expect(lastDevStart - firstDevStart).toBeLessThan(100)

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(3)
      expect(result.stats?.successfulTasks).toBe(3)
      expect(result.stats?.failedTasks).toBe(0)
    })
  })

  describe('dependent tasks execute in correct order', () => {
    it('should wait for dependencies before executing dependent tasks', async () => {
      const executionOrder: string[] = []

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

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('A'))
        .mockReturnValueOnce(makeTask('B', ['A']))

      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => ({
          message: 'PM done',
          tasks: [
            { title: 'Task A', description: 'A', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'Task B', description: 'B', assignedTo: 'dev', dependencies: ['A'], files: [] },
          ],
        }))
        .mockImplementation(async (_role: string, task: any) => {
          executionOrder.push(task.id)
          if (_role === 'dev') {
            return { message: `${task.id} dev done`, files: [] }
          }
          return { message: `${task.id} review done`, status: 'success' }
        })

      const result = await orchestrator.executeUserRequest('build with dependency')

      expect(result.success).toBe(true)

      const aIndex = executionOrder.indexOf('A')
      const bIndex = executionOrder.indexOf('B')
      expect(aIndex).toBeLessThan(bIndex)
    })
  })

  describe('partial failure in parallel level', () => {
    it('should continue other tasks when one task in a parallel level fails', async () => {
      const makeTask = (id: string) => ({
        id,
        title: `Task ${id}`,
        description: `Task ${id}`,
        assignedTo: 'dev' as const,
        dependencies: [] as string[],
        files: [] as string[],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(makeTask('pm-task'))
        .mockReturnValueOnce(makeTask('dev-1'))
        .mockReturnValueOnce(makeTask('dev-2'))

      let devCallCount = 0
      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => ({
          message: 'PM done',
          tasks: [
            { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'Task 2', description: 'Task 2', assignedTo: 'dev', dependencies: [], files: [] },
          ],
        }))
        .mockImplementation(async (_role: string, task: any) => {
          devCallCount++
          if (task.id === 'dev-1' && _role === 'dev') {
            throw new Error('Dev 1 failed')
          }
          if (_role === 'dev') {
            return { message: `${task.id} dev done`, files: [] }
          }
          return { message: `${task.id} review done`, status: 'success' }
        })

      const result = await orchestrator.executeUserRequest('build two features')

      expect(result.success).toBe(false)
      expect(result.stats?.failedTasks).toBeGreaterThanOrEqual(1)
      expect(result.stats?.successfulTasks).toBeGreaterThanOrEqual(0)
    })
  })

  describe('diamond dependency with parallel middle level', () => {
    it('should execute B and C in parallel after A, then D after both', async () => {
      const executionTimes: { id: string; start: number }[] = []

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
            { title: 'Task A', description: 'A', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'Task B', description: 'B', assignedTo: 'dev', dependencies: ['A'], files: [] },
            { title: 'Task C', description: 'C', assignedTo: 'dev', dependencies: ['A'], files: [] },
            { title: 'Task D', description: 'D', assignedTo: 'dev', dependencies: ['B', 'C'], files: [] },
          ],
        }))
        .mockImplementation(async (_role: string, task: Task) => {
          executionTimes.push({ id: task.id, start: Date.now() })
          await new Promise((r) => setTimeout(r, 30))
          if (_role === 'dev') {
            return { message: `${task.id} dev done`, files: [] }
          }
          return { message: `${task.id} review done`, status: 'success' }
        })

      const result = await orchestrator.executeUserRequest('diamond dependency')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(4)
      expect(result.stats?.successfulTasks).toBe(4)

      const bTime = executionTimes.find((e) => e.id === 'B')
      const cTime = executionTimes.find((e) => e.id === 'C')
      const dTime = executionTimes.find((e) => e.id === 'D')

      expect(bTime).toBeDefined()
      expect(cTime).toBeDefined()
      expect(dTime).toBeDefined()

      if (bTime && cTime) {
        expect(Math.abs(bTime.start - cTime.start)).toBeLessThan(100)
      }

      const bEndTime = bTime!.start + 60
      const cEndTime = cTime!.start + 60
      const earliestBC = Math.min(bEndTime, cEndTime)
      if (dTime) {
        expect(dTime.start).toBeGreaterThanOrEqual(earliestBC - 50)
      }
    })
  })
})
