// Orchestrator 错误处理和重试机制测试

import { Orchestrator, WorkflowResult } from '../index'

import { agentManager } from '@/lib/agents/manager'
import { taskManager } from '@/lib/tasks/manager'
import { chatManager } from '@/lib/chat/manager'

// Mock dependencies
jest.mock('@/lib/agents/manager')
jest.mock('@/lib/tasks/manager')
jest.mock('@/lib/chat/manager')

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
        .mockImplementation(async (role: string, task: { id: string }, context: unknown) => {
          if (role === 'pm') {
            executedTasks.push('pm')
            return {
              message: 'PM Analysis',
              tasks: [
                { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
                { title: 'Task 2', description: 'Task 2', assignedTo: 'dev', dependencies: [], files: [] },
              ],
            }
          }

          if (role === 'dev') {
            // Dev Task 1 - all attempts fail
            if (task.id === 'dev-task-1') {
              const attemptCount = executedTasks.filter(t => t.startsWith('dev-1-attempt')).length + 1
              executedTasks.push(`dev-1-attempt-${attemptCount}`)
              throw new Error(`Dev Task 1 failed attempt ${attemptCount}`)
            }

            // Dev Task 2 - succeeds
            if (task.id === 'dev-task-2') {
              executedTasks.push('dev-2')
              return {
                message: 'Dev Task 2 Success',
                files: [],
              }
            }
          }

          if (role === 'review') {
            // Review for Task 2 - succeeds
            if (task.id === 'dev-task-2') {
              executedTasks.push('review-2')
              return {
                message: 'Review OK',
                status: 'success',
              }
            }
            // Review for Task 1 - should not be called since dev task failed
            if (task.id === 'dev-task-1') {
              executedTasks.push('review-1-unexpected')
              throw new Error('Review should not be called for failed task')
            }
          }

          throw new Error(`Unexpected agent call: ${role}, ${task.id}`)
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
      // Result should indicate failure when not all tasks completed
      expect(result.success).toBe(false)
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
      
      const eventHistory = orchestrator.getEventBus().getHistory()
      const errorEvents = eventHistory.filter(e => e.type === 'agent:failed' || e.type === 'workflow:failed' || (e.type === 'error:tracked' && e.data?.level === 'error'))
      expect(errorEvents.length).toBeGreaterThanOrEqual(1)
      expect(errorEvents.some(e => JSON.stringify(e.data).includes('Test error'))).toBe(true)
      
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
      
      const eventHistory = orchestrator.getEventBus().getHistory()
      const retryEvents = eventHistory.filter(e => e.type === 'agent:retrying')
      expect(retryEvents.length).toBeGreaterThanOrEqual(1)
      expect(retryEvents.some(e => JSON.stringify(e.data).includes('Temporary error'))).toBe(true)
      
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
      
      const result = await orchestrator.executeUserRequest('test request')
      
      const eventHistory = orchestrator.getEventBus().getHistory()
      const fileErrorEvents = eventHistory.filter(e => e.type === 'error:tracked' && JSON.stringify(e.data).includes('File save failed'))
      expect(fileErrorEvents.length).toBeGreaterThanOrEqual(1)
      expect(result.success).toBe(true)
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

  describe('依赖未完成时跳过任务', () => {
    it('应该在前置依赖任务失败时跳过后续任务', async () => {
      const task1 = {
        id: 'dev-1',
        title: 'Task 1',
        description: 'Task 1',
        assignedTo: 'dev' as const,
        dependencies: [] as string[],
        files: [] as string[],
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const task2 = {
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
        .mockReturnValueOnce({
          id: 'pm-task',
          title: 'PM',
          description: 'PM',
          assignedTo: 'pm',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce(task1)
        .mockReturnValueOnce(task2)

      const executedRoles: string[] = []
      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => {
          executedRoles.push('pm')
          return {
            message: 'PM done',
            tasks: [
              { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
              { title: 'Task 2', description: 'Task 2', assignedTo: 'dev', dependencies: ['dev-1'], files: [] },
            ],
          }
        })
        .mockRejectedValue(new Error('Dev failed'))

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await orchestrator.executeUserRequest('build feature')

      expect(executedRoles).toContain('pm')
      const eventHistory = orchestrator.getEventBus().getHistory()
      const skipEvents = eventHistory.filter(e => e.type === 'task:skipped')
      expect(skipEvents.length).toBeGreaterThanOrEqual(1)
      expect(result.stats?.totalTasks).toBe(2)

      consoleSpy.mockRestore()
    }, 15000)
  })

  describe('Review 拒绝处理', () => {
    it('应该在 review 返回非 success 时将任务状态设为 failed', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task',
          title: 'PM',
          description: 'PM',
          assignedTo: 'pm',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1',
          title: 'Dev Task',
          description: 'Dev Task',
          assignedTo: 'dev',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { title: 'Dev Task', description: 'Dev Task', assignedTo: 'dev', dependencies: [], files: [] },
          ],
        })
        .mockResolvedValueOnce({
          message: 'Dev done',
          files: [],
        })
        .mockResolvedValueOnce({
          message: 'Review rejected: needs fixes',
          status: 'error',
        })

      const result = await orchestrator.executeUserRequest('build feature')

      expect(taskManager.updateTaskStatus).toHaveBeenCalledWith('dev-1', 'in_progress')
      expect(taskManager.updateTaskStatus).toHaveBeenCalledWith('dev-1', 'review')
      expect(taskManager.updateTaskStatus).toHaveBeenCalledWith('dev-1', 'failed')
      expect(taskManager.updateTaskStatus).not.toHaveBeenCalledWith('dev-1', 'pending')
      expect(taskManager.updateTaskStatus).not.toHaveBeenCalledWith('dev-1', 'completed')
      expect(result.success).toBe(false)
      expect(result.failedTasks).toBeDefined()
      expect(result.failedTasks!.length).toBeGreaterThanOrEqual(1)
      expect(result.failedTasks!.some(ft => ft.taskId === 'dev-1')).toBe(true)
    })
  })

  describe('PM 无子任务时的工作流', () => {
    it('应该在 PM 不返回子任务时快速成功', async () => {
      ;(taskManager.createTask as jest.Mock).mockReturnValue({
        id: 'pm-task',
        title: 'PM',
        description: 'PM',
        assignedTo: 'pm',
        dependencies: [],
        files: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      ;(agentManager.executeAgent as jest.Mock).mockResolvedValueOnce({
        message: 'PM completed, no subtasks needed',
        tasks: [],
      })

      const result = await orchestrator.executeUserRequest('simple query')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(0)
      expect(result.stats?.successfulTasks).toBe(0)
    })
  })

  describe('getStatus', () => {
    it('应该返回项目状态信息', () => {
      const mockTasks = [
        { id: 't1', title: 'Task 1', status: 'completed' },
        { id: 't2', title: 'Task 2', status: 'pending' },
      ]
      ;(taskManager.getAllTasks as jest.Mock).mockReturnValue(mockTasks)
      ;(chatManager.getHistory as jest.Mock).mockReturnValue([
        { agent: 'user', content: 'hello' },
      ])
      ;(taskManager.getStats as jest.Mock).mockReturnValue({
        total: 2,
        pending: 1,
        in_progress: 0,
        review: 0,
        done: 1,
      })

      const status = orchestrator.getStatus()

      expect(status.projectId).toBe('test-project')
      expect(status.tasks).toEqual(mockTasks)
      expect(status.messages).toHaveLength(1)
      expect(status.stats.total).toBe(2)
    })
  })

  describe('reset', () => {
    it('应该清除所有状态', async () => {
      ;(taskManager.createTask as jest.Mock).mockReturnValue({
        id: 'pm-task',
        title: 'PM',
        description: 'PM',
        assignedTo: 'pm',
        dependencies: [],
        files: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      ;(agentManager.executeAgent as jest.Mock).mockResolvedValueOnce({
        message: 'PM done',
        tasks: [],
      })

      await orchestrator.executeUserRequest('test')

      orchestrator.reset()

      expect(taskManager.clearTasks).toHaveBeenCalled()
      expect(chatManager.clearHistory).toHaveBeenCalled()
    }, 10000)
  })

  describe('多文件保存', () => {
    it('应该在 dev 返回多个文件时全部保存', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task',
          title: 'PM',
          description: 'PM',
          assignedTo: 'pm',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1',
          title: 'Dev Task',
          description: 'Dev Task',
          assignedTo: 'dev',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { title: 'Dev Task', description: 'Dev Task', assignedTo: 'dev', dependencies: [], files: [] },
          ],
        })
        .mockResolvedValueOnce({
          message: 'Dev done',
          files: [
            { path: '/src/a.ts', content: 'export const a = 1', action: 'create' },
            { path: '/src/b.ts', content: 'export const b = 2', action: 'create' },
          ],
        })
        .mockResolvedValueOnce({
          message: 'Review OK',
          status: 'success',
        })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await orchestrator.executeUserRequest('create files')

      expect(result.files).toHaveLength(2)

      consoleSpy.mockRestore()
    })
  })

  describe('非 DependencyError 异常传播', () => {
    it('应该在任务解析过程中抛出非依赖错误时作为致命错误处理', async () => {
      // 模拟任务创建后在排序过程中抛出 TypeError
      const originalGetAllTasks = taskManager.getAllTasks
      taskManager.getAllTasks = jest.fn(() => [
        {
          id: 'dev-1',
          title: 'Task',
          description: 'Task',
          assignedTo: 'dev',
          dependencies: ['nonexistent-dep'],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ])

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task',
          title: 'PM',
          description: 'PM',
          assignedTo: 'pm',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1',
          title: 'Task',
          description: 'Task',
          assignedTo: 'dev',
          dependencies: ['nonexistent-dep'],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock).mockResolvedValueOnce({
        message: 'PM done',
        tasks: [
          { title: 'Task', description: 'Task', assignedTo: 'dev', dependencies: ['nonexistent-dep'], files: [] },
        ],
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Missing dependencies')

      taskManager.getAllTasks = originalGetAllTasks
      consoleSpy.mockRestore()
    })
  })

  describe('单任务意外错误', () => {
    it('应该在单个任务出现意外错误时记录失败并继续', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task',
          title: 'PM',
          description: 'PM',
          assignedTo: 'pm',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1',
          title: 'Task 1',
          description: 'Task 1',
          assignedTo: 'dev',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-2',
          title: 'Task 2',
          description: 'Task 2',
          assignedTo: 'dev',
          dependencies: [],
          files: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

      let callCount = 0
      ;(agentManager.executeAgent as jest.Mock)
        .mockImplementationOnce(async () => {
          return {
            message: 'PM done',
            tasks: [
              { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
              { title: 'Task 2', description: 'Task 2', assignedTo: 'dev', dependencies: [], files: [] },
            ],
          }
        })
        .mockImplementationOnce(async () => {
          callCount++
          throw new Error('Unexpected crash')
        })
        .mockImplementationOnce(async () => {
          callCount++
          throw new Error('Unexpected crash')
        })
        .mockImplementationOnce(async () => {
          callCount++
          throw new Error('Unexpected crash')
        })
        .mockImplementationOnce(async () => {
          callCount++
          throw new Error('Unexpected crash')
        })
        .mockImplementationOnce(async () => {
          return { message: 'Dev 2 done', files: [], status: 'success' }
        })
        .mockImplementationOnce(async () => {
          return { message: 'Review 2 done', status: 'success' }
        })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await orchestrator.executeUserRequest('build feature')

      expect(result.success).toBe(false)
      expect(result.stats?.failedTasks).toBeGreaterThanOrEqual(1)

      consoleSpy.mockRestore()
    }, 15000)
  })

  describe('PM 子任务输入验证', () => {
    const basePmTask = () => ({
      id: 'pm-task',
      title: 'PM',
      description: 'PM',
      assignedTo: 'pm' as const,
      dependencies: [],
      files: [],
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const baseDevTask = (id: string, title: string) => ({
      id,
      title,
      description: title,
      assignedTo: 'dev' as const,
      dependencies: [] as string[],
      files: [] as string[],
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    it('应该在 PM 返回任务缺少 title 时跳过该任务并记录警告', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(basePmTask())

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { description: 'a task', assignedTo: 'dev', dependencies: [] },
          ],
        })

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(0)

      consoleSpy.mockRestore()
    })

    it('应该在 PM 返回 title 为空字符串时跳过该任务', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(basePmTask())

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { title: '', description: 'desc', assignedTo: 'dev', dependencies: [] },
          ],
        })

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(0)

      consoleSpy.mockRestore()
    })

    it('应该在 PM 返回 assignedTo 无效时跳过该任务', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(basePmTask())

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { title: 'Task 1', description: 'desc', assignedTo: 'qa', dependencies: [] },
          ],
        })

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(0)

      consoleSpy.mockRestore()
    })

    it('应该在 PM 返回 dependencies 非数组时使用空数组', async () => {
      const devTask = baseDevTask('dev-1', 'Valid Task')
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(basePmTask())
        .mockReturnValueOnce(devTask)

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { title: 'Valid Task', description: 'desc', assignedTo: 'dev', dependencies: 'not-an-array' },
          ],
        })
        .mockResolvedValueOnce({ message: 'Dev done', files: [] })
        .mockResolvedValueOnce({ message: 'Review OK', status: 'success' })

      ;(taskManager.getTask as jest.Mock).mockReturnValue(devTask)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(taskManager.createTask).toHaveBeenCalledWith(
        'Valid Task', 'desc', 'dev', [], []
      )
      expect(result.success).toBe(true)

      consoleSpy.mockRestore()
    })

    it('应该在 PM 返回 null tasks 字段时当作空数组处理', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(basePmTask())

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: null,
        })

      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(0)
    })

    it('应该在混合有效和无效任务时只创建有效任务', async () => {
      const devTask = baseDevTask('dev-1', 'Valid Task')
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(basePmTask())
        .mockReturnValueOnce(devTask)

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { title: 'Valid Task', description: 'desc', assignedTo: 'dev', dependencies: [] },
            { description: 'no title', assignedTo: 'dev', dependencies: [] },
            { title: '', description: 'empty title', assignedTo: 'dev', dependencies: [] },
            { title: 'Bad Role', description: 'desc', assignedTo: 'qa', dependencies: [] },
          ],
        })
        .mockResolvedValueOnce({ message: 'Dev done', files: [] })
        .mockResolvedValueOnce({ message: 'Review OK', status: 'success' })

      ;(taskManager.getTask as jest.Mock).mockReturnValue(devTask)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(taskManager.createTask).toHaveBeenCalledTimes(2)
      expect(taskManager.createTask).toHaveBeenCalledWith(
        'Valid Task', 'desc', 'dev', [], []
      )
      expect(result.success).toBe(true)
      expect(result.stats?.totalTasks).toBe(1)

      consoleSpy.mockRestore()
    })

    it('应该在 PM 返回非对象元素时跳过并继续', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(basePmTask())

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            'not-an-object',
            42,
            null,
            { title: 'Good', description: 'desc', assignedTo: 'dev', dependencies: [] },
          ],
        })

      const devTask = baseDevTask('dev-1', 'Good')
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce(devTask)

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({ message: 'Dev done', files: [] })
        .mockResolvedValueOnce({ message: 'Review OK', status: 'success' })

      ;(taskManager.getTask as jest.Mock).mockReturnValue(devTask)

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await orchestrator.executeUserRequest('test')

      expect(taskManager.createTask).toHaveBeenCalledWith(
        'Good', 'desc', 'dev', [], []
      )
      expect(result.stats?.totalTasks).toBe(1)

      consoleSpy.mockRestore()
    })
  })
})
