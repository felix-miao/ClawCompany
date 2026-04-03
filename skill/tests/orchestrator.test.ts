import {
  ClawCompanyOrchestrator,
  orchestrate,
} from '../src/orchestrator'
import type { Task } from '../src/core/types'

const mockSessionsSpawn = jest.fn()
const mockSessionsHistory = jest.fn()

;(global as any).sessions_spawn = mockSessionsSpawn
;(global as any).sessions_history = mockSessionsHistory

function mockPMResponse(tasks: Partial<Task>[] = []) {
  return {
    sessionKey: `pm-${Date.now()}`,
    status: 'completed',
  }
}

function mockDevResponse() {
  return {
    sessionKey: `dev-${Date.now()}`,
    status: 'completed',
  }
}

function mockReviewResponse(approved = true) {
  return {
    sessionKey: `review-${Date.now()}`,
    status: 'completed',
  }
}

function mockHistoryContent(json: object) {
  return {
    messages: [
      {
        role: 'assistant',
        content: JSON.stringify(json),
      },
    ],
  }
}

const defaultPMTasks: Partial<Task>[] = [
  {
    id: 'task-1',
    title: '实现功能',
    description: '实现测试功能',
    assignedTo: 'dev',
    dependencies: [],
    status: 'pending',
  },
]

describe('ClawCompanyOrchestrator', () => {
  let orchestrator: ClawCompanyOrchestrator

  beforeEach(() => {
    jest.clearAllMocks()
    orchestrator = new ClawCompanyOrchestrator()
  })

  test('应该能够初始化 Orchestrator', () => {
    expect(orchestrator).toBeDefined()
  })

  describe('execute - 完整工作流', () => {
    test('应该能够执行完整的 PM → Dev → Review 流程', async () => {
      mockSessionsSpawn
        .mockResolvedValueOnce(mockPMResponse())
        .mockResolvedValueOnce(mockDevResponse())
        .mockResolvedValueOnce(mockReviewResponse())

      mockSessionsHistory
        .mockResolvedValueOnce(
          mockHistoryContent({
            analysis: '这是一个测试需求',
            tasks: defaultPMTasks,
          })
        )
        .mockResolvedValueOnce(
          mockHistoryContent({
            success: true,
            files: ['src/test.ts'],
            summary: '开发完成',
          })
        )
        .mockResolvedValueOnce(
          mockHistoryContent({
            approved: true,
            issues: [],
            suggestions: [],
            summary: '审查通过',
          })
        )

      const result = await orchestrator.execute('创建一个登录页面')

      expect(result.success).toBe(true)
      expect(result.tasks).toHaveLength(1)
      expect(result.results).toHaveLength(1)
      expect(result.results[0].review.approved).toBe(true)
    })

    test('应该处理 PM 返回空任务的情况', async () => {
      mockSessionsSpawn.mockResolvedValueOnce(mockPMResponse())
      mockSessionsHistory.mockResolvedValueOnce(
        mockHistoryContent({
          analysis: '无法理解需求',
          tasks: [],
        })
      )

      const result = await orchestrator.execute('模糊的需求')

      expect(result.success).toBe(false)
      expect(result.tasks).toHaveLength(0)
      expect(result.summary).toContain('未能生成有效任务')
    })

    test('应该处理 OpenClaw API 不可用的情况', async () => {
      delete (global as any).sessions_spawn

      const result = await orchestrator.execute('测试需求')

      expect(result.success).toBe(false)
      expect(result.summary).toContain('不可用')

      ;(global as any).sessions_spawn = mockSessionsSpawn
    })

    test('应该处理 Review 不通过的情况', async () => {
      mockSessionsSpawn
        .mockResolvedValueOnce(mockPMResponse())
        .mockResolvedValueOnce(mockDevResponse())
        .mockResolvedValueOnce(mockReviewResponse())

      mockSessionsHistory
        .mockResolvedValueOnce(
          mockHistoryContent({
            analysis: '测试分析',
            tasks: defaultPMTasks,
          })
        )
        .mockResolvedValueOnce(
          mockHistoryContent({
            success: true,
            files: ['src/test.ts'],
            summary: '开发完成',
          })
        )
        .mockResolvedValueOnce(
          mockHistoryContent({
            approved: false,
            issues: ['缺少错误处理'],
            suggestions: ['添加 try-catch'],
            summary: '审查不通过',
          })
        )

      const result = await orchestrator.execute('测试需求')

      expect(result.success).toBe(true)
      expect(result.results[0].review.approved).toBe(false)
      expect(result.results[0].review.issues).toContain('缺少错误处理')
    })

    test('应该处理多任务并行执行', async () => {
      const multiTasks: Partial<Task>[] = [
        {
          id: 'task-1',
          title: '任务一',
          description: '第一个任务',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'task-2',
          title: '任务二',
          description: '第二个任务',
          assignedTo: 'dev',
          dependencies: ['task-1'],
          status: 'pending',
        },
      ]

      mockSessionsSpawn
        .mockResolvedValueOnce(mockPMResponse())
        .mockResolvedValueOnce(mockDevResponse())
        .mockResolvedValueOnce(mockReviewResponse())
        .mockResolvedValueOnce(mockDevResponse())
        .mockResolvedValueOnce(mockReviewResponse())

      mockSessionsHistory
        .mockResolvedValueOnce(
          mockHistoryContent({ analysis: '多任务分析', tasks: multiTasks })
        )
        .mockResolvedValueOnce(
          mockHistoryContent({
            success: true,
            files: ['src/a.ts'],
            summary: '任务一完成',
          })
        )
        .mockResolvedValueOnce(
          mockHistoryContent({
            approved: true,
            issues: [],
            suggestions: [],
            summary: '审查通过',
          })
        )
        .mockResolvedValueOnce(
          mockHistoryContent({
            success: true,
            files: ['src/b.ts'],
            summary: '任务二完成',
          })
        )
        .mockResolvedValueOnce(
          mockHistoryContent({
            approved: true,
            issues: [],
            suggestions: [],
            summary: '审查通过',
          })
        )

      const result = await orchestrator.execute('多任务需求')

      expect(result.success).toBe(true)
      expect(result.tasks).toHaveLength(2)
      expect(result.results).toHaveLength(2)
    })

    test('应该处理 PM Agent 抛出异常', async () => {
      mockSessionsSpawn.mockRejectedValueOnce(new Error('PM Agent 崩溃'))

      await expect(orchestrator.execute('测试')).rejects.toThrow('PM Agent 启动失败')
    })
  })
})

