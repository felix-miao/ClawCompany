import { validateChatResponse, validateChatHistoryResponse } from '../../ai-team-demo/src/lib/api/type-utils'
import { Task, TaskStatus, AgentRole } from '../../ai-team-demo/src/lib/core/types'

describe('Type compatibility tests', () => {
  test('should accept task with required description in ChatResponse', () => {
    const mockData = {
      success: true,
      tasks: [
        {
          id: 'task-1',
          title: 'Test Task',
          description: 'Task description', // description is required
          status: 'pending' as TaskStatus,
          assignedTo: 'pm' as AgentRole,
          dependencies: [],
          files: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]
    }
    
    const result = validateChatResponse(mockData)
    expect(result.success).toBe(true)
    expect(result.tasks).toHaveLength(1)
  })

  test('should accept task with required description in ChatHistoryResponse', () => {
    const mockData = {
      tasks: [
        {
          id: 'task-1',
          title: 'Test Task',
          description: 'Task description', // description is required
          status: 'pending' as TaskStatus,
          assignedTo: 'pm' as AgentRole,
          dependencies: [],
          files: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ],
      chatHistory: [],
      agents: []
    }
    
    const result = validateChatHistoryResponse(mockData)
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('Test Task')
  })

  test('should accept task with empty string description', () => {
    const mockData = {
      success: true,
      tasks: [
        {
          id: 'task-1',
          title: 'Test Task',
          description: '', // empty string should be valid
          status: 'pending' as TaskStatus,
          assignedTo: 'pm' as AgentRole,
          dependencies: [],
          files: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]
    }
    
    const result = validateChatResponse(mockData)
    expect(result.success).toBe(true)
    expect(result.tasks).toHaveLength(1)
  })
})