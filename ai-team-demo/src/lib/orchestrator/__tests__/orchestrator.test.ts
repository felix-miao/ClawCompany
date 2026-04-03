// Orchestrator 错误处理和重试机制测试

import { Orchestrator, WorkflowResult } from '../index'
import { agentManager } from '@/lib/agents/manager'
import { taskManager } from '@/lib/tasks/manager'
import { chatManager } from '@/lib/chat/manager'
import { fileSystemManager } from '@/lib/filesystem/manager'

// Mock dependencies
jest.mock('@/lib/agents/manager')
jest.mock('@/lib/tasks/manager')
jest.mock('@/lib/chat/manager')
jest.mock('@/lib/filesystem/manager')

describe('Orchestrator - 错误处理和重试机制', () => {
  let orchestrator: Orchestrator
  
  beforeEach(() => {
    jest.clearAllMocks()
    orchestrator = new Orchestrator('test-project')
    
    // Setup default mocks
    ;(chatManager.sendUserMessage as jest.Mock).mockImplementation(() => {})
    ;(chatManager.broadcast as jest.Mock).mockImplementation(() => {})
    ;(chatManager.getHistory as jest.Mock).mockReturnValue([])
    ;(chatManager.clearHistory as jest.Mock).mockImplementation(() => {})
    ;(taskManager.createTask as jest.Mock).mockImplementation((title, desc, assignedTo, deps, files) => ({
      id: 'task-' + Math.random().toString(36).substr(2, 9),
      title,
      description: desc,
      assignedTo,
      dependencies: deps,
      files,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    ;(taskManager.getTask as jest.Mock).mockImplementation((id) => ({
      id,
      title: 'Test Task',
      description: 'Test Description',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    ;(taskManager.getAllTasks as jest.Mock).mockReturnValue([])
    ;(taskManager.updateTaskStatus as jest.Mock).mockImplementation(() => {})
    ;(taskManager.clearTasks as jest.Mock).mockImplementation(() => {})
    ;(taskManager.getStats as jest.Mock).mockReturnValue({
      total: 0,
      pending: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    })
    ;(fileSystemManager.createFile as jest.Mock).mockResolvedValue(undefined)
  })

  describe('重试机制', () => {
    it('应该在Agent执行失败时自动重试（最多3次）', async () => {
      let attemptCount = 0
      
      ;(agentManager.executeAgent as jest.Mock).mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Agent execution failed')
        }
        return {
          message: 'Success after retries',
          tasks: [],
          files: [],
        }
      })
      
      const result = await orchestrator.executeUserRequest('test request')
      
      expect(attemptCount).toBe(3)
      expect(result.success).toBe(true)
    })

    it('应该在重试3次后仍然失败时返回错误', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockRejectedValue(
        new Error('Persistent failure')
      )
      
      const result = await orchestrator.executeUserRequest('test request')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      // The error message should indicate the task failed
      expect(result.error?.message).toContain('failed')
    }, 10000)

    it('应该使用指数退避策略进行重试', async () => {
      const delays: number[] = []
      let attemptCount = 0
      
      ;(agentManager.executeAgent as jest.Mock).mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary failure')
        }
        return { message: 'Success', tasks: [], files: [] }
      })
      
      // Mock setTimeout to track delays
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn((fn: any, delay: number) => {
        delays.push(delay)
        return originalSetTimeout(fn, 0) // Execute immediately for testing
      }) as any
      
      await orchestrator.executeUserRequest('test request')
      
      global.setTimeout = originalSetTimeout
      
      // Should have exponential backoff: ~1s, ~2s
      expect(delays.length).toBeGreaterThanOrEqual(2)
      if (delays.length >= 2) {
        expect(delays[1]).toBeGreaterThan(delays[0])
      }
    })
  })

  describe('部分任务失败处理', () => {
    it('应该在部分任务失败时继续执行其他任务', async () => {
      const executedTasks: string[] = []
      
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task-1',
          title: 'PM Task',
          description: 'PM Task',
          assignedTo: 'pm',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-task-1',
          title: 'Dev Task 1',
          description: 'Dev Task 1',
          assignedTo: 'dev',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-task-2',
          title: 'Dev Task 2',
          description: 'Dev Task 2',
          assignedTo: 'dev',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      
      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => {
          executedTasks.push('pm')
          return {
            message: 'PM Analysis',
            tasks: [
              { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
              { title: 'Task 2', description: 'Task 2', assignedTo: 'dev', dependencies: [], files: [] },
            ],
          }
        })
        // Dev Task 1 - initial + 3 retries all fail (4 attempts total)
        .mockImplementationOnce(async () => {
          executedTasks.push('dev-1-attempt-1')
          throw new Error('Dev Task 1 failed')
        })
        .mockImplementationOnce(async () => {
          executedTasks.push('dev-1-attempt-2')
          throw new Error('Dev Task 1 failed again')
        })
        .mockImplementationOnce(async () => {
          executedTasks.push('dev-1-attempt-3')
          throw new Error('Dev Task 1 failed third time')
        })
        .mockImplementationOnce(async () => {
          executedTasks.push('dev-1-attempt-4')
          throw new Error('Dev Task 1 failed fourth time')
        })
        // Dev Task 2 - succeeds
        .mockImplementationOnce(async () => {
          executedTasks.push('dev-2')
          return {
            message: 'Dev Task 2 Success',
            files: [],
          }
        })
        // Review for Task 2
        .mockImplementationOnce(async () => {
          executedTasks.push('review-2')
          return {
            message: 'Review OK',
            status: 'success',
          }
        })
      
      ;(taskManager.getTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'dev-task-1',
          title: 'Dev Task 1',
          description: 'Dev Task 1',
          assignedTo: 'dev',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-task-2',
          title: 'Dev Task 2',
          description: 'Dev Task 2',
          assignedTo: 'dev',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      
      const result = await orchestrator.executeUserRequest('test request')
      
      // PM should execute
      expect(executedTasks).toContain('pm')
      // Dev Task 1 should attempt 4 times (initial + 3 retries)
      expect(executedTasks).toContain('dev-1-attempt-1')
      expect(executedTasks).toContain('dev-1-attempt-2')
      expect(executedTasks).toContain('dev-1-attempt-3')
      expect(executedTasks).toContain('dev-1-attempt-4')
      // Dev Task 2 should execute even though Task 1 failed
      expect(executedTasks).toContain('dev-2')
      // Review for Task 2 should execute
      expect(executedTasks).toContain('review-2')
      // Result should indicate partial success (some tasks completed)
      expect(result.success).toBe(true)
      // Check stats instead of failedTasks
      expect(result.stats?.failedTasks).toBeGreaterThan(0)
    }, 15000)

    it('应该记录失败的任务及其错误信息', async () => {
      // Setup PM task
      ;(taskManager.createTask as jest.Mock).mockReturnValueOnce({
        id: 'pm-task-1',
        title: 'PM Task',
        description: 'PM Task',
        assignedTo: 'pm',
        dependencies: [],
        files: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      
      // PM agent fails all 3 retries
      ;(agentManager.executeAgent as jest.Mock)
        .mockRejectedValueOnce(new Error('Task failed with specific error'))
        .mockRejectedValueOnce(new Error('Task failed with specific error'))
        .mockRejectedValueOnce(new Error('Task failed with specific error'))
        .mockRejectedValueOnce(new Error('Task failed with specific error'))
      
      const result = await orchestrator.executeUserRequest('test request')
      
      // When PM fails completely, error should be recorded
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('failed')
    }, 15000)
  })

  describe('错误日志和监控', () => {
    it('应该记录所有错误到日志', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      ;(agentManager.executeAgent as jest.Mock).mockRejectedValue(
        new Error('Test error')
      )
      
      await orchestrator.executeUserRequest('test request')
      
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls.some(call => 
        call[0].includes('Error') || call[1]?.includes('Test error')
      )).toBe(true)
      
      consoleSpy.mockRestore()
    }, 10000)

    it('应该记录重试次数和原因', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      let attemptCount = 0
      
      ;(agentManager.executeAgent as jest.Mock).mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary error')
        }
        return { message: 'Success', tasks: [], files: [] }
      })
      
      await orchestrator.executeUserRequest('test request')
      
      // Should log retry attempts
      const warnCalls = consoleSpy.mock.calls
      expect(warnCalls.some(call => 
        call[0]?.includes('Retry') || call[0]?.includes('重试')
      )).toBe(true)
      
      consoleSpy.mockRestore()
    })

    it('应该返回详细的执行统计信息', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task-1',
          title: 'PM Task',
          description: 'PM Task',
          assignedTo: 'pm',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-task-1',
          title: 'Dev Task 1',
          description: 'Dev Task 1',
          assignedTo: 'dev',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      
      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM Analysis',
          tasks: [
            { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
          ],
        })
        .mockResolvedValueOnce({
          message: 'Dev Success',
          files: [],
        })
        .mockResolvedValueOnce({
          message: 'Review Success',
          status: 'success',
        })
      
      ;(taskManager.getTask as jest.Mock).mockReturnValue({
        id: 'dev-task-1',
        title: 'Dev Task 1',
        description: 'Dev Task 1',
        assignedTo: 'dev',
        dependencies: [],
        files: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      
      const result = await orchestrator.executeUserRequest('test request')
      
      expect(result.stats).toBeDefined()
      expect(result.stats?.totalTasks).toBeDefined()
      expect(result.stats?.successfulTasks).toBeDefined()
      expect(result.stats?.failedTasks).toBeDefined()
      expect(result.stats?.totalRetries).toBeDefined()
    })
  })

  describe('文件操作错误处理', () => {
    it('应该在文件创建失败时记录错误但继续执行', async () => {
      ;(fileSystemManager.createFile as jest.Mock).mockRejectedValue(
        new Error('File system error')
      )
      
      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM Analysis',
          tasks: [
            { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
          ],
        })
        .mockResolvedValueOnce({
          message: 'Dev Success',
          files: [
            { path: '/test/file.ts', content: 'test content', action: 'create' },
          ],
        })
        .mockResolvedValueOnce({
          message: 'Review Success',
          status: 'success',
        })
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const result = await orchestrator.executeUserRequest('test request')
      
      // Should log file error
      expect(consoleSpy).toHaveBeenCalled()
      // Should still complete workflow
      expect(result.success).toBe(true)
      
      consoleSpy.mockRestore()
    })
  })

  describe('任务依赖排序', () => {
    it('应该按照依赖关系顺序执行子任务', async () => {
      const executionOrder: string[] = []

      const pmTask = {
        id: 'pm-task',
        title: 'PM',
        description: 'PM',
        assignedTo: 'pm' as const,
        dependencies: [],
        files: [],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const dev1Task = {
        id: 'dev-1',
        title: '创建组件',
        description: '创建组件',
        assignedTo: 'dev' as const,
        dependencies: [] as string[],
        files: [] as string[],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const dev2Task = {
        id: 'dev-2',
        title: '实现逻辑',
        description: '实现逻辑',
        assignedTo: 'dev' as const,
        dependencies: ['dev-1'],
        files: [] as string[],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const dev3Task = {
        id: 'dev-3',
        title: '集成测试',
        description: '集成测试',
        assignedTo: 'dev' as const,
        dependencies: ['dev-1', 'dev-2'],
        files: [] as string[],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(pmTask)
        .mockReturnValueOnce(dev3Task)
        .mockReturnValueOnce(dev2Task)
        .mockReturnValueOnce(dev1Task)

      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => {
          executionOrder.push('pm')
          return {
            message: 'PM done',
            tasks: [
              { title: '集成测试', description: '集成测试', assignedTo: 'dev', dependencies: ['dev-1', 'dev-2'], files: [] },
              { title: '实现逻辑', description: '实现逻辑', assignedTo: 'dev', dependencies: ['dev-1'], files: [] },
              { title: '创建组件', description: '创建组件', assignedTo: 'dev', dependencies: [], files: [] },
            ],
          }
        })
        .mockImplementation(async (_role: string, task: any) => {
          executionOrder.push(task.id)
          return { message: `${task.id} done`, files: [], status: 'success' }
        })

      ;(taskManager.getTask as jest.Mock)
        .mockReturnValueOnce(dev3Task)
        .mockReturnValueOnce(dev1Task)
        .mockReturnValueOnce(dev2Task)
        .mockReturnValue(dev1Task)

      await orchestrator.executeUserRequest('build a form')

      expect(executionOrder[0]).toBe('pm')
      expect(executionOrder.indexOf('dev-1')).toBeLessThan(executionOrder.indexOf('dev-2'))
      expect(executionOrder.indexOf('dev-2')).toBeLessThan(executionOrder.indexOf('dev-3'))
    })

    it('应该在循环依赖时优雅处理错误', async () => {
      const pmTask = {
        id: 'pm-task',
        title: 'PM',
        description: 'PM',
        assignedTo: 'pm' as const,
        dependencies: [],
        files: [],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const dev1Task = {
        id: 'dev-1',
        title: 'Task 1',
        description: 'Task 1',
        assignedTo: 'dev' as const,
        dependencies: ['dev-2'],
        files: [] as string[],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const dev2Task = {
        id: 'dev-2',
        title: 'Task 2',
        description: 'Task 2',
        assignedTo: 'dev' as const,
        dependencies: ['dev-1'],
        files: [] as string[],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(pmTask)
        .mockReturnValueOnce(dev1Task)
        .mockReturnValueOnce(dev2Task)

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: ['dev-2'], files: [] },
            { title: 'Task 2', description: 'Task 2', assignedTo: 'dev', dependencies: ['dev-1'], files: [] },
          ],
        })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  describe('超时处理', () => {
    it('应该在Agent执行超时时触发重试', async () => {
      let attemptCount = 0
      
      ;(agentManager.executeAgent as jest.Mock).mockImplementation(async () => {
        attemptCount++
        if (attemptCount === 1) {
          // Simulate timeout by never resolving
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 100)
          })
        }
        return { message: 'Success', tasks: [], files: [] }
      })
      
      const result = await orchestrator.executeUserRequest('test request')
      
      expect(attemptCount).toBeGreaterThan(1)
    }, 10000)
  })
})
