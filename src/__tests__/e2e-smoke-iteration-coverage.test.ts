/**
 * e2e-smoke-iteration-coverage.test.ts
 * 补充 PR#4/5/7 新增功能的冒烟测试：
 * 1. Dev→Review 迭代（首轮拒绝，第二轮通过）
 * 2. task.files writeback（PR#5）
 * 3. GameEvent 事件序列：pm:analysis-complete → dev:iteration-start → workflow:iteration-complete
 */

import { Orchestrator } from '../lib/orchestrator/index'
import { AgentManager } from '../lib/agents/manager'
import { ChatManager } from '../lib/chat/manager'
import { TaskManager } from '../lib/tasks/manager'
import { SandboxedFileWriter } from '../lib/security/sandbox'
import type { AgentRole, Task, AgentResponse, AgentContext } from '../lib/core/types'
import { getGameEventStore } from '../game/data/GameEventStore'

// ─── Mock 外部依赖 ───────────────────────────────────────────────────────────

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

// ─── 快速重试配置 ─────────────────────────────────────────────────────────────

const FAST_RETRY = { maxRetries: 1, initialDelay: 1, maxDelay: 10, backoffMultiplier: 1 }

// ─── 辅助工厂 ─────────────────────────────────────────────────────────────────

function makeOrchestrator() {
  const realTaskManager = new TaskManager('smoke-test')

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

  const orchestrator = new Orchestrator('smoke-iter-project', FAST_RETRY, {}, {}, {
    agentManager: mockAgentManager,
    taskManager: realTaskManager,
    chatManager: mockChatManager,
    sandboxedWriter: mockSandboxedWriter,
  })

  return { orchestrator, mockAgentManager, mockChatManager, mockSandboxedWriter, realTaskManager }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 冒烟测试套件
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E Smoke: Iteration Coverage (PR#4/5/7)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // 清空 GameEventStore 历史，避免测试间污染
    getGameEventStore().clear()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 测试 1：Dev→Review 迭代（首轮拒绝，第二轮通过）
  // ─────────────────────────────────────────────────────────────────────────

  it('should retry Dev when Review rejects (iteration loop)', async () => {
    const { orchestrator, mockAgentManager } = makeOrchestrator()
    const callLog: Array<{ role: string; iteration: number }> = []
    let devCallCount = 0
    let reviewCallCount = 0

    mockAgentManager.executeAgent.mockImplementation(
      async (role: AgentRole, _task: Task, ctx: AgentContext): Promise<AgentResponse> => {
        if (role === 'pm') {
          callLog.push({ role: 'pm', iteration: 0 })
          return {
            agent: 'pm',
            message: 'PM分析完成',
            tasks: [{
              title: '实现数据获取函数',
              description: '需要包含错误处理',
              assignedTo: 'dev',
              status: 'pending',
              dependencies: [],
              files: [],
            }],
            status: 'success',
          }
        }

        if (role === 'dev') {
          devCallCount++
          callLog.push({ role: 'dev', iteration: devCallCount })

          if (devCallCount === 1) {
            // v1：简单实现，无错误处理（会被 review 拒绝）
            return {
              agent: 'dev',
              message: 'v1: 简单实现，无错误处理',
              files: [{
                path: 'src/api/data.ts',
                content: 'export async function fetchData() { return await fetch("/api/data") }',
                action: 'create',
              }],
              status: 'success',
            }
          } else {
            // v2：收到 reviewFeedback 后改进
            expect(ctx.reviewFeedback).toBeDefined()
            expect(ctx.reviewFeedback).toContain('missing error handling')

            return {
              agent: 'dev',
              message: 'v2: 添加了 try-catch 错误处理',
              files: [{
                path: 'src/api/data.ts',
                content: 'export async function fetchData() { try { return await fetch("/api/data") } catch(e) { throw e } }',
                action: 'create',
              }],
              status: 'success',
            }
          }
        }

        if (role === 'review') {
          reviewCallCount++
          callLog.push({ role: 'review', iteration: reviewCallCount })

          if (reviewCallCount === 1) {
            // 首轮拒绝
            return {
              agent: 'review',
              message: 'missing error handling — please add try-catch',
              status: 'need_input',
              nextAgent: 'dev',
            }
          } else {
            // 第二轮通过
            return {
              agent: 'review',
              message: '代码审查通过，错误处理完善',
              status: 'success',
            }
          }
        }

        throw new Error(`Unexpected role: ${role}`)
      }
    )

    const result = await orchestrator.executeUserRequest('实现数据获取函数，需要错误处理')

    // 最终成功
    expect(result.success).toBe(true)

    // Dev 被调用 2 次（迭代循环 — PR#4 核心逻辑）
    expect(devCallCount).toBe(2)
    expect(reviewCallCount).toBe(2)

    // 执行顺序：pm → dev(v1) → review(拒绝) → dev(v2) → review(通过)
    const roleSequence = callLog.map(c => c.role)
    expect(roleSequence).toEqual(['pm', 'dev', 'review', 'dev', 'review'])

    // 任务最终 completed
    const devTask = result.tasks.find(t => t.assignedTo === 'dev')
    expect(devTask?.status).toBe('completed')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 测试 2：task.files writeback（PR#5 修复）
  // ─────────────────────────────────────────────────────────────────────────

  it('should write task.files after Dev saves files', async () => {
    const { orchestrator, mockAgentManager } = makeOrchestrator()
    let reviewTaskFiles: string[] = []
    const devFiles = [
      { path: 'src/component.tsx', content: 'export const C = () => <div/>', action: 'create' as const },
      { path: 'src/styles.css', content: '.c { color: red }', action: 'create' as const },
    ]

    mockAgentManager.executeAgent.mockImplementation(
      async (role: AgentRole, task: Task): Promise<AgentResponse> => {
        if (role === 'pm') {
          return {
            agent: 'pm',
            message: 'PM done',
            tasks: [{ title: '创建组件', description: '带样式', assignedTo: 'dev', status: 'pending', dependencies: [], files: [] }],
            status: 'success',
          }
        }
        if (role === 'dev') {
          return { agent: 'dev', message: 'Dev done', files: devFiles, status: 'success' }
        }
        if (role === 'review') {
          // PR#5：task.files 在 review 调用前已被写回（一行修复：task.files = allFiles.map(f => f.path)）
          reviewTaskFiles = [...(task.files ?? [])]
          return { agent: 'review', message: '通过', status: 'success' }
        }
        throw new Error(`Unexpected role: ${role}`)
      }
    )

    const result = await orchestrator.executeUserRequest('创建带样式的组件')

    expect(result.success).toBe(true)

    // 结果中包含 2 个文件
    expect(result.files?.length).toBe(2)
    expect(result.files?.map(f => f.path)).toContain('src/component.tsx')
    expect(result.files?.map(f => f.path)).toContain('src/styles.css')

    // PR#5 关键断言：review 收到的 task.files 已包含 dev 写的文件路径
    expect(reviewTaskFiles).toContain('src/component.tsx')
    expect(reviewTaskFiles).toContain('src/styles.css')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 测试 3：GameEvent 事件序列（PR#7 GameEvent 类型扩展）
  // ─────────────────────────────────────────────────────────────────────────

  it('should emit pm:analysis-complete before dev:iteration-start', async () => {
    const { orchestrator, mockAgentManager } = makeOrchestrator()
    const capturedEvents: Array<{ type: string; timestamp: number }> = []

    // 订阅 GameEventStore 以捕获所有事件
    const store = getGameEventStore()
    const unsubscribe = store.subscribe((event) => {
      capturedEvents.push({ type: event.type, timestamp: event.timestamp })
    })

    mockAgentManager.executeAgent.mockImplementation(
      async (role: AgentRole): Promise<AgentResponse> => {
        if (role === 'pm') {
          return {
            agent: 'pm',
            message: 'PM分析完成',
            tasks: [{
              title: '创建登录组件',
              description: '带表单验证',
              assignedTo: 'dev',
              status: 'pending',
              dependencies: [],
              files: [],
            }],
            status: 'success',
          }
        }
        if (role === 'dev') {
          return {
            agent: 'dev',
            message: '登录组件完成',
            files: [{ path: 'src/Login.tsx', content: 'export const Login = () => <form/>', action: 'create' }],
            status: 'success',
          }
        }
        if (role === 'review') {
          return { agent: 'review', message: '审查通过', status: 'success' }
        }
        throw new Error(`Unexpected role: ${role}`)
      }
    )

    await orchestrator.executeUserRequest('创建登录组件')

    unsubscribe()

    // 从 store 直接读取历史（subscribe 跨模块时可能捕获不到）
    const allStoreEvents = store.getEvents()
    const effectiveEvents = capturedEvents.length > 0 ? capturedEvents : allStoreEvents.map(e => ({ type: e.type, timestamp: e.timestamp }))

    // 提取关键事件类型序列
    const eventTypes = effectiveEvents.map(e => e.type)

    // 断言：pm:analysis-complete 必须在 dev:iteration-start 之前出现
    const pmAnalysisIdx = eventTypes.indexOf('pm:analysis-complete')
    const devIterationIdx = eventTypes.indexOf('dev:iteration-start')
    const workflowCompleteIdx = eventTypes.indexOf('workflow:iteration-complete')

    expect(pmAnalysisIdx).toBeGreaterThanOrEqual(0)
    expect(devIterationIdx).toBeGreaterThanOrEqual(0)
    expect(workflowCompleteIdx).toBeGreaterThanOrEqual(0)

    // 顺序断言：pm:analysis-complete → dev:iteration-start → workflow:iteration-complete
    expect(pmAnalysisIdx).toBeLessThan(devIterationIdx)
    expect(devIterationIdx).toBeLessThan(workflowCompleteIdx)

    // 验证 workflow:iteration-complete 的 approved 字段（首轮通过时应为 true）
    const iterCompleteEvent = store.getEventsByType('workflow:iteration-complete')[0]
    expect(iterCompleteEvent).toBeDefined()
    expect((iterCompleteEvent as { payload?: { approved?: boolean } }).payload?.approved).toBe(true)
  })
})
