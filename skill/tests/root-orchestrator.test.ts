import { orchestrate, WorkflowResult, ClawCompanyOrchestrator } from '../src/orchestrator'
import type { Task } from '../src/core/types'

const mockSessionsSpawn = jest.fn()
const mockSessionsHistory = jest.fn()

;(global as any).sessions_spawn = mockSessionsSpawn
;(global as any).sessions_history = mockSessionsHistory

function setupFullWorkflowMock(tasks: Partial<Task>[]) {
  mockSessionsSpawn
    .mockResolvedValueOnce({ sessionKey: 'pm-1', status: 'completed' })
    .mockResolvedValueOnce({ sessionKey: 'dev-1', status: 'completed' })
    .mockResolvedValueOnce({ sessionKey: 'review-1', status: 'completed' })

  mockSessionsHistory
    .mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        content: JSON.stringify({ analysis: '需求分析完成', tasks }),
      }],
    })
    .mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          success: true,
          files: ['src/counter.ts'],
          summary: '代码实现完成',
        }),
      }],
    })
    .mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          approved: true,
          issues: [],
          suggestions: [],
          summary: '代码审查通过',
        }),
      }],
    })
}

describe('test-orchestrator - Orchestrator 集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('orchestrate 函数', () => {
    test('应该完成 PM → Dev → Review 工作流', async () => {
      const tasks: Partial<Task>[] = [{
        id: 'task-1',
        title: '创建计数器组件',
        description: '实现一个计数器',
        assignedTo: 'dev',
        dependencies: [],
        files: [],
        status: 'pending',
      }]

      setupFullWorkflowMock(tasks)

      const result: WorkflowResult = await orchestrate('创建一个计数器组件')

      expect(result.success).toBe(true)
      expect(result.tasks.length).toBeGreaterThan(0)
      expect(result.messages.length).toBeGreaterThan(0)
    })

    test('应该包含 pm、dev、review 三个 Agent 的消息', async () => {
      const tasks: Partial<Task>[] = [{
        id: 'task-1',
        title: '创建计数器',
        description: '计数器',
        assignedTo: 'dev',
        dependencies: [],
        files: [],
        status: 'pending',
      }]

      setupFullWorkflowMock(tasks)

      const result = await orchestrate('创建计数器')

      const agents = result.messages.map(m => m.agent)
      expect(agents).toContain('pm')
      expect(agents).toContain('dev')
      expect(agents).toContain('review')
    })

    test('应该处理 PM Agent 返回空任务', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'pm-empty',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{
          role: 'assistant',
          content: JSON.stringify({ analysis: '无法分析', tasks: [] }),
        }],
      })

      const result = await orchestrate('模糊的需求')

      expect(result.success).toBe(false)
      expect(result.tasks).toHaveLength(0)
    })

    test('应该处理所有 Agent 不可用的情况', async () => {
      delete (global as any).sessions_spawn
      delete (global as any).sessions_history

      const result = await orchestrate('测试')

      expect(result.success).toBe(false)
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].agent).toBe('system')

      ;(global as any).sessions_spawn = mockSessionsSpawn
      ;(global as any).sessions_history = mockSessionsHistory
    })
  })

  describe('ClawCompanyOrchestrator 类', () => {
    test('应该能够直接使用 Orchestrator 类', async () => {
      const orchestrator = new ClawCompanyOrchestrator()

      const tasks: Partial<Task>[] = [{
        id: 'task-1',
        title: '实现功能',
        description: '功能描述',
        assignedTo: 'dev',
        dependencies: [],
        files: [],
        status: 'pending',
      }]

      mockSessionsSpawn
        .mockResolvedValueOnce({ sessionKey: 'pm-1', status: 'completed' })
        .mockResolvedValueOnce({ sessionKey: 'dev-1', status: 'completed' })
        .mockResolvedValueOnce({ sessionKey: 'review-1', status: 'completed' })

      mockSessionsHistory
        .mockResolvedValueOnce({
          messages: [{
            role: 'assistant',
            content: JSON.stringify({ analysis: '分析完成', tasks }),
          }],
        })
        .mockResolvedValueOnce({
          messages: [{
            role: 'assistant',
            content: JSON.stringify({
              success: true,
              files: ['src/test.ts'],
              summary: '开发完成',
            }),
          }],
        })
        .mockResolvedValueOnce({
          messages: [{
            role: 'assistant',
            content: JSON.stringify({
              approved: true,
              issues: [],
              suggestions: [],
              summary: '审查通过',
            }),
          }],
        })

      const result = await orchestrator.execute('测试需求')

      expect(result.success).toBe(true)
      expect(result.tasks).toHaveLength(1)
      expect(result.results).toHaveLength(1)
    })
  })
})
