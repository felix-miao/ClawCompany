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

export function buildAgentContext(input: AgentContextInput): string {
  const { agentConfig, taskId, conversationId, currentTask, projectState } = input

  const sections: string[] = []

  sections.push('## 当前会话上下文')
  if (conversationId) {
    sections.push(`- 会话ID: ${conversationId}`)
  }
  if (taskId) {
    sections.push(`- 任务ID: ${taskId}`)
  }

  if (currentTask) {
    sections.push('\n## 当前任务')
    sections.push(`- 标题: ${currentTask.title}`)
    sections.push(`- 描述: ${currentTask.description}`)
    sections.push(`- 状态: ${currentTask.status}`)
    sections.push(`- 负责人: ${currentTask.assignedTo}`)
    if (currentTask.dependencies.length > 0) {
      sections.push(`- 依赖: ${currentTask.dependencies.join(', ')}`)
    }
  }

  if (projectState) {
    sections.push('\n## 项目状态摘要')
    sections.push(`- 项目ID: ${projectState.projectId}`)
    sections.push(`- 总任务数: ${projectState.totalTasks}`)
    sections.push(`- 待处理: ${projectState.pendingTasks}`)
    sections.push(`- 进行中: ${projectState.inProgressTasks}`)
    sections.push(`- 已完成: ${projectState.completedTasks}`)
    sections.push(`- 失败: ${projectState.failedTasks}`)

    if (projectState.recentMessages.length > 0) {
      sections.push('\n### 最近消息')
      const recent = projectState.recentMessages.slice(-5)
      for (const msg of recent) {
        const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content
        sections.push(`- [${msg.agent}]: ${preview}`)
      }
    }
  }

  return sections.join('\n')
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