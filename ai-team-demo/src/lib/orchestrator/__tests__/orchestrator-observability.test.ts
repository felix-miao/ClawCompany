import { Orchestrator } from '../index'

import { agentManager } from '@/lib/agents/manager'
import { taskManager } from '@/lib/tasks/manager'
import { chatManager } from '@/lib/chat/manager'
import {
  StructuredLogger,
  StructuredLogLevel,
  StructuredLogEntry,
  StructuredLogTransport,
} from '@/lib/core/structured-logger'
import { PerformanceMonitor } from '@/lib/core/performance-monitor'
import { ErrorTracker } from '@/lib/core/error-tracker'
import { AppError, ErrorCategory, ErrorSeverity } from '@/lib/core/errors'

jest.mock('@/lib/agents/manager')
jest.mock('@/lib/tasks/manager')
jest.mock('@/lib/chat/manager')

describe('Orchestrator Observability Integration', () => {
  let orchestrator: Orchestrator
  let capturedLogs: StructuredLogEntry[]
  let testTransport: StructuredLogTransport
  let logger: StructuredLogger
  let perfMonitor: PerformanceMonitor
  let errTracker: ErrorTracker
  const fastRetry = { maxRetries: 1, initialDelay: 1, maxDelay: 1, backoffMultiplier: 1 }

  beforeEach(() => {
    jest.clearAllMocks()
    capturedLogs = []
    testTransport = { log: (e) => capturedLogs.push(e) }
    logger = new StructuredLogger({
      minLevel: StructuredLogLevel.DEBUG,
      transports: [testTransport],
      context: { module: 'orchestrator' },
    })
    perfMonitor = new PerformanceMonitor()
    errTracker = new ErrorTracker()

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
      total: 0, pending: 0, in_progress: 0, review: 0, done: 0,
    })
  })

  describe('Structured Logging Integration', () => {
    it('should log workflow start at INFO level', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done', tasks: [],
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test request')

      const startLog = capturedLogs.find(l => l.message === 'Workflow started' && l.level === StructuredLogLevel.INFO)
      expect(startLog).toBeDefined()
      expect(startLog!.context).toHaveProperty('userMessage', 'test request')
    })

    it('should log workflow completion at INFO level', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done', tasks: [],
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      const result = await orchestrator.executeUserRequest('test request')

      const completeLog = capturedLogs.find(l => l.message === 'Workflow completed' && l.level === StructuredLogLevel.INFO)
      expect(completeLog).toBeDefined()
      expect(completeLog!.context).toHaveProperty('success', result.success)
    })

    it('should log retry attempts at WARN level', async () => {
      let attempt = 0
      ;(agentManager.executeAgent as jest.Mock).mockImplementation(async () => {
        attempt++
        if (attempt < 3) throw new Error('Temporary failure')
        return { message: 'Success', tasks: [], files: [] }
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      const retryLogs = capturedLogs.filter(l => l.message === 'Agent execution retry' && l.level === StructuredLogLevel.WARN)
      expect(retryLogs.length).toBeGreaterThanOrEqual(2)
      expect(retryLogs[0].context).toHaveProperty('role')
      expect(retryLogs[0].context).toHaveProperty('attempt')
    })

    it('should log fatal errors at ERROR level', async () => {
      // Simulate an error that escapes the retry mechanism and reaches the top level
      ;(taskManager.createTask as jest.Mock).mockImplementation(() => {
        throw new Error('Fatal error that escapes retry')
      })

      orchestrator = new Orchestrator('test-project', fastRetry, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      
      // The orchestrator should handle the error gracefully and return an error response
      const result = await orchestrator.executeUserRequest('test')
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Fatal error that escapes retry')
      
      const fatalLog = capturedLogs.find(l => l.message === 'Fatal error in executeUserRequest' && l.level === StructuredLogLevel.ERROR)
      expect(fatalLog).toBeDefined()
    })

    it('should log file save operations at INFO level', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task', title: 'PM', description: 'PM', assignedTo: 'pm',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1', title: 'Dev', description: 'Dev', assignedTo: 'dev',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [{ title: 'Dev Task', description: 'Dev Task', assignedTo: 'dev', dependencies: [], files: [] }],
        })
        .mockResolvedValueOnce({
          message: 'Dev done',
          files: [{ path: 'output/src/a.ts', content: 'code', action: 'create' }],
        })
        .mockResolvedValueOnce({
          message: 'Review OK', status: 'success',
        })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('create file')

      const saveLog = capturedLogs.find(l => l.message === 'File saved' && l.level === StructuredLogLevel.INFO)
      expect(saveLog).toBeDefined()
      expect(saveLog!.context).toHaveProperty('path', 'output/src/a.ts')
    })

    it('should log file save errors at ERROR level', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task', title: 'PM', description: 'PM', assignedTo: 'pm',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1', title: 'Dev', description: 'Dev', assignedTo: 'dev',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [{ title: 'Dev Task', description: 'Dev Task', assignedTo: 'dev', dependencies: [], files: [] }],
        })
        .mockResolvedValueOnce({
          message: 'Dev done',
          files: [{ path: '/src/a.ts', content: 'code', action: 'create' }],
        })
        .mockResolvedValueOnce({
          message: 'Review OK', status: 'success',
        })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('create file')

      const errorLog = capturedLogs.find(l => l.message === 'File save failed' && l.level === StructuredLogLevel.ERROR)
      expect(errorLog).toBeDefined()
      expect(errorLog!.context).toHaveProperty('path', '/src/a.ts')
    })

    it('should include module context in all log entries', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done', tasks: [],
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      for (const entry of capturedLogs) {
        expect(entry.context).toHaveProperty('module', 'orchestrator')
      }
    })

    it('should log task execution start and completion', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task', title: 'PM', description: 'PM', assignedTo: 'pm',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1', title: 'Dev', description: 'Dev', assignedTo: 'dev',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [{ title: 'Dev Task', description: 'Dev Task', assignedTo: 'dev', dependencies: [], files: [] }],
        })
        .mockResolvedValueOnce({
          message: 'Dev done', files: [],
        })
        .mockResolvedValueOnce({
          message: 'Review OK', status: 'success',
        })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('build feature')

      const taskStartLogs = capturedLogs.filter(l => l.message === 'Task execution started')
      const taskCompleteLogs = capturedLogs.filter(l => l.message === 'Task execution completed')
      expect(taskStartLogs.length).toBeGreaterThanOrEqual(1)
      expect(taskCompleteLogs.length).toBeGreaterThanOrEqual(1)
    })

    it('should log dependency skip at WARN level', async () => {
      const task1 = {
        id: 'dev-1', title: 'Task 1', description: 'Task 1', assignedTo: 'dev' as const,
        dependencies: [] as string[], files: [] as string[], status: 'pending' as const,
        createdAt: new Date(), updatedAt: new Date(),
      }
      const task2 = {
        id: 'dev-2', title: 'Task 2', description: 'Task 2', assignedTo: 'dev' as const,
        dependencies: ['dev-1'], files: [] as string[], status: 'pending' as const,
        createdAt: new Date(), updatedAt: new Date(),
      }

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task', title: 'PM', description: 'PM', assignedTo: 'pm',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce(task1)
        .mockReturnValueOnce(task2)

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'Task 2', description: 'Task 2', assignedTo: 'dev', dependencies: ['dev-1'], files: [] },
          ],
        })
        .mockRejectedValue(new Error('Failed'))

      orchestrator = new Orchestrator('test-project', fastRetry, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      const skipLog = capturedLogs.find(l => l.message === 'Skipping task: dependency not completed' && l.level === StructuredLogLevel.WARN)
      expect(skipLog).toBeDefined()
      expect(skipLog!.context).toHaveProperty('taskId')
    }, 10000)

    it('should log all retries exhausted at ERROR level', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockRejectedValue(new Error('Persistent'))

      orchestrator = new Orchestrator('test-project', fastRetry, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      const exhaustedLog = capturedLogs.find(l => l.message === 'Agent retries exhausted' && l.level === StructuredLogLevel.ERROR)
      expect(exhaustedLog).toBeDefined()
    })
  })

  describe('Performance Monitoring Integration', () => {
    it('should track workflow execution time as histogram', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done', tasks: [],
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      const stats = perfMonitor.getHistogramStats('orchestrator.workflow.duration')
      expect(stats).toBeDefined()
      expect(stats!.count).toBe(1)
      expect(stats!.min).toBeGreaterThanOrEqual(0)
    })

    it('should track agent execution time per role', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task', title: 'PM', description: 'PM', assignedTo: 'pm',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1', title: 'Dev', description: 'Dev', assignedTo: 'dev',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [{ title: 'Dev Task', description: 'Dev Task', assignedTo: 'dev', dependencies: [], files: [] }],
        })
        .mockResolvedValueOnce({
          message: 'Dev done', files: [],
        })
        .mockResolvedValueOnce({
          message: 'Review OK', status: 'success',
        })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('build')

      const pmStats = perfMonitor.getHistogramStats('agent.pm')
      const devStats = perfMonitor.getHistogramStats('agent.dev')
      const reviewStats = perfMonitor.getHistogramStats('agent.review')

      expect(pmStats).toBeDefined()
      expect(devStats).toBeDefined()
      expect(reviewStats).toBeDefined()
    })

    it('should increment task counters', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task', title: 'PM', description: 'PM', assignedTo: 'pm',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1', title: 'Dev', description: 'Dev', assignedTo: 'dev',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [{ title: 'Dev Task', description: 'Dev Task', assignedTo: 'dev', dependencies: [], files: [] }],
        })
        .mockResolvedValueOnce({
          message: 'Dev done', files: [],
        })
        .mockResolvedValueOnce({
          message: 'Review OK', status: 'success',
        })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('build')

      expect(perfMonitor.getCounter('orchestrator.tasks.total')).toBe(1)
      expect(perfMonitor.getCounter('orchestrator.tasks.completed')).toBe(2)
    })

    it('should track retry counter', async () => {
      let attempt = 0
      ;(agentManager.executeAgent as jest.Mock).mockImplementation(async () => {
        attempt++
        if (attempt < 3) throw new Error('Temporary')
        return { message: 'Success', tasks: [], files: [] }
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      expect(perfMonitor.getCounter('orchestrator.retries')).toBeGreaterThanOrEqual(2)
    })

    it('should track failed tasks counter', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task', title: 'PM', description: 'PM', assignedTo: 'pm',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1', title: 'Task 1', description: 'Task 1', assignedTo: 'dev',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-2', title: 'Task 2', description: 'Task 2', assignedTo: 'dev',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [
            { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: [], files: [] },
            { title: 'Task 2', description: 'Task 2', assignedTo: 'dev', dependencies: [], files: [] },
          ],
        })
        .mockRejectedValueOnce(new Error('Fail'))
        .mockRejectedValueOnce(new Error('Fail'))
        .mockRejectedValueOnce(new Error('Fail'))
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce({ message: 'Dev 2 done', files: [], status: 'success' })
        .mockResolvedValueOnce({ message: 'Review OK', status: 'success' })

      orchestrator = new Orchestrator('test-project', fastRetry, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      expect(perfMonitor.getCounter('orchestrator.tasks.failed')).toBeGreaterThanOrEqual(1)
    })

    it('should set active tasks gauge', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockImplementation(async () => {
        expect(perfMonitor.getGauge('orchestrator.tasks.active')).toBeDefined()
        return { message: 'PM done', tasks: [], files: [] }
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      expect(perfMonitor.getGauge('orchestrator.tasks.active')).toBeDefined()
    })
  })

  describe('Error Tracking Integration', () => {
    const fastRetry = { maxRetries: 1, initialDelay: 1, maxDelay: 1, backoffMultiplier: 1 }

    it('should track errors with OrchestratorError category for agent failures', async () => {
      const mockFn = agentManager.executeAgent as jest.Mock
      mockFn.mockReset()
      mockFn.mockRejectedValue(new Error('Agent error'))

      orchestrator = new Orchestrator('test-project', fastRetry, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      const orchErrors = errTracker.getByCategory(ErrorCategory.ORCHESTRATOR)
      expect(orchErrors.length).toBeGreaterThanOrEqual(1)
    })

    it('should track dependency resolution errors', async () => {
      const dev1 = {
        id: 'dev-1', title: 'Task 1', description: 'Task 1', assignedTo: 'dev' as const,
        dependencies: ['dev-2'], files: [] as string[], status: 'pending' as const,
        createdAt: new Date(), updatedAt: new Date(),
      }
      const dev2 = {
        id: 'dev-2', title: 'Task 2', description: 'Task 2', assignedTo: 'dev' as const,
        dependencies: ['dev-1'], files: [] as string[], status: 'pending' as const,
        createdAt: new Date(), updatedAt: new Date(),
      }

      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task', title: 'PM', description: 'PM', assignedTo: 'pm',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce(dev1)
        .mockReturnValueOnce(dev2)

      ;(agentManager.executeAgent as jest.Mock).mockResolvedValueOnce({
        message: 'PM done',
        tasks: [
          { title: 'Task 1', description: 'Task 1', assignedTo: 'dev', dependencies: ['dev-2'], files: [] },
          { title: 'Task 2', description: 'Task 2', assignedTo: 'dev', dependencies: ['dev-1'], files: [] },
        ],
      })

      orchestrator = new Orchestrator('test-project', fastRetry, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      expect(errTracker.getCount()).toBeGreaterThanOrEqual(1)
      const depErrors = errTracker.getByCategory(ErrorCategory.ORCHESTRATOR)
      expect(depErrors.length).toBeGreaterThanOrEqual(1)
    })

    it('should track file save errors with FILESYSTEM category', async () => {
      ;(taskManager.createTask as jest.Mock)
        .mockReturnValueOnce({
          id: 'pm-task', title: 'PM', description: 'PM', assignedTo: 'pm',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })
        .mockReturnValueOnce({
          id: 'dev-1', title: 'Dev', description: 'Dev', assignedTo: 'dev',
          dependencies: [], files: [], status: 'pending', createdAt: new Date(), updatedAt: new Date(),
        })

      ;(agentManager.executeAgent as jest.Mock)
        .mockResolvedValueOnce({
          message: 'PM done',
          tasks: [{ title: 'Dev Task', description: 'Dev Task', assignedTo: 'dev', dependencies: [], files: [] }],
        })
        .mockResolvedValueOnce({
          message: 'Dev done',
          files: [{ path: '/src/a.ts', content: 'code', action: 'create' }],
        })
        .mockResolvedValueOnce({
          message: 'Review OK', status: 'success',
        })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('create file')

      const fsErrors = errTracker.getByCategory(ErrorCategory.FILESYSTEM)
      expect(fsErrors.length).toBeGreaterThanOrEqual(1)
    })

    it('should provide error summary via getObservability', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockRejectedValue(new Error('Error 1'))

      orchestrator = new Orchestrator('test-project', fastRetry, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      const obs = orchestrator.getObservability()
      expect(obs.errorSummary).toBeDefined()
      expect(obs.errorSummary.total).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Observability API', () => {
    it('should expose getObservability() returning full snapshot', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done', tasks: [],
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      const obs = orchestrator.getObservability()
      expect(obs).toHaveProperty('performance')
      expect(obs).toHaveProperty('errorSummary')
      expect(obs).toHaveProperty('logCount')
      expect(obs.performance).toHaveProperty('counters')
      expect(obs.performance).toHaveProperty('gauges')
      expect(obs.performance).toHaveProperty('histograms')
    })

    it('should track logCount as number of captured logs', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done', tasks: [],
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      const obs = orchestrator.getObservability()
      expect(obs.logCount).toBe(capturedLogs.length)
    })

    it('should reset observability state', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done', tasks: [],
      })

      orchestrator = new Orchestrator('test-project', undefined, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      expect(perfMonitor.getCounter('orchestrator.tasks.total')).toBe(0)

      orchestrator.resetObservability()

      expect(perfMonitor.getCounter('orchestrator.workflow.duration')).toBe(0)
      expect(errTracker.getCount()).toBe(0)
    })

    it('should work without observability (backward compatible)', async () => {
      ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
        message: 'PM done', tasks: [],
      })

      orchestrator = new Orchestrator('test-project', { maxRetries: 0, initialDelay: 1, maxDelay: 1, backoffMultiplier: 1 })
      const result = await orchestrator.executeUserRequest('test')

      expect(result.success).toBe(true)
      const obs = orchestrator.getObservability()
      expect(obs).toBeDefined()
    })
  })

  describe('Orchestrator with AppError', () => {
    const fastRetry = { maxRetries: 1, initialDelay: 1, maxDelay: 1, backoffMultiplier: 1 }

    it('should track AppError with proper category and severity', async () => {
      const appErr = new AppError('AGENT_FAIL', 'agent failed', ErrorCategory.AGENT, {
        severity: ErrorSeverity.HIGH,
        context: { taskId: 't1' },
      })
      ;(agentManager.executeAgent as jest.Mock).mockRejectedValue(appErr)

      orchestrator = new Orchestrator('test-project', fastRetry, { logger, performanceMonitor: perfMonitor, errorTracker: errTracker })
      await orchestrator.executeUserRequest('test')

      const tracked = errTracker.getAll()
      expect(tracked.some(e => e.category === ErrorCategory.AGENT)).toBe(true)
    })
  })
})
