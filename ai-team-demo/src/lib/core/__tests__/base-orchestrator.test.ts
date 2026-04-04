import { BaseOrchestrator, OrchestratorCallbacks } from '../base-orchestrator'
import { AgentContext, AgentResponse, AgentRole, Task } from '../types'

class TestOrchestrator extends BaseOrchestrator {
  private callbacks: OrchestratorCallbacks

  constructor(callbacks: OrchestratorCallbacks) {
    super()
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

  exposeBuildContext(callbacks: OrchestratorCallbacks): AgentContext {
    return this.buildContext(callbacks)
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
  it('should populate files from task file references', () => {
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
    const context = orchestrator.exposeBuildContext(callbacks)

    expect(context.tasks).toEqual(mockTasks)
    expect(context.files).toBeDefined()
    expect(Object.keys(context.files)).toEqual(
      expect.arrayContaining(['src/db/schema.ts', 'src/db/migrations.ts']),
    )
  })

  it('should populate chatHistory from getChatHistory callback', () => {
    const chatHistory = [
      { agent: 'user' as const, content: 'Build a feature', timestamp: new Date() },
      { agent: 'pm' as const, content: 'Here is my analysis', timestamp: new Date() },
    ]

    const callbacks = makeMockCallbacks({
      getChatHistory: jest.fn().mockReturnValue(chatHistory),
    })

    const orchestrator = new TestOrchestrator(callbacks)
    const context = orchestrator.exposeBuildContext(callbacks)

    expect(context.chatHistory).toHaveLength(2)
    expect(context.chatHistory[0].agent).toBe('user')
    expect(context.chatHistory[0].content).toBe('Build a feature')
    expect(context.chatHistory[1].agent).toBe('pm')
    expect(context.chatHistory[1].content).toBe('Here is my analysis')
  })

  it('should return empty files when tasks have no file references', () => {
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
    const context = orchestrator.exposeBuildContext(callbacks)

    expect(context.files).toEqual({})
    expect(context.chatHistory).toEqual([])
  })

  it('should aggregate files from multiple tasks without duplicates', () => {
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
    const context = orchestrator.exposeBuildContext(callbacks)

    const fileKeys = Object.keys(context.files)
    expect(fileKeys).toContain('src/index.ts')
    expect(fileKeys).toContain('src/config.ts')
    expect(fileKeys).toContain('src/feature.ts')
    expect(fileKeys.length).toBe(3)
  })

  it('should set projectId to default', () => {
    const callbacks = makeMockCallbacks()
    const orchestrator = new TestOrchestrator(callbacks)
    const context = orchestrator.exposeBuildContext(callbacks)

    expect(context.projectId).toBe('default')
  })

  it('should NOT pass empty files and chatHistory to executeAgent (the bug)', () => {
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
    const context = orchestrator.exposeBuildContext(callbacks)

    expect(Object.keys(context.files).length).toBeGreaterThan(0)
    expect(context.chatHistory.length).toBeGreaterThan(0)
  })
})
