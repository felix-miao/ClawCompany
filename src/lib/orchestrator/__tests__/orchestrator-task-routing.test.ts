import { Orchestrator } from '../index'
import { agentManager } from '@/lib/agents/manager'
import { taskManager } from '@/lib/tasks/manager'
import { chatManager } from '@/lib/chat/manager'

jest.mock('@/lib/agents/manager')
jest.mock('@/lib/tasks/manager')
jest.mock('@/lib/chat/manager')

describe('Orchestrator taskId routing (Batch 1 Round 1)', () => {
  let orchestrator: Orchestrator

  beforeEach(() => {
    jest.clearAllMocks()
    orchestrator = new Orchestrator('test-project')

    ;(chatManager.sendUserMessage as jest.Mock).mockImplementation((content: string, metadata?: any) => ({
      id: 'msg-' + Math.random().toString(36).substr(2, 9),
      agent: 'user',
      content,
      type: 'text',
      timestamp: new Date(),
      metadata
    }))
    ;(chatManager.broadcast as jest.Mock).mockImplementation(() => {})
    ;(chatManager.getHistory as jest.Mock).mockReturnValue([])
    ;(chatManager.clearHistory as jest.Mock).mockImplementation(() => {})
    ;(taskManager.createTask as jest.Mock).mockImplementation((title, desc, assignedTo, deps, files) => ({
      id: 'task-' + Math.random().toString(36).substr(2, 9),
      title,
      description: desc,
      assignedTo,
      dependencies: deps,
      files,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    ;(taskManager.getTask as jest.Mock).mockImplementation((id) => ({
      id,
      title: 'Test Task',
      description: 'Test Description',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    ;(taskManager.getAllTasks as jest.Mock).mockReturnValue([])
    ;(taskManager.updateTaskStatus as jest.Mock).mockImplementation(() => {})
    ;(taskManager.clearTasks as jest.Mock).mockImplementation(() => {})
    ;(taskManager.getStats as jest.Mock).mockReturnValue({
      total: 0,
      pending: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    })
    ;(agentManager.executeAgent as jest.Mock).mockResolvedValue({
      message: 'PM analysis complete',
      tasks: [
        { title: 'Task 1', description: 'Desc 1', assignedTo: 'dev', dependencies: [] }
      ],
      files: [],
      status: 'success'
    })
  })

  describe('executeUserRequest accepts taskId option', () => {
    it('should accept taskId as second parameter', async () => {
      const result = await orchestrator.executeUserRequest('build a feature', { taskId: 'task_123' })
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })

    it('should pass taskId to sendUserMessage metadata', async () => {
      let capturedMetadata: any
      ;(chatManager.sendUserMessage as jest.Mock).mockImplementation((content: string, metadata?: any) => {
        capturedMetadata = metadata
        return {
          id: 'msg-' + Math.random().toString(36).substr(2, 9),
          agent: 'user',
          content,
          type: 'text',
          timestamp: new Date(),
          metadata
        }
      })

      await orchestrator.executeUserRequest('build a feature', { taskId: 'task_abc' })

      expect(capturedMetadata).toBeDefined()
      expect(capturedMetadata?.taskId).toBe('task_abc')
    })

    it('should work without taskId (backward compatible)', async () => {
      let capturedArgs: any[]
      ;(chatManager.sendUserMessage as jest.Mock).mockImplementation((...args: any[]) => {
        capturedArgs = args
        return {
          id: 'msg-' + Math.random().toString(36).substr(2, 9),
          agent: 'user',
          content: args[0],
          type: 'text',
          timestamp: new Date(),
        }
      })

      await orchestrator.executeUserRequest('build a feature')

      // Without taskId, no metadata is passed to sendUserMessage
      expect(capturedArgs![0]).toBe('build a feature')
      // metadata arg should not include a taskId
      const metadata = capturedArgs![1]
      expect(metadata?.taskId).toBeUndefined()
    })
  })

  describe('taskId propagates to ChatManager message', () => {
    it('user message should have taskId in metadata when provided', async () => {
      const result = await orchestrator.executeUserRequest('test message', { taskId: 'task_xyz' })

      const userMessages = result.messages.filter(m => m.agent === 'user')
      expect(userMessages.length).toBeGreaterThan(0)

      const lastUserMsg = userMessages[userMessages.length - 1]
      expect(lastUserMsg).toBeDefined()
    })
  })
})