describe('orchestrate standalone function', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应该返回 WorkflowResult 结构', async () => {
    mockSessionsSpawn
      .mockResolvedValueOnce(mockPMResponse())
      .mockResolvedValueOnce(mockDevResponse())
      .mockResolvedValueOnce(mockReviewResponse())

    mockSessionsHistory
      .mockResolvedValueOnce(
        mockHistoryContent({
          analysis: '测试分析',
          tasks: defaultPMTasks,
        })
      )
      .mockResolvedValueOnce(
        mockHistoryContent({
          success: true,
          files: ['src/test.ts'],
          summary: '开发完成',
        })
      )
      .mockResolvedValueOnce(
        mockHistoryContent({
          approved: true,
          issues: [],
          suggestions: [],
          summary: '审查通过',
        })
      )

    const result = await orchestrate('创建计数器')

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('tasks')
    expect(result).toHaveProperty('messages')
    expect(result.messages.length).toBeGreaterThanOrEqual(1)
  })

  test('应该包含 pm、dev、review 三个 agent 的消息', async () => {
    mockSessionsSpawn
      .mockResolvedValueOnce(mockPMResponse())
      .mockResolvedValueOnce(mockDevResponse())
      .mockResolvedValueOnce(mockReviewResponse())

    mockSessionsHistory
      .mockResolvedValueOnce(
        mockHistoryContent({
          analysis: '分析完成',
          tasks: defaultPMTasks,
        })
      )
      .mockResolvedValueOnce(
        mockHistoryContent({
          success: true,
          files: [],
          summary: '代码已实现',
        })
      )
      .mockResolvedValueOnce(
        mockHistoryContent({
          approved: true,
          issues: [],
          suggestions: [],
          summary: '审查通过',
        })
      )

    const result = await orchestrate('创建计数器')

    const agents = result.messages.map(m => m.agent)
    expect(agents).toContain('pm')
    expect(agents).toContain('dev')
    expect(agents).toContain('review')
  })

  test('应该处理异常并返回错误消息', async () => {
    delete (global as any).sessions_spawn
    delete (global as any).sessions_history

    const result = await orchestrate('测试')

    expect(result.success).toBe(false)
    expect(result.messages.length).toBeGreaterThan(0)
    expect(result.messages[0].agent).toBe('system')

    ;(global as any).sessions_spawn = mockSessionsSpawn
    ;(global as any).sessions_history = mockSessionsHistory
  })
})
