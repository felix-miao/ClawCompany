import { BaseOrchestrator, OrchestratorCallbacks, ObservabilityConfig } from '../base-orchestrator'
import { AgentContext, AgentResponse, AgentRole, Task, FileChange, RetryConfig } from '../types'
import { Logger, LogLevel, LogEntry } from '../logger'

class TestOrchestrator extends BaseOrchestrator {
  private callbacks: OrchestratorCallbacks

  constructor(callbacks: OrchestratorCallbacks, retryConfig?: Partial<RetryConfig>, observability?: ObservabilityConfig) {
    super(retryConfig, observability)
    this.callbacks = callbacks
  }

  protected getCallbacks(): OrchestratorCallbacks {
    return this.callbacks
  }

  async executeUserRequest(_userMessage: string) {
    return {
      success: false,
      messages: [],
      tasks: [],
    }
  }

  async exposeBuildContext(callbacks: OrchestratorCallbacks): Promise<AgentContext> {
    return this.buildContext(callbacks)
  }

  async exposeExecuteSingleTask(
    task: Task,
    cb: OrchestratorCallbacks,
    subTaskIds: string[],
    completedTaskIds: Set<string>,
    allFiles: import('../types').FileChange[],
  ): Promise<void> {
    return this.executeSingleTask(task, cb, subTaskIds, completedTaskIds, allFiles)
  }
}

