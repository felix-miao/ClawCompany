/**
 * Orchestrator → GameEventStore E2E flow tests
 *
 * 覆盖缺失的 flow #2：
 *   /api/chat → Orchestrator.executeUserRequest → GameEventStore 收到正确事件序列
 *
 * 实现说明：
 *   jest.mock('@/game/data/GameEventStore') 替换整个模块，让 getGameEventStore()
 *   返回一个可控的 mock store。
 *   为避免 jest.mock 工厂提升（hoisting）导致的 TDZ 问题，使用 capturedEvents
 *   对象容器（而非 const 数组）让工厂函数通过闭包安全地积累事件。
 */

import { Orchestrator } from '../index'
import { AgentManager } from '../../agents/manager'
import { ChatManager } from '../../chat/manager'
import type { TaskManager } from '../../tasks/manager'
import { SandboxedFileWriter } from '../../security/sandbox'
import type { AgentRole, Task, AgentResponse } from '../../core/types'
import type { GameEvent } from '@/game/types/GameEvents'

// ── GameEventStore mock ────────────────────────────────────────────────────────
// Use a plain object container so the jest.mock factory (which is hoisted) can
// safely reference it via a mutable property without TDZ issues.

// eslint-disable-next-line prefer-const
let capturedEvents: { list: GameEvent[] } = { list: [] }

jest.mock('@/game/data/GameEventStore', () => {
  const mockPush = jest.fn((event: unknown) => {
    capturedEvents.list.push(event as GameEvent)
  })
  const mockStore = {
    push: mockPush,
    subscribe: jest.fn(() => () => {}),
    getEvents: jest.fn(() => []),
    getEventsByType: jest.fn(() => []),
    getEventsByAgent: jest.fn(() => []),
    getLatestEvent: jest.fn(),
    getSubscriberCount: jest.fn(() => 0),
    clear: jest.fn(),
  }
  return {
    GameEventStore: jest.fn().mockImplementation(() => mockStore),
    getGameEventStore: jest.fn(() => mockStore),
    setGameEventStore: jest.fn(),
    resetGameEventStore: jest.fn(),
    createGameEventStore: jest.fn(() => mockStore),
  }
})

// ── Other Mocks ─────────────────────────────────────────────────────────────────

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

const FAST_RETRY = { maxRetries: 1, initialDelay: 1, maxDelay: 5, backoffMultiplier: 1 }

// ── Type helpers ──────────────────────────────────────────────────────────────

type SubTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>

function makeSubTask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    title: '实现首页',
    description: '写 index.tsx',
    status: 'pending',
    assignedTo: 'dev',
    dependencies: [],
    files: [],
    ...overrides,
  }
}

function makePMResponse(tasks: SubTask[]): AgentResponse {
  return {
    agent: 'pm',
    status: 'success',
    message: 'PM 分析完成',
    tasks,
    metadata: { pmAnalysis: '用户需要一个博客网站' },
  }
}

function makeDevResponse(): AgentResponse {
  return {
    agent: 'dev',
    status: 'success',
    message: '代码实现完成',
    files: [{ path: 'src/page.tsx', content: 'export default function Page() {}', action: 'create' }],
  }
}

function makeReviewResponse(approved: boolean): AgentResponse {
  return {
    agent: 'review',
    status: approved ? 'success' : 'error',
    message: approved ? '审查通过' : '需要改进错误处理',
    metadata: { approved, score: approved ? 85 : 55 },
  }
}

// ── Orchestrator factory ──────────────────────────────────────────────────────

