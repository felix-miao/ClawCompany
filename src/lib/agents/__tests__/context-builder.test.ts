import { buildAgentContext, buildAgentSystemPrompt, getProjectStateSummary, type AgentContextInput, type ProjectStateSummary } from '../context-builder'
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
    expect(context).toContain('## 项目概览')
    expect(context).toContain('## 项目技术栈')
    expect(context).toContain('## 关键依赖')
    expect(context).toContain('## src/ 关键结构')
  })

  it('should provide a stable project context summary for the dev agent', () => {
    const input: AgentContextInput = { agentConfig: mockAgentConfig }
    const context = buildAgentContext(input)

    expect(context).toContain('- 项目类型: Next.js 应用')
    expect(context).toContain('- 框架: Next.js App Router')
    expect(context).toContain('- UI: React')
    expect(context).toContain('- 语言: TypeScript')
    expect(context).toContain('- 样式: Tailwind CSS')
    expect(context).toContain('- 校验: Zod')
    expect(context).toContain('- 测试: Jest, Playwright')
    expect(context).toContain('- 工具: ESLint')
    expect(context).toContain('- 运行时/服务: ioredis')

    expect(context).toContain('- next')
    expect(context).toContain('- react')
    expect(context).toContain('- react-dom')
    expect(context).toContain('- zod')
    expect(context).toContain('- tailwindcss')

    expect(context).toContain('- src/app: 路由、页面和 API 入口')
    expect(context).toContain('- src/lib/agents: PM / Dev / Review 上下文与执行逻辑')
    expect(context).toContain('- src/lib/core: Agent 和 Task 的核心类型')
    expect(context).toContain('- src/lib/api: API 约定、路由工具和 schema')
    expect(context).toContain('- src/lib/gateway: OpenClaw 网关与会话连接')
    expect(context).toContain('- src/lib/orchestrator: 多 Agent 编排')
    expect(context).toContain('- src/lib/storage: Conversation 和 Agent 持久化')
    expect(context).toContain('- src/lib/utils: 通用工具')
    expect(context).toContain('- src/types: Zod schema 和共享类型')
    expect(context).toContain('- src/test-utils: 测试辅助工具')
  })

  it('should include conversationId when provided', () => {
    const input: AgentContextInput = {
      agentConfig: mockAgentConfig,
      conversationId: 'conv-123'
    }
    const context = buildAgentContext(input)

    expect(context).toContain('conv-123')
  })

  it('should prepend the agent system prompt when building the final prompt', () => {
    const context = '## 当前会话上下文'
    const prompt = buildAgentSystemPrompt(mockAgentConfig, context)

    expect(prompt).toBe(`${mockAgentConfig.systemPrompt}\n\n${context}`)
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

describe('context injection with taskId', () => {
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

  it('should include currentTask when taskId is provided and task exists in manager', () => {
    const mockTaskManager = {
      getTask: (taskId: string) => {
        if (taskId === 'task-active') {
          return {
            id: 'task-active',
            title: 'Implement login feature',
            description: 'Create login form with validation',
            status: 'in_progress' as const,
            assignedTo: 'dev' as const,
            dependencies: ['task-base'],
            files: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
        return undefined
      }
    } as any

    const input: AgentContextInput = {
      agentConfig: mockAgentConfig,
      taskId: 'task-active',
      currentTask: mockTaskManager.getTask('task-active')
    }
    const context = buildAgentContext(input)

    expect(context).toContain('## 当前任务')
    expect(context).toContain('Implement login feature')
    expect(context).toContain('in_progress')
    expect(context).toContain('task-base')
  })

  it('should not include currentTask section when taskId provided but task not found', () => {
    const mockTaskManager = {
      getTask: () => undefined
    } as any

    const input: AgentContextInput = {
      agentConfig: mockAgentConfig,
      taskId: 'nonexistent-task',
      currentTask: undefined
    }
    const context = buildAgentContext(input)

    expect(context).toContain('## 当前会话上下文')
    expect(context).toContain('nonexistent-task')
    expect(context).not.toContain('## 当前任务')
  })
})
