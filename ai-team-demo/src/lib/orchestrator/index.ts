// Orchestrator - Agent 协调器，管理完整的工作流（带错误处理和重试机制）

import { agentManager } from '../agents/manager'
import { taskManager } from '../tasks/manager'
import { chatManager } from '../chat/manager'
import { fileSystemManager } from '../filesystem/manager'
import { Task, AgentRole, AgentContext } from '../agents/types'

export interface WorkflowError {
  message: string
  code?: string
  task?: string
  timestamp: Date
  retryCount?: number
}

export interface FailedTask {
  taskId: string
  taskTitle: string
  error: string
  retryCount: number
  timestamp: Date
}

export interface WorkflowStats {
  totalTasks: number
  successfulTasks: number
  failedTasks: number
  totalRetries: number
  executionTime: number
}

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
  error?: WorkflowError
  failedTasks?: FailedTask[]
  stats?: WorkflowStats
}

interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
}

export class Orchestrator {
  private projectId: string
  private retryConfig: RetryConfig
  private totalRetries: number = 0
  private failedTasks: FailedTask[] = []
  private startTime: number = 0

  constructor(projectId: string = 'default', retryConfig?: Partial<RetryConfig>) {
    this.projectId = projectId
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  }

  /**
   * 执行完整的 Agent 协作流程（带错误处理和重试）
   * User -> PM -> Dev -> Review -> Done
   */
  async executeUserRequest(userMessage: string): Promise<WorkflowResult> {
    this.startTime = Date.now()
    this.totalRetries = 0
    this.failedTasks = []
    
    try {
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

      // 3. PM Claw 分析需求（带重试）
      const pmResponse = await this.executeAgentWithRetry('pm', initialTask)
      if (!pmResponse) {
        return this.createErrorResponse('PM task failed after all retries', initialTask.id)
      }
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

      // 5. 执行所有子任务（按依赖顺序，支持部分失败）
      const allFiles: WorkflowResult['files'] = []
      for (const taskId of subTaskIds) {
        const task = taskManager.getTask(taskId)
        if (!task) continue

        try {
          // 更新任务状态为 in_progress
          taskManager.updateTaskStatus(taskId, 'in_progress')

          // Dev Claw 执行（带重试）
          if (task.assignedTo === 'dev') {
            const devResponse = await this.executeAgentWithRetry('dev', task)
            
            if (!devResponse) {
              // 记录失败但继续执行其他任务
              this.recordFailedTask(task, 'Dev task failed after all retries')
              continue
            }
            
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
                  // 记录文件错误但继续执行
                }
              }
              allFiles.push(...devResponse.files)
            }

            // 更新任务状态为 review
            taskManager.updateTaskStatus(taskId, 'review')

            // Reviewer Claw 审查（带重试）
            const reviewResponse = await this.executeAgentWithRetry('review', task)
            
            if (!reviewResponse) {
              this.recordFailedTask(task, 'Review task failed after all retries')
              continue
            }
            
            chatManager.broadcast('review', reviewResponse.message)

            // 根据审查结果更新状态
            if (reviewResponse.status === 'success') {
              taskManager.updateTaskStatus(taskId, 'done')
            } else {
              // 如果需要修改，标记为 pending 等待重新执行
              taskManager.updateTaskStatus(taskId, 'pending')
            }
          }
        } catch (error) {
          // 捕获未预期的错误，记录但继续执行其他任务
          console.error(`[Orchestrator] Unexpected error in task ${taskId}:`, error)
          this.recordFailedTask(task, error instanceof Error ? error.message : 'Unknown error')
        }
      }

      // 6. 返回结果
      const executionTime = Date.now() - this.startTime
      const hasSuccess = subTaskIds.length === 0 || this.failedTasks.length < subTaskIds.length
      return {
        success: hasSuccess, // PM成功但没有子任务，或者至少有一个子任务成功
        messages: chatManager.getHistory().map(m => ({
          agent: m.agent,
          content: m.content,
          timestamp: m.timestamp,
        })),
        tasks: taskManager.getAllTasks(),
        files: allFiles,
        failedTasks: this.failedTasks.length > 0 ? this.failedTasks : undefined,
        stats: {
          totalTasks: subTaskIds.length,
          successfulTasks: subTaskIds.length - this.failedTasks.length,
          failedTasks: this.failedTasks.length,
          totalRetries: this.totalRetries,
          executionTime,
        },
      }
    } catch (error) {
      // 捕获全局错误
      console.error('[Orchestrator] Fatal error in executeUserRequest:', error)
      return {
        success: false,
        messages: chatManager.getHistory().map(m => ({
          agent: m.agent,
          content: m.content,
          timestamp: m.timestamp,
        })),
        tasks: taskManager.getAllTasks(),
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        },
        stats: {
          totalTasks: 0,
          successfulTasks: 0,
          failedTasks: 1,
          totalRetries: this.totalRetries,
          executionTime: Date.now() - this.startTime,
        },
      }
    }
  }

  /**
   * 执行Agent，带重试机制和指数退避
   */
  private async executeAgentWithRetry(role: AgentRole, task: Task) {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await this.executeAgent(role, task)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < this.retryConfig.maxRetries) {
          // 计算退避时间（指数退避）
          const delay = Math.min(
            this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
            this.retryConfig.maxDelay
          )
          
          console.warn(
            `[Orchestrator] Retry ${attempt + 1}/${this.retryConfig.maxRetries} for ${role} agent after ${delay}ms:`,
            lastError.message
          )
          
          this.totalRetries++
          
          // 等待退避时间
          await this.sleep(delay)
        } else {
          console.error(
            `[Orchestrator] All ${this.retryConfig.maxRetries} retries failed for ${role} agent:`,
            lastError.message
          )
        }
      }
    }
    
    // 所有重试都失败了
    return null
  }

  /**
   * 执行Agent（原始方法）
   */
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
   * 记录失败的任务
   */
  private recordFailedTask(task: Task, errorMessage: string) {
    this.failedTasks.push({
      taskId: task.id,
      taskTitle: task.title,
      error: errorMessage,
      retryCount: this.retryConfig.maxRetries,
      timestamp: new Date(),
    })
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(errorMessage: string, taskId?: string): WorkflowResult {
    return {
      success: false,
      messages: chatManager.getHistory().map(m => ({
        agent: m.agent,
        content: m.content,
        timestamp: m.timestamp,
      })),
      tasks: taskManager.getAllTasks(),
      error: {
        message: errorMessage,
        task: taskId,
        timestamp: new Date(),
      },
      stats: {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 1,
        totalRetries: this.totalRetries,
        executionTime: Date.now() - this.startTime,
      },
    }
  }

  /**
   * 异步延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
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
    this.totalRetries = 0
    this.failedTasks = []
  }
}

// 全局协调器实例
export const orchestrator = new Orchestrator()
