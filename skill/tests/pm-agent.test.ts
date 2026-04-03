import { PMAgent, analyzeRequest } from '../src/agents/pm-agent'
import type { Task } from '../src/core/types'

const mockSessionsSpawn = jest.fn()
const mockSessionsHistory = jest.fn()

;(global as any).sessions_spawn = mockSessionsSpawn
;(global as any).sessions_history = mockSessionsHistory

describe('PMAgent', () => {
  let agent: PMAgent

  beforeEach(() => {
    jest.clearAllMocks()
    agent = new PMAgent()
  })

  test('应该以 dev 角色初始化', () => {
    expect(agent.role).toBe('pm')
  })

  test('应该使用默认 high thinking', () => {
    expect(agent).toBeDefined()
  })

  describe('analyze', () => {
    const mockTasks: Partial<Task>[] = [
      {
        id: 'task-1',
        title: '实现功能',
        description: '实现核心功能',
        assignedTo: 'dev',
        dependencies: [],
        status: 'pending',
      },
    ]

    test('应该返回 PMResult 含 analysis 和 tasks', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'pm-session-1',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              analysis: '用户需要一个计数器组件',
              tasks: mockTasks,
            }),
          },
        ],
      })

      const result = await agent.analyze('创建一个计数器组件')

      expect(result.analysis).toBe('用户需要一个计数器组件')
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].title).toBe('实现功能')
    })

    test('应该在解析失败时返回默认值', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'pm-session-2',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{ role: 'assistant', content: '无法解析的内容' }],
      })

      const result = await agent.analyze('测试需求')

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].id).toBe('task-1')
    })

    test('应该在 session 为空时返回默认值', async () => {
      mockSessionsSpawn.mockResolvedValueOnce(null)

      const result = await agent.analyze('测试需求')

      expect(result.tasks).toHaveLength(1)
    })

    test('应该在 sessions_spawn 不可用时抛出异常', async () => {
      delete (global as any).sessions_spawn

      await expect(agent.analyze('测试')).rejects.toThrow(
        'sessions_spawn not available'
      )

      ;(global as any).sessions_spawn = mockSessionsSpawn
    })

    test('应该在 sessions_history 不可用时返回默认值', async () => {
      delete (global as any).sessions_history

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'pm-session-3',
        status: 'completed',
      })

      const result = await agent.analyze('测试')

      expect(result.tasks).toHaveLength(1)

      ;(global as any).sessions_history = mockSessionsHistory
    })
  })

  describe('analyzeRequest 辅助函数', () => {
    test('应该创建 PMAgent 实例并分析', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'pm-helper',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              analysis: '分析完成',
              tasks: [],
            }),
          },
        ],
      })

      const result = await analyzeRequest('测试需求', { thinking: 'low' })
      expect(result.analysis).toBe('分析完成')
    })
  })

  describe('buildPrompt', () => {
    test('应该包含用户需求', () => {
      const prompt = (agent as any).buildPrompt('创建登录页面')
      expect(prompt).toContain('创建登录页面')
      expect(prompt).toContain('PM Agent')
      expect(prompt).toContain('JSON')
    })
  })
})
