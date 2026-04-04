import { PMAgent } from '../src/agents/pm-agent'
import { DevAgent } from '../src/agents/dev-agent'
import { ReviewAgent } from '../src/agents/review-agent'
import type { Task, DevResult } from '../src/core/types'

const mockSessionsSpawn = jest.fn()
const mockSessionsHistory = jest.fn()

;(global as any).sessions_spawn = mockSessionsSpawn
;(global as any).sessions_history = mockSessionsHistory

const sampleTask: Task = {
  id: 'task-1',
  title: '创建计数器组件',
  description: '实现一个具有增加和减少功能的计数器',
  assignedTo: 'dev',
  dependencies: [],
  files: [],
  status: 'pending',
}

describe('test-agents-simple - Agent 独立测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('PM Agent', () => {
    test('应该分析需求并返回任务列表', async () => {
      const agent = new PMAgent()

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'pm-session',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{
          role: 'assistant',
          content: JSON.stringify({
            analysis: '用户需要一个计数器组件，包含增加和减少功能',
            tasks: [
              {
                id: 'task-1',
                title: '创建计数器组件',
                description: '实现计数器核心逻辑和UI',
                assignedTo: 'dev',
                dependencies: [],
                files: [],
                status: 'pending',
              },
            ],
          }),
        }],
      })

      const result = await agent.analyze('创建一个计数器组件')

      expect(result.analysis).toBeTruthy()
      expect(result.tasks.length).toBeGreaterThan(0)
      expect(result.tasks[0].assignedTo).toBe('dev')
    })

    test('应该在解析失败时返回默认任务', async () => {
      const agent = new PMAgent()

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'pm-fallback',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{ role: 'assistant', content: '无法解析' }],
      })

      const result = await agent.analyze('测试')

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].status).toBe('pending')
    })
  })

  describe('Dev Agent', () => {
    test('应该执行任务并返回结果', async () => {
      const agent = new DevAgent()

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'dev-session',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{
          role: 'assistant',
          content: JSON.stringify({
            success: true,
            files: ['src/counter.ts', 'src/counter.test.ts'],
            summary: '计数器组件实现完成',
          }),
        }],
      })

      const result = await agent.execute(sampleTask, process.cwd())

      expect(result.success).toBe(true)
      expect(result.files.length).toBeGreaterThan(0)
      expect(result.summary).toBeTruthy()
    })

    test('应该在 ACP 失败时 fallback 到 subagent', async () => {
      const agent = new DevAgent({ runtime: 'acp' })

      mockSessionsSpawn
        .mockRejectedValueOnce(new Error('ACP 不可用'))
        .mockResolvedValueOnce({
          sessionKey: 'dev-subagent',
          status: 'completed',
        })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{
          role: 'assistant',
          content: JSON.stringify({
            success: true,
            files: ['src/feature.ts'],
            summary: 'fallback 完成',
          }),
        }],
      })

      const result = await agent.execute(sampleTask, process.cwd())

      expect(result.success).toBe(true)
      expect(mockSessionsSpawn).toHaveBeenCalledTimes(2)
    })
  })

  describe('Review Agent', () => {
    const mockDevResult: DevResult = {
      success: true,
      files: ['src/counter.ts'],
      summary: '开发完成',
    }

    test('应该审查代码并返回结果', async () => {
      const agent = new ReviewAgent()

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'review-session',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{
          role: 'assistant',
          content: JSON.stringify({
            approved: true,
            issues: [],
            suggestions: ['可以添加 debounce'],
            summary: '代码审查通过，质量良好',
          }),
        }],
      })

      const result = await agent.review(sampleTask, mockDevResult)

      expect(result.approved).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    test('应该返回审查不通过的结果', async () => {
      const agent = new ReviewAgent()

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'review-fail',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{
          role: 'assistant',
          content: JSON.stringify({
            approved: false,
            issues: ['缺少错误处理', '类型不安全'],
            suggestions: [],
            summary: '需要修改',
          }),
        }],
      })

      const result = await agent.review(sampleTask, mockDevResult)

      expect(result.approved).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })
})
