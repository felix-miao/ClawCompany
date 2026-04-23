import type { Task, AgentRole } from '../core/types'
import type { TaskManager } from '../tasks/manager'
import type { PersistedAgentConfig } from '@/types/agent-config'

export interface AgentContextInput {
  agentConfig: PersistedAgentConfig
  taskId?: string
  conversationId?: string
  currentTask?: Task
  projectState?: ProjectStateSummary
}

export interface ProjectStateSummary {
  projectId: string
  totalTasks: number
  pendingTasks: number
  inProgressTasks: number
  completedTasks: number
  failedTasks: number
  recentMessages: Array<{
    agent: string
    content: string
    timestamp: string
  }>
}

interface ProjectContextSection {
  title: string
  lines: string[]
}

const PROJECT_CONTEXT_SECTIONS: ProjectContextSection[] = [
  {
    title: '## 项目概览',
    lines: [
      '- 项目类型: Next.js 应用',
      '- 架构: App Router + API Routes + Agent 编排',
      '- 重点: 单 Agent 对话、任务协作、代码生成与审查',
    ],
  },
  {
    title: '## 项目技术栈',
    lines: [
      '- 框架: Next.js App Router',
      '- UI: React',
      '- 语言: TypeScript',
      '- 样式: Tailwind CSS',
      '- 校验: Zod',
      '- 测试: Jest, Playwright',
      '- 工具: ESLint',
      '- 运行时/服务: ioredis',
    ],
  },
  {
    title: '## 关键依赖',
    lines: [
      '- next',
      '- react',
      '- react-dom',
      '- zod',
      '- tailwindcss',
      '- jest',
      '- @playwright/test',
      '- eslint',
    ],
  },
  {
    title: '## src/ 关键结构',
    lines: [
      '- src/app: 路由、页面和 API 入口',
      '- src/lib/agents: PM / Dev / Review 上下文与执行逻辑',
      '- src/lib/core: Agent 和 Task 的核心类型',
      '- src/lib/api: API 约定、路由工具和 schema',
      '- src/lib/gateway: OpenClaw 网关与会话连接',
      '- src/lib/orchestrator: 多 Agent 编排',
      '- src/lib/storage: Conversation 和 Agent 持久化',
      '- src/lib/utils: 通用工具',
      '- src/types: Zod schema 和共享类型',
      '- src/test-utils: 测试辅助工具',
    ],
  },
]

function buildProjectContextSections(): string[] {
  return PROJECT_CONTEXT_SECTIONS.flatMap(section => [
    section.title,
    ...section.lines,
  ])
}

function buildCurrentSessionSection(taskId?: string, conversationId?: string): string[] {
  const lines = ['## 当前会话上下文']

  if (conversationId) {
    lines.push(`- 会话ID: ${conversationId}`)
  }
  if (taskId) {
    lines.push(`- 任务ID: ${taskId}`)
  }

  return lines
}

function buildCurrentTaskSection(currentTask: Task): string[] {
  const lines = ['## 当前任务']

  lines.push(`- 标题: ${currentTask.title}`)
  lines.push(`- 描述: ${currentTask.description}`)
  lines.push(`- 状态: ${currentTask.status}`)
  lines.push(`- 负责人: ${currentTask.assignedTo}`)

  if (currentTask.dependencies.length > 0) {
    lines.push(`- 依赖: ${currentTask.dependencies.join(', ')}`)
  }

  return lines
}

function buildProjectStateSection(projectState: ProjectStateSummary): string[] {
  const lines = ['## 项目状态摘要']

  lines.push(`- 项目ID: ${projectState.projectId}`)
  lines.push(`- 总任务数: ${projectState.totalTasks}`)
  lines.push(`- 待处理: ${projectState.pendingTasks}`)
  lines.push(`- 进行中: ${projectState.inProgressTasks}`)
  lines.push(`- 已完成: ${projectState.completedTasks}`)
  lines.push(`- 失败: ${projectState.failedTasks}`)

  if (projectState.recentMessages.length > 0) {
    lines.push('### 最近消息')

    const recent = projectState.recentMessages.slice(-5)
    for (const msg of recent) {
      const preview = msg.content.length > 100 ? `${msg.content.substring(0, 100)}...` : msg.content
      lines.push(`- [${msg.agent}]: ${preview}`)
    }
  }

  return lines
}

export function buildAgentContext(input: AgentContextInput): string {
  const { agentConfig, taskId, conversationId, currentTask, projectState } = input

  const sections: string[] = []

  sections.push(...buildCurrentSessionSection(taskId, conversationId))
  sections.push('')
  sections.push(...buildProjectContextSections())

  if (currentTask) {
    sections.push('')
    sections.push(...buildCurrentTaskSection(currentTask))
  }

  if (projectState) {
    sections.push('')
    sections.push(...buildProjectStateSection(projectState))
  }

  return sections.join('\n').trim()
}

export function buildAgentSystemPrompt(agentConfig: Pick<PersistedAgentConfig, 'systemPrompt'>, context: string): string {
  return agentConfig.systemPrompt ? `${agentConfig.systemPrompt}\n\n${context}` : context
}

export function getProjectStateSummary(taskManager: TaskManager, chatMessages: Array<{ agent: string; content: string; timestamp: string }>): ProjectStateSummary {
  const stats = taskManager.getStats()
  const tasks = taskManager.getAllTasks()

  return {
    projectId: taskManager['projectId'] ?? 'default',
    totalTasks: stats.total,
    pendingTasks: stats.pending,
    inProgressTasks: stats.inProgress,
    completedTasks: stats.completed,
    failedTasks: stats.failed,
    recentMessages: chatMessages.slice(-10).map(m => ({
      agent: m.agent,
      content: m.content,
      timestamp: m.timestamp
    }))
  }
}
