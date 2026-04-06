import { ReviewAgent, reviewResult } from '../src/agents/review-agent'
import type { Task, DevResult } from '../src/core/types'

const mockSessionsSpawn = jest.fn()
const mockSessionsHistory = jest.fn()

;(global as any).sessions_spawn = mockSessionsSpawn
;(global as any).sessions_history = mockSessionsHistory

const mockTask: Task = {
  id: 'task-1',
  title: '实现功能',
  description: '实现测试功能',
  assignedTo: 'dev',
  dependencies: [],
  files: [],
  status: 'pending',
}

const mockDevResult: DevResult = {
  success: true,
  files: ['src/feature.ts'],
  summary: '开发完成',
}

describe('ReviewAgent', () => {
  let agent: ReviewAgent

  beforeEach(() => {
    jest.clearAllMocks()
    agent = new ReviewAgent()
  })

  test('应该以 review 角色初始化', () => {
    expect(agent.role).toBe('review')
  })

  describe('review', () => {
    test('应该返回审查通过的结果', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'review-session-1',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              approved: true,
              issues: [],
              suggestions: ['可以优化性能'],
              summary: '代码质量良好',
            }),
          },
        ],
      })

      const result = await agent.review(mockTask, mockDevResult)

      expect(result.approved).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.suggestions).toContain('可以优化性能')
    })

    test('应该返回审查不通过的结果', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'review-session-2',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              approved: false,
              issues: ['缺少错误处理', '类型不安全'],
              suggestions: [],
              summary: '需要修改',
            }),
          },
        ],
      })

      const result = await agent.review(mockTask, mockDevResult)

      expect(result.approved).toBe(false)
      expect(result.issues).toHaveLength(2)
    })

    test('应该在解析失败时返回不通过（安全修复）', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'review-session-3',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{ role: 'assistant', content: '非JSON内容' }],
      })

      const result = await agent.review(mockTask, mockDevResult)

      expect(result.approved).toBe(false)  // 解析失败时应拒绝通过审查
      expect(result.issues).toContain('无法解析审查结果')
      expect(result.summary).toContain('审查失败')
    })

    test('应该在 session 为空时返回不通过（安全修复）', async () => {
      mockSessionsSpawn.mockResolvedValueOnce(null)

      const result = await agent.review(mockTask, mockDevResult)

      expect(result.approved).toBe(false)  // session 为空时无法进行审查，应拒绝
      expect(result.issues).toContain('无法解析审查结果')
    })

    test('应该在 sessions_spawn 不可用时使用降级模式', async () => {
      delete (global as any).sessions_spawn

      const result = await agent.review(mockTask, mockDevResult)

      // 应该返回降级模式的结果（安全第一：默认拒绝）
      expect(result.approved).toBe(false)
      expect(result.issues).toContain('审查环境不可用 (降级模式)')

      ;(global as any).sessions_spawn = mockSessionsSpawn
    })
  })

  describe('自定义 checklist', () => {
    test('应该使用自定义审查清单', async () => {
      const customAgent = new ReviewAgent({
        checklist: ['自定义检查1', '自定义检查2'],
      })

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'custom-review',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              approved: true,
              issues: [],
              suggestions: [],
              summary: '通过',
            }),
          },
        ],
      })

      const prompt = (customAgent as any).buildPrompt(mockTask, mockDevResult)
      expect(prompt).toContain('自定义检查1')
      expect(prompt).toContain('自定义检查2')
    })
  })

  describe('reviewResult 辅助函数', () => {
    test('应该创建 ReviewAgent 实例并审查', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'review-helper',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              approved: true,
              issues: [],
              suggestions: [],
              summary: '审查完成',
            }),
          },
        ],
      })

      const result = await reviewResult(mockTask, mockDevResult)
      expect(result.approved).toBe(true)
    })
  })
})