function buildMockTaskManager() {
  const tasks = new Map<string, Task>()
  let counter = 0
  return {
    createTask: jest.fn((title: string, description: string, assignedTo: string, dependencies: string[], files: string[]) => {
      const task: Task = {
        id: `task-${++counter}`,
        title,
        description,
        assignedTo: assignedTo as Task['assignedTo'],
        dependencies,
        files,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      tasks.set(task.id, task)
      return task
    }),
    getTask: jest.fn((id: string) => tasks.get(id)),
    updateTaskStatus: jest.fn((id: string, status: string) => {
      const task = tasks.get(id)
      if (task) { task.status = status as Task['status']; tasks.set(id, task) }
      return task
    }),
    getAllTasks: jest.fn(() => Array.from(tasks.values())),
    clearTasks: jest.fn(() => tasks.clear()),
    getStats: jest.fn(() => ({ total: 0, pending: 0, in_progress: 0, review: 0, completed: 0, failed: 0 })),
  }
}

function buildOrchestrator(mockAgent: jest.Mocked<AgentManager>): Orchestrator {
  const writer = {
    writeFile: jest.fn().mockResolvedValue(undefined),
    isAllowed: jest.fn().mockReturnValue(true),
  } as unknown as jest.Mocked<SandboxedFileWriter>

  const chat = {
    sendUserMessage: jest.fn(),
    broadcast: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    clearHistory: jest.fn(),
    addMessage: jest.fn(),
  } as unknown as jest.Mocked<ChatManager>

  return new Orchestrator(
    'test',
    FAST_RETRY,
    undefined,
    undefined,
    {
      agentManager: mockAgent,
      taskManager: buildMockTaskManager() as unknown as TaskManager,
      chatManager: chat,
      sandboxedWriter: writer,
    },
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Orchestrator → GameEventStore event flow', () => {
  let mockAgent: jest.Mocked<AgentManager>

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset captured events
    capturedEvents.list = []

    mockAgent = {
      getAgent: jest.fn(),
      getAllAgents: jest.fn(),
      getAgentInfo: jest.fn(),
      executeAgent: jest.fn(),
    } as unknown as jest.Mocked<AgentManager>
  })

  // ── Helper: standard 1-task PM→Dev→Review flow ───────────────────────────

  function wireStandardFlow(approved = true, devCallsBeforeApprove = 1) {
    let devCalls = 0
    mockAgent.executeAgent.mockImplementation(async (role: AgentRole) => {
      if (role === 'pm') return makePMResponse([makeSubTask()])
      if (role === 'dev') { devCalls++; return makeDevResponse() }
      if (role === 'review') return makeReviewResponse(approved && devCalls >= devCallsBeforeApprove)
      throw new Error(`unexpected role: ${role}`)
    })
  }

  function pushedTypes() {
    return capturedEvents.list.map((e: GameEvent) => e.type)
  }

  // ── #1 pm:analysis-complete ───────────────────────────────────────────────

  it('PM 分析完成后 GameEventStore 应收到 pm:analysis-complete 事件', async () => {
    mockAgent.executeAgent.mockImplementation(async (role: AgentRole) => {
      if (role === 'pm') return makePMResponse([])
      throw new Error('unexpected role')
    })

    const orch = buildOrchestrator(mockAgent)
    await orch.executeUserRequest('写一个博客网站')

    expect(pushedTypes()).toContain('pm:analysis-complete')
  })

  // ── #2 pm:analysis-complete taskCount ────────────────────────────────────

  it('pm:analysis-complete 事件应携带正确的 taskCount 字段', async () => {
    mockAgent.executeAgent.mockImplementation(async (role: AgentRole) => {
      if (role === 'pm') {
        return makePMResponse([
          makeSubTask({ title: '任务A' }),
          makeSubTask({ title: '任务B' }),
        ])
      }
      if (role === 'dev') return makeDevResponse()
      if (role === 'review') return makeReviewResponse(true)
      throw new Error(`unexpected: ${role}`)
    })

    const orch = buildOrchestrator(mockAgent)
    await orch.executeUserRequest('写一个博客网站')

    const pmEvt = capturedEvents.list.find((e: GameEvent) => e.type === 'pm:analysis-complete')
    expect(pmEvt).toBeDefined()
    const evt = pmEvt as { payload?: { taskCount: number } }
    expect(evt.payload?.taskCount).toBe(2)
  })

  // ── #3 dev:iteration-start ────────────────────────────────────────────────

  it('Dev 任务开始时 GameEventStore 应收到 dev:iteration-start 事件', async () => {
    wireStandardFlow()
    const orch = buildOrchestrator(mockAgent)
    await orch.executeUserRequest('写一个首页')

    expect(pushedTypes()).toContain('dev:iteration-start')
  })

  // ── #4 workflow:iteration-complete approved=true ──────────────────────────

  it('Review 通过后应收到 workflow:iteration-complete 且 approved=true', async () => {
    wireStandardFlow(true)
    const orch = buildOrchestrator(mockAgent)
    await orch.executeUserRequest('写一个首页')

    const iterEvt = capturedEvents.list.filter((e: GameEvent) => e.type === 'workflow:iteration-complete')
    expect(iterEvt.length).toBeGreaterThan(0)
    const last = iterEvt[iterEvt.length - 1] as { payload?: { approved: boolean } }
    expect(last.payload?.approved).toBe(true)
  })

  // ── #5 review:rejected ────────────────────────────────────────────────────

  it('Review 第一次打回时应收到 review:rejected 事件', async () => {
    wireStandardFlow(true, 2) // approve only on 2nd dev call
    const orch = buildOrchestrator(mockAgent)
    await orch.executeUserRequest('写一个首页')

    expect(pushedTypes()).toContain('review:rejected')
  })

  // ── #6 event ordering ────────────────────────────────────────────────────

  it('事件序列应严格遵守 pm:analysis-complete → dev:iteration-start → workflow:iteration-complete 顺序', async () => {
    wireStandardFlow()
    const orch = buildOrchestrator(mockAgent)
    await orch.executeUserRequest('写一个首页')

    const types = pushedTypes()
    const pmIdx = types.indexOf('pm:analysis-complete')
    const devIdx = types.indexOf('dev:iteration-start')
    const doneIdx = types.indexOf('workflow:iteration-complete')

    expect(pmIdx).toBeGreaterThanOrEqual(0)
    expect(devIdx).toBeGreaterThan(pmIdx)
    expect(doneIdx).toBeGreaterThan(devIdx)
  })
})
