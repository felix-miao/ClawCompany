import { BaseOrchestrator, OrchestratorCallbacks } from '../core/base-orchestrator'
import { WorkflowResult, AgentRole, Task, AgentContext } from '../core/types'
import { agentManager } from '../agents/manager'
import { taskManager } from '../tasks/manager'
import { chatManager } from '../chat/manager'
import { fileSystemManager } from '../filesystem/manager'

export type { WorkflowError, FailedTask, WorkflowStats, WorkflowResult } from '../core/types'

export class Orchestrator extends BaseOrchestrator {
  private projectId: string

  constructor(projectId: string = 'default', retryConfig?: Parameters<typeof BaseOrchestrator>[0]) {
    super(retryConfig)
    this.projectId = projectId
  }

  protected getCallbacks(): OrchestratorCallbacks {
    return {
      sendUserMessage: (msg) => chatManager.sendUserMessage(msg),
      broadcast: (agent, msg) => chatManager.broadcast(agent, msg),
      createTask: (title, desc, assignedTo, deps, files) =>
        taskManager.createTask(title, desc, assignedTo, deps, files),
      getTask: (id) => taskManager.getTask(id),
      updateTaskStatus: (id, status) => taskManager.updateTaskStatus(id, status as any),
      getAllTasks: () => taskManager.getAllTasks(),
      getChatHistory: () => chatManager.getHistory(),
      executeAgent: (role, task, context) => agentManager.executeAgent(role, task, context),
      saveFile: async (path, content) => {
        await fileSystemManager.createFile(path, content)
      },
      clearAll: () => {
        taskManager.clearTasks()
        chatManager.clearHistory()
      },
    }
  }

  async executeUserRequest(userMessage: string): Promise<WorkflowResult> {
    this.startTime = Date.now()
    this.totalRetries = 0
    this.failedTasks = []

    const cb = this.getCallbacks()

    try {
      cb.sendUserMessage(userMessage)

      const initialTask = cb.createTask(userMessage, userMessage, 'pm', [], [])

      const pmResponse = await this.executeAgentWithRetry('pm', initialTask, cb)
      if (!pmResponse) {
        return this.createErrorResponse('PM task failed after all retries', cb, initialTask.id)
      }
      cb.broadcast('pm', pmResponse.message)

      const subTaskIds: string[] = []
      if (pmResponse.tasks) {
        for (const taskData of pmResponse.tasks) {
          const task = cb.createTask(
            taskData.title,
            taskData.description,
            taskData.assignedTo,
            taskData.dependencies,
            taskData.files,
          )
          subTaskIds.push(task.id)
        }
      }

      const allFiles: WorkflowResult['files'] = []
      for (const taskId of subTaskIds) {
        const task = cb.getTask(taskId)
        if (!task) continue

        try {
          cb.updateTaskStatus(taskId, 'in_progress')

          if (task.assignedTo === 'dev') {
            const devResponse = await this.executeAgentWithRetry('dev', task, cb)

            if (!devResponse) {
              this.recordFailedTask(task, 'Dev task failed after all retries')
              continue
            }

            cb.broadcast('dev', devResponse.message)

            if (devResponse.files) {
              for (const file of devResponse.files) {
                try {
                  await cb.saveFile?.(file.path, file.content)
                  console.log(`[Orchestrator] Saved file: ${file.path}`)
                } catch (error) {
                  console.error(`[Orchestrator] Failed to save file ${file.path}:`, error)
                }
              }
              allFiles.push(...devResponse.files)
            }

            cb.updateTaskStatus(taskId, 'review')

            const reviewResponse = await this.executeAgentWithRetry('review', task, cb)

            if (!reviewResponse) {
              this.recordFailedTask(task, 'Review task failed after all retries')
              continue
            }

            cb.broadcast('review', reviewResponse.message)

            if (reviewResponse.status === 'success') {
              cb.updateTaskStatus(taskId, 'done')
            } else {
              cb.updateTaskStatus(taskId, 'pending')
            }
          }
        } catch (error) {
          console.error(`[Orchestrator] Unexpected error in task ${taskId}:`, error)
          this.recordFailedTask(task, error instanceof Error ? error.message : 'Unknown error')
        }
      }

      const hasSuccess = subTaskIds.length === 0 || this.failedTasks.length < subTaskIds.length
      return {
        success: hasSuccess,
        messages: cb.getChatHistory().map(m => ({
          agent: m.agent,
          content: m.content,
          timestamp: m.timestamp,
        })),
        tasks: cb.getAllTasks(),
        files: allFiles,
        failedTasks: this.failedTasks.length > 0 ? this.failedTasks : undefined,
        stats: this.buildWorkflowStats(subTaskIds.length, cb),
      }
    } catch (error) {
      console.error('[Orchestrator] Fatal error in executeUserRequest:', error)
      return {
        success: false,
        messages: cb.getChatHistory().map(m => ({
          agent: m.agent,
          content: m.content,
          timestamp: m.timestamp,
        })),
        tasks: cb.getAllTasks(),
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        },
        stats: this.buildWorkflowStats(0, cb),
      }
    }
  }

  getStatus() {
    return {
      projectId: this.projectId,
      tasks: taskManager.getAllTasks(),
      messages: chatManager.getHistory(),
      stats: taskManager.getStats(),
    }
  }
}

export const orchestrator = new Orchestrator()
