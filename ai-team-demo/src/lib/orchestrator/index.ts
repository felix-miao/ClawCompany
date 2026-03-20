// Orchestrator - Agent 协调器，管理完整的工作流

import { agentManager } from '../agents/manager'
import { taskManager } from '../tasks/manager'
import { chatManager } from '../chat/manager'
import { fileSystemManager } from '../filesystem/manager'
import { Task, AgentRole, AgentContext } from '../agents/types'

export interface WorkflowResult {
  success: boolean
  messages: Array<{
    agent: AgentRole | 'user'
    content: string
  }>
  tasks: Task[]
  files?: {
    path: string
    content: string
    action: 'create' | 'modify' | 'delete'
  }[]
}

export class Orchestrator {
  private projectId: string

  constructor(projectId: string = 'default') {
    this.projectId = projectId
  }

  /**
   * 执行完整的 Agent 协作流程
   * User -> PM -> Dev -> Review -> Done
   */
  async executeUserRequest(userMessage: string): Promise<WorkflowResult> {
    // 1. 记录用户消息
    chatManager.sendUserMessage(userMessage)

    // 2. 创建初始任务给 PM
    const initialTask = taskManager.createTask(
      userMessage,
      userMessage,
      'pm',
      [],
      []
    )

    // 3. PM Claw 分析需求
    const pmResponse = await this.executeAgent('pm', initialTask)
    chatManager.broadcast('pm', pmResponse.message)

    // 4. 添加 PM 生成的子任务
    const subTaskIds: string[] = []
    if (pmResponse.tasks) {
      for (const taskData of pmResponse.tasks) {
        const task = taskManager.createTask(
          taskData.title,
          taskData.description,
          taskData.assignedTo,
          taskData.dependencies,
          taskData.files
        )
        subTaskIds.push(task.id)
      }
    }

    // 5. 执行所有子任务（按依赖顺序）
    const allFiles: WorkflowResult['files'] = []
    for (const taskId of subTaskIds) {
      const task = taskManager.getTask(taskId)
      if (!task) continue

      // 更新任务状态为 in_progress
      taskManager.updateTaskStatus(taskId, 'in_progress')

      // Dev Claw 执行
      if (task.assignedTo === 'dev') {
        const devResponse = await this.executeAgent('dev', task)
        chatManager.broadcast('dev', devResponse.message)

        // 收集生成的文件
        if (devResponse.files) {
          // 保存文件到文件系统
          for (const file of devResponse.files) {
            try {
              await fileSystemManager.createFile(file.path, file.content)
              console.log(`[Orchestrator] Saved file: ${file.path}`)
            } catch (error) {
              console.error(`[Orchestrator] Failed to save file ${file.path}:`, error)
            }
          }
          allFiles.push(...devResponse.files)
        }

        // 更新任务状态为 review
        taskManager.updateTaskStatus(taskId, 'review')

        // Reviewer Claw 审查
        const reviewResponse = await this.executeAgent('review', task)
        chatManager.broadcast('review', reviewResponse.message)

        // 根据审查结果更新状态
        if (reviewResponse.status === 'success') {
          taskManager.updateTaskStatus(taskId, 'done')
        } else {
          // 如果需要修改，标记为 pending 等待重新执行
          taskManager.updateTaskStatus(taskId, 'pending')
        }
      }
    }

    // 6. 返回结果
    return {
      success: true,
      messages: chatManager.getHistory().map(m => ({
        agent: m.agent,
        content: m.content,
        timestamp: m.timestamp,
      })),
      tasks: taskManager.getAllTasks(),
      files: allFiles,
    }
  }

  private async executeAgent(role: AgentRole, task: Task) {
    const context: AgentContext = {
      projectId: this.projectId,
      tasks: taskManager.getAllTasks(),
      files: {},
      chatHistory: chatManager.getHistory(),
    }

    return agentManager.executeAgent(role, task, context)
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      projectId: this.projectId,
      tasks: taskManager.getAllTasks(),
      messages: chatManager.getHistory(),
      stats: taskManager.getStats(),
    }
  }

  /**
   * 重置状态
   */
  reset() {
    taskManager.clearTasks()
    chatManager.clearHistory()
  }
}

// 全局协调器实例
export const orchestrator = new Orchestrator()
