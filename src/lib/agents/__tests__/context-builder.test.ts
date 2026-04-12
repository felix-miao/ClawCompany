import { buildAgentContext, getProjectStateSummary, type AgentContextInput, type ProjectStateSummary } from '../context-builder'
import type { PersistedAgentConfig } from '@/types/agent-config'

describe('buildAgentContext', () => {
  const mockAgentConfig: PersistedAgentConfig = {
    id: 'pm-agent',
    name: 'PM Claw',
    role: 'pm',
    emoji: '📋',
    color: '#3B82F6',
    systemPrompt: 'You are PM Claw',
    runtime: 'subagent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  it('should return context header when no additional data provided', () => {
    const input: AgentContextInput = { agentConfig: mockAgentConfig }
    const context = buildAgentContext(input)

    expect(context).toContain('## 当前会话上下文')
  })

  it('should include conversationId when provided', () => {
    const input: AgentContextInput = {
      agentConfig: mockAgentConfig,
      conversationId: 'conv-123'
    }
    const context = buildAgentContext(input)

    expect(context).toContain('conv-123')
  })

  it('should include taskId when provided', () => {
    const input: AgentContextInput = {
      agentConfig: mockAgentConfig,
      taskId: 'task-456'
    }
    const context = buildAgentContext(input)

    expect(context).toContain('task-456')
  })

  it('should include currentTask details when provided', () => {
    const input: AgentContextInput = {
      agentConfig: mockAgentConfig,
      taskId: 'task-456',
      currentTask: {
        id: 'task-456',
        title: 'Implement login',
        description: 'Create a login form',
        status: 'in_progress',
        assignedTo: 'dev' as const,
        dependencies: ['task-123'],
        files: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
    const context = buildAgentContext(input)

    expect(context).toContain('Implement login')
    expect(context).toContain('in_progress')
    expect(context).toContain('dev')
    expect(context).toContain('task-123')
  })

  it('should include projectState summary when provided', () => {
    const projectState: ProjectStateSummary = {
      projectId: 'my-project',
      totalTasks: 5,
      pendingTasks: 2,
      inProgressTasks: 1,
      completedTasks: 2,
      failedTasks: 0,
      recentMessages: [
        { agent: 'user', content: 'Create login', timestamp: '2026-04-12T10:00:00Z' },
        { agent: 'pm', content: 'Analysis done', timestamp: '2026-04-12T10:01:00Z' }
      ]
    }

    const input: AgentContextInput = {
      agentConfig: mockAgentConfig,
      projectState
    }
    const context = buildAgentContext(input)

    expect(context).toContain('## 项目状态摘要')
    expect(context).toContain('my-project')
    expect(context).toContain('总任务数: 5')
    expect(context).toContain('待处理: 2')
    expect(context).toContain('进行中: 1')
    expect(context).toContain('已完成: 2')
    expect(context).toContain('### 最近消息')
  })

  it('should handle all context fields together', () => {
    const input: AgentContextInput = {
      agentConfig: mockAgentConfig,
      conversationId: 'conv-abc',
      taskId: 'task-xyz',
      currentTask: {
        id: 'task-xyz',
        title: 'Test task',
        description: 'Test description',
        status: 'review',
        assignedTo: 'review' as const,
        dependencies: [],
        files: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      projectState: {
        projectId: 'test-project',
        totalTasks: 3,
        pendingTasks: 1,
        inProgressTasks: 1,
        completedTasks: 1,
        failedTasks: 0,
        recentMessages: []
      }
    }
    const context = buildAgentContext(input)

    expect(context).toContain('conv-abc')
    expect(context).toContain('task-xyz')
    expect(context).toContain('Test task')
    expect(context).toContain('test-project')
  })
})

describe('getProjectStateSummary', () => {
  it('should return summary from task manager and messages', () => {
    const mockTaskManager = {
      getStats: () => ({
        total: 10,
        pending: 3,
        inProgress: 2,
        completed: 4,
        failed: 1,
        review: 0
      }),
      getAllTasks: () => [],
      projectId: 'test-proj'
    } as any

    const chatMessages = [
      { agent: 'user', content: 'Hello', timestamp: '2026-04-12T10:00:00Z' },
      { agent: 'pm', content: 'Hi', timestamp: '2026-04-12T10:01:00Z' }
    ]

    const summary = getProjectStateSummary(mockTaskManager, chatMessages)

    expect(summary.projectId).toBe('test-proj')
    expect(summary.totalTasks).toBe(10)
    expect(summary.pendingTasks).toBe(3)
    expect(summary.inProgressTasks).toBe(2)
    expect(summary.completedTasks).toBe(4)
    expect(summary.failedTasks).toBe(1)
    expect(summary.recentMessages).toHaveLength(2)
  })
})