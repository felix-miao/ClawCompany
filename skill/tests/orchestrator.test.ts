/**
 * ClawCompany Orchestrator Tests
 */

import { ClawCompanyOrchestrator } from '../src/orchestrator'

// Mock OpenClaw APIs
jest.mock('openclaw', () => ({
  sessions_spawn: jest.fn(),
  sessions_history: jest.fn(),
  sessions_send: jest.fn()
}))

const { sessions_spawn, sessions_history } = require('openclaw')

describe('ClawCompanyOrchestrator', () => {
  let orchestrator: ClawCompanyOrchestrator

  beforeEach(() => {
    orchestrator = new ClawCompanyOrchestrator({
      projectPath: '/test/project'
    })
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create with default config', () => {
      const orc = new ClawCompanyOrchestrator()
      expect(orc).toBeDefined()
    })

    it('should accept custom config', () => {
      const orc = new ClawCompanyOrchestrator({
        thinking: 'high',
        model: 'glm-5'
      })
      expect(orc).toBeDefined()
    })
  })

  describe('execute', () => {
    it('should execute a simple request', async () => {
      // Mock PM Agent response
      sessions_spawn.mockResolvedValueOnce({ sessionKey: 'pm-session' })
      sessions_history.mockResolvedValueOnce({
        messages: [{
          content: JSON.stringify({
            analysis: 'Test analysis',
            tasks: [{
              id: 'task-1',
              title: 'Test task',
              description: 'Test description',
              assignedTo: 'dev',
              dependencies: [],
              status: 'pending'
            }]
          })
        }]
      })

      // Mock Dev Agent response
      sessions_spawn.mockResolvedValueOnce({ sessionKey: 'dev-session' })
      sessions_history.mockResolvedValueOnce({
        messages: [{
          content: JSON.stringify({
            success: true,
            files: ['test.ts'],
            summary: 'Task completed'
          })
        }]
      })

      // Mock Review Agent response
      sessions_spawn.mockResolvedValueOnce({ sessionKey: 'review-session' })
      sessions_history.mockResolvedValueOnce({
        messages: [{
          content: JSON.stringify({
            approved: true,
            issues: [],
            suggestions: [],
            summary: 'Review passed'
          })
        }]
      })

      const result = await orchestrator.execute('创建一个测试文件')

      expect(result.success).toBe(true)
      expect(result.tasks).toHaveLength(1)
      expect(result.summary).toContain('完成了 1 个任务')
    })

    it('should handle empty task result', async () => {
      sessions_spawn.mockResolvedValueOnce({ sessionKey: 'pm-session' })
      sessions_history.mockResolvedValueOnce({
        messages: [{
          content: JSON.stringify({
            analysis: 'No tasks needed',
            tasks: []
          })
        }]
      })

      const result = await orchestrator.execute('空需求')

      expect(result.success).toBe(false)
      expect(result.tasks).toHaveLength(0)
    })

    it('should handle multiple tasks', async () => {
      // Mock PM Agent
      sessions_spawn.mockResolvedValueOnce({ sessionKey: 'pm-session' })
      sessions_history.mockResolvedValueOnce({
        messages: [{
          content: JSON.stringify({
            analysis: 'Multi-task project',
            tasks: [
              { id: 'task-1', title: 'Task 1', description: 'Desc 1', assignedTo: 'dev', dependencies: [], status: 'pending' },
              { id: 'task-2', title: 'Task 2', description: 'Desc 2', assignedTo: 'dev', dependencies: [], status: 'pending' }
            ]
          })
        }]
      })

      // Mock Dev + Review for task 1
      sessions_spawn.mockResolvedValueOnce({ sessionKey: 'dev-1' })
      sessions_history.mockResolvedValueOnce({
        messages: [{ content: JSON.stringify({ success: true, files: ['a.ts'], summary: 'Done' }) }]
      })
      sessions_spawn.mockResolvedValueOnce({ sessionKey: 'review-1' })
      sessions_history.mockResolvedValueOnce({
        messages: [{ content: JSON.stringify({ approved: true, issues: [], suggestions: [], summary: 'OK' }) }]
      })

      // Mock Dev + Review for task 2
      sessions_spawn.mockResolvedValueOnce({ sessionKey: 'dev-2' })
      sessions_history.mockResolvedValueOnce({
        messages: [{ content: JSON.stringify({ success: true, files: ['b.ts'], summary: 'Done' }) }]
      })
      sessions_spawn.mockResolvedValueOnce({ sessionKey: 'review-2' })
      sessions_history.mockResolvedValueOnce({
        messages: [{ content: JSON.stringify({ approved: true, issues: [], suggestions: [], summary: 'OK' }) }]
      })

      const result = await orchestrator.execute('创建多个文件')

      expect(result.success).toBe(true)
      expect(result.tasks).toHaveLength(2)
      expect(result.results).toHaveLength(2)
    })
  })
})
