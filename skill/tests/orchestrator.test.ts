/**
 * Orchestrator 测试
 * 
 * 测试 ClawCompany orchestrator 的基本功能
 */

import { orchestrate, Task } from '../orchestrator'

// Mock sessions_spawn 和 sessions_history
global.sessions_spawn = jest.fn()
global.sessions_history = jest.fn()

describe('ClawCompany Orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('应该能够分析简单需求', async () => {
    // Mock PM Agent 响应
    ;(global.sessions_spawn as jest.Mock).mockResolvedValue('pm-session-1')
    ;(global.sessions_history as jest.Mock).mockResolvedValue([
      {
        status: 'completed',
        content: JSON.stringify({
          message: '## 需求分析\n\n这是一个简单的登录页面需求。',
          tasks: [
            {
              id: 'task-1',
              title: '创建登录表单',
              description: '实现用户登录表单',
              assignedTo: 'dev',
              dependencies: []
            }
          ]
        })
      }
    ])

    const result = await orchestrate('创建一个登录页面')

    expect(result.success).toBe(true)
    expect(result.tasks).toHaveLength(1)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].agent).toBe('pm')
  })

  test('应该能够处理 Dev Agent 失败', async () => {
    // Mock PM Agent 响应
    ;(global.sessions_spawn as jest.Mock)
      .mockResolvedValueOnce('pm-session-1')
      .mockRejectedValueOnce(new Error('Dev Agent failed'))
    
    ;(global.sessions_history as jest.Mock).mockResolvedValue([
      {
        status: 'completed',
        content: JSON.stringify({
          message: '需求分析完成',
          tasks: [
            {
              id: 'task-1',
              title: '实现功能',
              description: '描述',
              assignedTo: 'dev',
              dependencies: []
            }
          ]
        })
      }
    ])

    const result = await orchestrate('测试需求')

    expect(result.success).toBe(true)
    expect(result.tasks[0].status).toBe('in_progress')
  })

  test('应该能够完成完整的工作流程', async () => {
    // Mock 所有 Agent 响应
    ;(global.sessions_spawn as jest.Mock)
      .mockResolvedValueOnce('pm-session-1')
      .mockResolvedValueOnce('dev-session-1')
      .mockResolvedValueOnce('review-session-1')
    
    ;(global.sessions_history as jest.Mock)
      .mockResolvedValueOnce([
        {
          status: 'completed',
          content: JSON.stringify({
            message: 'PM 分析完成',
            tasks: [
              {
                id: 'task-1',
                title: '实现登录',
                description: '登录功能',
                assignedTo: 'dev',
                dependencies: []
              }
            ]
          })
        }
      ])
      .mockResolvedValueOnce([
        {
          status: 'completed',
          content: 'Dev 实现完成'
        }
      ])
      .mockResolvedValueOnce([
        {
          status: 'completed',
          content: JSON.stringify({
            approved: true,
            message: '审查通过 ✅'
          })
        }
      ])

    const result = await orchestrate('创建登录功能')

    expect(result.success).toBe(true)
    expect(result.tasks[0].status).toBe('done')
    expect(result.messages).toHaveLength(3) // PM + Dev + Review
  })
})
