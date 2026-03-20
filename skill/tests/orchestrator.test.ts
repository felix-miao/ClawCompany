/**
 * Orchestrator 测试
 * 
 * 测试 ClawCompany orchestrator 的基本功能
 */

import { ClawCompanyOrchestrator } from '../src/orchestrator'

// Mock OpenClaw 全局工具
const mockSessionsSpawn = jest.fn()
const mockSessionsHistory = jest.fn()

global.sessions_spawn = mockSessionsSpawn
global.sessions_history = mockSessionsHistory

describe('ClawCompany Orchestrator', () => {
  let orchestrator: ClawCompanyOrchestrator

  beforeEach(() => {
    jest.clearAllMocks()
    orchestrator = new ClawCompanyOrchestrator()
  })

  test('应该能够初始化 Orchestrator', () => {
    expect(orchestrator).toBeDefined()
  })

  test('应该能够分析简单需求', async () => {
    // Mock PM Agent 响应
    mockSessionsSpawn.mockResolvedValueOnce({
      sessionKey: 'pm-session-1',
      status: 'completed'
    })
    
    mockSessionsHistory.mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          analysis: '这是一个简单的登录页面需求',
          tasks: [
            {
              id: 'task-1',
              title: '创建登录表单',
              description: '实现用户登录表单',
              assignedTo: 'dev',
              dependencies: [],
              status: 'pending'
            }
          ]
        })
      }]
    })

    const result = await orchestrator.execute('创建一个登录页面')

    expect(result.success).toBe(true)
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('创建登录表单')
  })

  test('应该能够处理任务执行', async () => {
    // Mock PM Agent
    mockSessionsSpawn.mockResolvedValueOnce({
      sessionKey: 'pm-session-1',
      status: 'completed'
    })
    
    mockSessionsHistory.mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          analysis: '需求分析完成',
          tasks: [
            {
              id: 'task-1',
              title: '实现功能',
              description: '测试功能',
              assignedTo: 'dev',
              dependencies: [],
              status: 'pending'
            }
          ]
        })
      }]
    })

    // Mock Dev Agent
    mockSessionsSpawn.mockResolvedValueOnce({
      sessionKey: 'dev-session-1',
      status: 'completed'
    })
    
    mockSessionsHistory.mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          success: true,
          files: ['src/test.ts'],
          summary: '实现完成'
        })
      }]
    })

    // Mock Review Agent
    mockSessionsSpawn.mockResolvedValueOnce({
      sessionKey: 'review-session-1',
      status: 'completed'
    })
    
    mockSessionsHistory.mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          approved: true,
          issues: [],
          suggestions: [],
          summary: '审查通过'
        })
      }]
    })

    const result = await orchestrator.execute('测试需求')

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].review.approved).toBe(true)
  })

  test('应该能够处理 PM Agent 无法生成任务的情况', async () => {
    // Mock PM Agent 返回空任务
    mockSessionsSpawn.mockResolvedValueOnce({
      sessionKey: 'pm-session-1',
      status: 'completed'
    })
    
    mockSessionsHistory.mockResolvedValueOnce({
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          analysis: '无法理解需求',
          tasks: []
        })
      }]
    })

    const result = await orchestrator.execute('模糊的需求')

    expect(result.success).toBe(false)
    expect(result.tasks).toHaveLength(0)
  })
})