function makeMockCallbacks(overrides?: Partial<OrchestratorCallbacks>): OrchestratorCallbacks {
  return {
    sendUserMessage: jest.fn(),
    broadcast: jest.fn(),
    createTask: jest.fn().mockReturnValue({
      id: 'task-1',
      title: 'Test',
      description: 'Test',
      assignedTo: 'dev' as const,
      dependencies: [],
      files: [],
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getTask: jest.fn(),
    updateTaskStatus: jest.fn(),
    getAllTasks: jest.fn().mockReturnValue([]),
    getChatHistory: jest.fn().mockReturnValue([]),
    executeAgent: jest.fn().mockResolvedValue({ agent: 'pm' as AgentRole, message: 'ok', status: 'success' as const }),
    ...overrides,
  }
}

describe('BaseOrchestrator - buildContext', () => {
  it('should populate files from task file references', async () => {
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Setup DB',
        description: 'Create database schema',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: ['src/db/schema.ts', 'src/db/migrations.ts'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const callbacks = makeMockCallbacks({
      getAllTasks: jest.fn().mockReturnValue(mockTasks),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    expect(context.tasks).toEqual(mockTasks)
    expect(context.files).toBeDefined()
    expect(Object.keys(context.files)).toEqual(
      expect.arrayContaining(['src/db/schema.ts', 'src/db/migrations.ts']),
    )
  })

  it('should populate chatHistory from getChatHistory callback', async () => {
    const chatHistory = [
      { agent: 'user' as const, content: 'Build a feature', timestamp: new Date() },
      { agent: 'pm' as const, content: 'Here is my analysis', timestamp: new Date() },
    ]

    const callbacks = makeMockCallbacks({
      getChatHistory: jest.fn().mockReturnValue(chatHistory),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    expect(context.chatHistory).toHaveLength(2)
    expect(context.chatHistory[0].agent).toBe('user')
    expect(context.chatHistory[0].content).toBe('Build a feature')
    expect(context.chatHistory[1].agent).toBe('pm')
    expect(context.chatHistory[1].content).toBe('Here is my analysis')
  })

  it('should return empty files when tasks have no file references', async () => {
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Think',
        description: 'Analysis only',
        status: 'pending',
        assignedTo: 'pm',
        dependencies: [],
        files: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const callbacks = makeMockCallbacks({
      getAllTasks: jest.fn().mockReturnValue(mockTasks),
      getChatHistory: jest.fn().mockReturnValue([]),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    expect(context.files).toEqual({})
    expect(context.chatHistory).toEqual([])
  })

  it('should aggregate files from multiple tasks without duplicates', async () => {
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Setup',
        description: 'Setup project',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: ['src/index.ts', 'src/config.ts'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-2',
        title: 'Feature',
        description: 'Add feature',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: ['task-1'],
        files: ['src/feature.ts', 'src/config.ts'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const callbacks = makeMockCallbacks({
      getAllTasks: jest.fn().mockReturnValue(mockTasks),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    const fileKeys = Object.keys(context.files)
    expect(fileKeys).toContain('src/index.ts')
    expect(fileKeys).toContain('src/config.ts')
    expect(fileKeys).toContain('src/feature.ts')
    expect(fileKeys.length).toBe(3)
  })

  it('should set projectId to default', async () => {
    const callbacks = makeMockCallbacks()
    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    expect(context.projectId).toBe('default')
  })

  it('should NOT pass empty files and chatHistory to executeAgent (the bug)', async () => {
    const chatHistory = [
      { agent: 'user' as const, content: 'Build feature X' },
      { agent: 'pm' as const, content: 'I analyzed it' },
    ]
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Build X',
        description: 'Build feature X',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: ['src/feature-x.ts'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    let capturedContext: AgentContext | undefined

    const callbacks = makeMockCallbacks({
      getAllTasks: jest.fn().mockReturnValue(mockTasks),
      getChatHistory: jest.fn().mockReturnValue(chatHistory),
      executeAgent: jest.fn().mockImplementation(async (_role, _task, ctx) => {
        capturedContext = ctx
        return { agent: 'dev' as AgentRole, message: 'done', status: 'success' as const }
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    expect(Object.keys(context.files).length).toBeGreaterThan(0)
    expect(context.chatHistory.length).toBeGreaterThan(0)
  })

  it('should populate file contents using readFile callback', async () => {
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Build X',
        description: 'Build feature X',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: ['src/feature-x.ts', 'src/utils.ts'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const callbacks = makeMockCallbacks({
      getAllTasks: jest.fn().mockReturnValue(mockTasks),
      readFile: jest.fn()
        .mockResolvedValueOnce('export const featureX = () => {}')
        .mockResolvedValueOnce('export const utils = () => {}'),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    expect(context.files['src/feature-x.ts']).toBe('export const featureX = () => {}')
    expect(context.files['src/utils.ts']).toBe('export const utils = () => {}')
    expect(callbacks.readFile).toHaveBeenCalledWith('src/feature-x.ts')
    expect(callbacks.readFile).toHaveBeenCalledWith('src/utils.ts')
  })

  it('should fallback to empty string when readFile returns null', async () => {
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Build',
        description: 'Build something',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: ['src/new-file.ts'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const callbacks = makeMockCallbacks({
      getAllTasks: jest.fn().mockReturnValue(mockTasks),
      readFile: jest.fn().mockResolvedValue(null),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    expect(context.files['src/new-file.ts']).toBe('')
  })

  it('should handle readFile errors gracefully', async () => {
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Build',
        description: 'Build something',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: ['src/error-file.ts'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const callbacks = makeMockCallbacks({
      getAllTasks: jest.fn().mockReturnValue(mockTasks),
      readFile: jest.fn().mockRejectedValue(new Error('Read error')),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    expect(context.files['src/error-file.ts']).toBe('')
  })

  it('should work without readFile callback (backward compatible)', async () => {
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Build',
        description: 'Build something',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: ['src/file.ts'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const callbacks = makeMockCallbacks({
      getAllTasks: jest.fn().mockReturnValue(mockTasks),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = await orchestrator.exposeBuildContext(callbacks)

    expect(context.files['src/file.ts']).toBe('')
  })
})

describe('BaseOrchestrator - executeSingleTask', () => {
  it('should execute task assigned to review role directly', async () => {
    const reviewTask: Task = {
      id: 'review-task-1',
      title: 'Code Review',
      description: 'Review the existing code',
      status: 'pending',
      assignedTo: 'review',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockResolvedValue({
        agent: 'review' as AgentRole,
        message: 'Review approved',
        status: 'success' as const,
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      reviewTask,
      callbacks,
      ['review-task-1'],
      completedTaskIds,
      allFiles,
    )

    expect(callbacks.executeAgent).toHaveBeenCalledWith(
      'review',
      reviewTask,
      expect.any(Object),
    )
    expect(callbacks.updateTaskStatus).toHaveBeenCalledWith('review-task-1', 'in_progress')
    expect(callbacks.updateTaskStatus).toHaveBeenCalledWith('review-task-1', 'completed')
    expect(completedTaskIds.has('review-task-1')).toBe(true)
    expect(callbacks.broadcast).toHaveBeenCalledWith('review', 'Review approved')
  })

  it('should execute task assigned to pm role directly', async () => {
    const pmTask: Task = {
      id: 'pm-task-1',
      title: 'Analysis',
      description: 'Analyze requirements',
      status: 'pending',
      assignedTo: 'pm',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockResolvedValue({
        agent: 'pm' as AgentRole,
        message: 'Analysis done',
        status: 'success' as const,
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      pmTask,
      callbacks,
      ['pm-task-1'],
      completedTaskIds,
      allFiles,
    )

    expect(callbacks.executeAgent).toHaveBeenCalledWith(
      'pm',
      pmTask,
      expect.any(Object),
    )
    expect(completedTaskIds.has('pm-task-1')).toBe(true)
  })

  it('should record failure when non-dev task agent fails after retries', async () => {
    const reviewTask: Task = {
      id: 'review-task-1',
      title: 'Review',
      description: 'Review code',
      status: 'pending',
      assignedTo: 'review',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockRejectedValue(new Error('Review agent crashed')),
    })

    const orchestrator = new TestOrchestrator(callbacks, { maxRetries: 0, initialDelay: 1, maxDelay: 1, backoffMultiplier: 1 })
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      reviewTask,
      callbacks,
      ['review-task-1'],
      completedTaskIds,
      allFiles,
    )

    expect(completedTaskIds.has('review-task-1')).toBe(false)
    const obs = orchestrator.getObservability()
    expect(obs.errorSummary.total).toBeGreaterThan(0)
  })

  it('should emit task:started and task:completed events for review task', async () => {
    const reviewTask: Task = {
      id: 'review-task-1',
      title: 'Review',
      description: 'Review code',
      status: 'pending',
      assignedTo: 'review',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockResolvedValue({
        agent: 'review' as AgentRole,
        message: 'Looks good',
        status: 'success' as const,
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      reviewTask,
      callbacks,
      ['review-task-1'],
      completedTaskIds,
      allFiles,
    )

    const events = orchestrator.getEventBus().getHistory()
    const startedEvents = events.filter(e => e.type === 'task:started' && e.taskId === 'review-task-1')
    const completedEvents = events.filter(e => e.type === 'task:completed' && e.taskId === 'review-task-1')
    expect(startedEvents.length).toBe(1)
    expect(startedEvents[0].agentRole).toBe('review')
    expect(completedEvents.length).toBe(1)
    expect(completedEvents[0].agentRole).toBe('review')
  })

  it('should skip task when dependency is not completed', async () => {
    const task: Task = {
      id: 'task-2',
      title: 'Feature',
      description: 'Build feature',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: ['task-1'],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks()
    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      task,
      callbacks,
      ['task-1', 'task-2'],
      completedTaskIds,
      allFiles,
    )

    expect(callbacks.executeAgent).not.toHaveBeenCalled()
    expect(completedTaskIds.has('task-2')).toBe(false)
    const events = orchestrator.getEventBus().getHistory()
    const skippedEvents = events.filter(e => e.type === 'task:skipped' && e.taskId === 'task-2')
    expect(skippedEvents.length).toBe(1)
    expect(skippedEvents[0].data).toEqual({ dependency: 'task-1', reason: 'Dependency not completed' })
  })

  it('should not skip task when dependency is outside subTaskIds', async () => {
    const task: Task = {
      id: 'task-2',
      title: 'Feature',
      description: 'Build feature',
      status: 'pending',
      assignedTo: 'pm',
      dependencies: ['external-task'],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockResolvedValue({
        agent: 'pm' as AgentRole,
        message: 'done',
        status: 'success' as const,
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      task,
      callbacks,
      ['task-2'],
      completedTaskIds,
      allFiles,
    )

    expect(callbacks.executeAgent).toHaveBeenCalled()
  })

  it('should execute dev task: dev agent + file saving + review agent', async () => {
    const devTask: Task = {
      id: 'dev-task-1',
      title: 'Implement',
      description: 'Implement feature',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const savedFiles: Array<{ path: string; content: string }> = []
    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn()
        .mockResolvedValueOnce({
          agent: 'dev' as AgentRole,
          message: 'Implemented',
          status: 'success' as const,
          files: [
            { path: 'src/feature.ts', content: 'export const feature = 1', action: 'create' as const },
          ],
        })
        .mockResolvedValueOnce({
          agent: 'review' as AgentRole,
          message: 'Approved',
          status: 'success' as const,
        }),
      saveFile: jest.fn().mockImplementation(async (path: string, content: string) => {
        savedFiles.push({ path, content })
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      devTask,
      callbacks,
      ['dev-task-1'],
      completedTaskIds,
      allFiles,
    )

    expect(callbacks.executeAgent).toHaveBeenCalledTimes(2)
    expect(callbacks.broadcast).toHaveBeenCalledWith('dev', 'Implemented')
    expect(callbacks.broadcast).toHaveBeenCalledWith('review', 'Approved')
    expect(savedFiles).toEqual([{ path: 'src/feature.ts', content: 'export const feature = 1' }])
    expect(allFiles).toEqual([{ path: 'src/feature.ts', content: 'export const feature = 1', action: 'create' }])
    expect(callbacks.updateTaskStatus).toHaveBeenCalledWith('dev-task-1', 'in_progress')
    expect(callbacks.updateTaskStatus).toHaveBeenCalledWith('dev-task-1', 'review')
    expect(callbacks.updateTaskStatus).toHaveBeenCalledWith('dev-task-1', 'completed')
    expect(completedTaskIds.has('dev-task-1')).toBe(true)
  })

  it('should handle file save errors gracefully for dev task', async () => {
    const devTask: Task = {
      id: 'dev-task-2',
      title: 'Implement',
      description: 'Implement feature',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn()
        .mockResolvedValueOnce({
          agent: 'dev' as AgentRole,
          message: 'Done',
          status: 'success' as const,
          files: [
            { path: 'src/bad.ts', content: 'bad content', action: 'create' as const },
          ],
        })
        .mockResolvedValueOnce({
          agent: 'review' as AgentRole,
          message: 'Approved',
          status: 'success' as const,
        }),
      saveFile: jest.fn().mockRejectedValue(new Error('Disk full')),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      devTask,
      callbacks,
      ['dev-task-2'],
      completedTaskIds,
      allFiles,
    )

    expect(allFiles).toEqual([{ path: 'src/bad.ts', content: 'bad content', action: 'create' }])
    expect(completedTaskIds.has('dev-task-2')).toBe(true)
    const events = orchestrator.getEventBus().getHistory()
    const errorEvents = events.filter(e => e.type === 'error:tracked' && e.data?.path === 'src/bad.ts')
    expect(errorEvents.length).toBeGreaterThan(0)
  })

  it('should fail dev task when dev agent returns null', async () => {
    const devTask: Task = {
      id: 'dev-task-3',
      title: 'Implement',
      description: 'Implement feature',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockRejectedValue(new Error('Agent crashed')),
    })

    const orchestrator = new TestOrchestrator(callbacks, { maxRetries: 0, initialDelay: 1, maxDelay: 1, backoffMultiplier: 1 })
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      devTask,
      callbacks,
      ['dev-task-3'],
      completedTaskIds,
      allFiles,
    )

    expect(completedTaskIds.has('dev-task-3')).toBe(false)
    expect(callbacks.updateTaskStatus).not.toHaveBeenCalledWith('dev-task-3', 'review')
    const events = orchestrator.getEventBus().getHistory()
    const failedEvents = events.filter(e => e.type === 'task:failed' && e.taskId === 'dev-task-3')
    expect(failedEvents.length).toBe(1)
    expect(failedEvents[0].agentRole).toBe('dev')
  })

  it('should fail dev task when review agent returns null', async () => {
    const devTask: Task = {
      id: 'dev-task-4',
      title: 'Implement',
      description: 'Implement feature',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    let callCount = 0
    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return { agent: 'dev' as AgentRole, message: 'Done', status: 'success' as const }
        }
        throw new Error('Review agent crashed')
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks, { maxRetries: 0, initialDelay: 1, maxDelay: 1, backoffMultiplier: 1 })
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      devTask,
      callbacks,
      ['dev-task-4'],
      completedTaskIds,
      allFiles,
    )

    expect(completedTaskIds.has('dev-task-4')).toBe(false)
    const events = orchestrator.getEventBus().getHistory()
    const failedEvents = events.filter(e => e.type === 'task:failed' && e.taskId === 'dev-task-4')
    expect(failedEvents.length).toBe(1)
    expect(failedEvents[0].agentRole).toBe('review')
  })

  it('should mark dev task as failed when review returns non-success', async () => {
    const devTask: Task = {
      id: 'dev-task-5',
      title: 'Implement',
      description: 'Implement feature',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn()
        .mockResolvedValueOnce({
          agent: 'dev' as AgentRole,
          message: 'Done',
          status: 'success' as const,
        })
        .mockResolvedValueOnce({
          agent: 'review' as AgentRole,
          message: 'Needs fixes',
          status: 'error' as const,
        }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      devTask,
      callbacks,
      ['dev-task-5'],
      completedTaskIds,
      allFiles,
    )

    expect(completedTaskIds.has('dev-task-5')).toBe(false)
    expect(callbacks.updateTaskStatus).toHaveBeenCalledWith('dev-task-5', 'failed')
    expect(callbacks.updateTaskStatus).not.toHaveBeenCalledWith('dev-task-5', 'pending')

    const events = orchestrator.getEventBus().getHistory()
    const failedEvents = events.filter(e => e.type === 'task:failed' && e.taskId === 'dev-task-5')
    expect(failedEvents.length).toBe(1)
    expect(failedEvents[0].agentRole).toBe('review')

    const obs = orchestrator.getObservability()
    expect(obs.errorSummary.total).toBeGreaterThan(0)
  })

  it('should handle unexpected errors in task execution', async () => {
    const task: Task = {
      id: 'task-err',
      title: 'Risky task',
      description: 'Might fail',
      status: 'pending',
      assignedTo: 'pm',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      updateTaskStatus: jest.fn().mockImplementation(() => {
        throw new Error('Unexpected DB error')
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      task,
      callbacks,
      ['task-err'],
      completedTaskIds,
      allFiles,
    )

    expect(completedTaskIds.has('task-err')).toBe(false)
    const events = orchestrator.getEventBus().getHistory()
    const failedEvents = events.filter(e => e.type === 'task:failed' && e.taskId === 'task-err')
    expect(failedEvents.length).toBe(1)
    expect(failedEvents[0].data?.error).toBe('Unexpected DB error')
  })

  it('should mark non-dev task as failed when agent returns non-success', async () => {
    const pmTask: Task = {
      id: 'pm-task-2',
      title: 'Analysis',
      description: 'Analyze',
      status: 'pending',
      assignedTo: 'pm',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockResolvedValue({
        agent: 'pm' as AgentRole,
        message: 'Need more info',
        status: 'need_input' as const,
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      pmTask,
      callbacks,
      ['pm-task-2'],
      completedTaskIds,
      allFiles,
    )

    expect(completedTaskIds.has('pm-task-2')).toBe(false)
    expect(callbacks.updateTaskStatus).toHaveBeenCalledWith('pm-task-2', 'failed')
    expect(callbacks.updateTaskStatus).not.toHaveBeenCalledWith('pm-task-2', 'pending')

    const events = orchestrator.getEventBus().getHistory()
    const failedEvents = events.filter(e => e.type === 'task:failed' && e.taskId === 'pm-task-2')
    expect(failedEvents.length).toBe(1)

    const obs = orchestrator.getObservability()
    expect(obs.performance.counters['orchestrator.tasks.failed']).toBeGreaterThanOrEqual(1)
  })

  it('should emit task:started event for dev task', async () => {
    const devTask: Task = {
      id: 'dev-task-6',
      title: 'Implement',
      description: 'Implement feature',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn()
        .mockResolvedValueOnce({
          agent: 'dev' as AgentRole,
          message: 'Done',
          status: 'success' as const,
        })
        .mockResolvedValueOnce({
          agent: 'review' as AgentRole,
          message: 'Approved',
          status: 'success' as const,
        }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      devTask,
      callbacks,
      ['dev-task-6'],
      completedTaskIds,
      allFiles,
    )

    const events = orchestrator.getEventBus().getHistory()
    const startedEvents = events.filter(e => e.type === 'task:started' && e.taskId === 'dev-task-6')
    expect(startedEvents.length).toBe(2)
    expect(startedEvents[0].agentRole).toBe('dev')
    expect(startedEvents[1].agentRole).toBe('review')
  })

  it('should increment orchestrator.tasks.completed on success', async () => {
    const task: Task = {
      id: 'task-metrics',
      title: 'Task',
      description: 'desc',
      status: 'pending',
      assignedTo: 'review',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockResolvedValue({
        agent: 'review' as AgentRole,
        message: 'Done',
        status: 'success' as const,
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      task,
      callbacks,
      ['task-metrics'],
      completedTaskIds,
      allFiles,
    )

    const obs = orchestrator.getObservability()
    expect(obs.performance.counters['orchestrator.tasks.completed']).toBe(1)
  })

  it('should increment orchestrator.tasks.failed on agent failure', async () => {
    const task: Task = {
      id: 'task-fail-metrics',
      title: 'Task',
      description: 'desc',
      status: 'pending',
      assignedTo: 'review',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockRejectedValue(new Error('Boom')),
    })

    const orchestrator = new TestOrchestrator(callbacks, { maxRetries: 0, initialDelay: 1, maxDelay: 1, backoffMultiplier: 1 })
    const completedTaskIds = new Set<string>()
    const allFiles: FileChange[] = []

    await orchestrator.exposeExecuteSingleTask(
      task,
      callbacks,
      ['task-fail-metrics'],
      completedTaskIds,
      allFiles,
    )

    const obs = orchestrator.getObservability()
    expect(obs.performance.counters['orchestrator.tasks.failed']).toBeGreaterThanOrEqual(1)
  })
})

describe('BaseOrchestrator - logging', () => {
  class LogCapturingOrchestrator extends BaseOrchestrator {
    protected getCallbacks(): OrchestratorCallbacks {
      return makeMockCallbacks()
    }
    async executeUserRequest() {
      return { success: false, messages: [], tasks: [] }
    }
    testLogInfo(msg: string, ctx?: Record<string, unknown>) { this.logInfo(msg, ctx) }
    testLogWarn(msg: string, ctx?: Record<string, unknown>) { this.logWarn(msg, ctx) }
    testLogError(msg: string, ctx?: Record<string, unknown>) { this.logError(msg, ctx) }
  }

  it('should not call console.log/warn/error directly (no double output)', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const captured: LogEntry[] = []
    const logger = new Logger({
      minLevel: LogLevel.DEBUG,
      transports: [{ log: (entry) => captured.push(entry) }],
    })

    const orch = new LogCapturingOrchestrator({}, { logger })
    orch.testLogInfo('info msg', { key: 'val' })
    orch.testLogWarn('warn msg', { key: 'val' })
    orch.testLogError('error msg', { key: 'val' })

    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(captured).toHaveLength(3)
    expect(captured[0].level).toBe(LogLevel.INFO)
    expect(captured[1].level).toBe(LogLevel.WARN)
    expect(captured[2].level).toBe(LogLevel.ERROR)

    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('should respect minLevel filtering', () => {
    const captured: LogEntry[] = []
    const logger = new Logger({
      minLevel: LogLevel.WARN,
      transports: [{ log: (entry) => captured.push(entry) }],
    })

    const orch = new LogCapturingOrchestrator({}, { logger })
    orch.testLogInfo('should be filtered')
    orch.testLogWarn('should pass')
    orch.testLogError('should also pass')

    expect(captured).toHaveLength(2)
    expect(captured[0].levelName).toBe('WARN')
    expect(captured[0].message).toBe('should pass')
    expect(captured[1].levelName).toBe('ERROR')
    expect(captured[1].message).toBe('should also pass')
  })

  it('should not throw when no logger is provided', () => {
    const orch = new LogCapturingOrchestrator()
    expect(() => {
      orch.testLogInfo('no logger')
      orch.testLogWarn('no logger')
      orch.testLogError('no logger')
    }).not.toThrow()
  })

  it('should emit error:tracked events for warn and error but not info', () => {
    const orch = new LogCapturingOrchestrator()
    orch.testLogInfo('info msg')
    orch.testLogWarn('warn msg')
    orch.testLogError('error msg')

    const events = orch.getEventBus().getHistory()
    const trackedEvents = events.filter(e => e.type === 'error:tracked')
    expect(trackedEvents).toHaveLength(2)
    expect(trackedEvents[0].data.level).toBe('warn')
    expect(trackedEvents[1].data.level).toBe('error')
  })
})

describe('BaseOrchestrator - agent execution metrics correctness', () => {
  it('should not record a separate orchestrator.agent.${role}.duration metric (redundant with stopTimer)', async () => {
    const task: Task = {
      id: 'metric-task',
      title: 'Test',
      description: 'Test',
      status: 'pending',
      assignedTo: 'review',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockResolvedValue({
        agent: 'review' as AgentRole,
        message: 'done',
        status: 'success' as const,
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    ;(orchestrator as any).startTime = Date.now() - 5000

    await orchestrator.exposeExecuteSingleTask(task, callbacks, ['metric-task'], new Set(), [])

    const obs = orchestrator.getObservability()
    expect(obs.performance.histograms['orchestrator.agent.review.duration']).toBeUndefined()
  })

  it('should record agent duration via stopTimer into agent.${role} histogram', async () => {
    const task: Task = {
      id: 'timer-task',
      title: 'Test',
      description: 'Test',
      status: 'pending',
      assignedTo: 'review',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { agent: 'review' as AgentRole, message: 'done', status: 'success' as const }
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    ;(orchestrator as any).startTime = Date.now()

    await orchestrator.exposeExecuteSingleTask(task, callbacks, ['timer-task'], new Set(), [])

    const obs = orchestrator.getObservability()
    const agentStats = obs.performance.histograms['agent.review']
    expect(agentStats).toBeDefined()
    expect(agentStats!.count).toBe(1)
    expect(agentStats!.avg).toBeGreaterThan(0)
    expect(agentStats!.avg).toBeLessThan(5000)
  })

  it('should record correct agent duration on retry failure too', async () => {
    const task: Task = {
      id: 'retry-metric-task',
      title: 'Test',
      description: 'Test',
      status: 'pending',
      assignedTo: 'review',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    let attempt = 0
    const callbacks = makeMockCallbacks({
      executeAgent: jest.fn().mockImplementation(async () => {
        attempt++
        if (attempt < 2) throw new Error('fail')
        return { agent: 'review' as AgentRole, message: 'done', status: 'success' as const }
      }),
    })

    const orchestrator = new TestOrchestrator(callbacks, {
      maxRetries: 2,
      initialDelay: 1,
      maxDelay: 10,
      backoffMultiplier: 1,
    })
    ;(orchestrator as any).startTime = Date.now() - 10000

    await orchestrator.exposeExecuteSingleTask(task, callbacks, ['retry-metric-task'], new Set(), [])

    const obs = orchestrator.getObservability()
    expect(obs.performance.histograms['orchestrator.agent.review.duration']).toBeUndefined()

    const agentStats = obs.performance.histograms['agent.review']
    expect(agentStats).toBeDefined()
    expect(agentStats!.count).toBe(2)
  })
})
