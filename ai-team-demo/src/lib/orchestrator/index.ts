import { BaseOrchestrator, OrchestratorCallbacks, ObservabilityConfig } from '../core/base-orchestrator'
import { WorkflowResult, Task, RetryConfig, FileChange } from '../core/types'
import { agentManager } from '../agents/manager'
import { taskManager } from '../tasks/manager'
import { chatManager } from '../chat/manager'
import { fileSystemManager } from '../filesystem/manager'
import { resolveTaskOrder, DependencyError } from '../utils/task-resolver'
import { resolveTitleDependencies } from '../utils/resolve-title-deps'
import { groupTasksByLevels } from '../utils/task-levels'
import { OrchestratorError, FileSystemError } from '../core/errors'

export type { WorkflowError, FailedTask, WorkflowStats, WorkflowResult } from '../core/types'

export class Orchestrator extends BaseOrchestrator {
  private projectId: string

  constructor(projectId: string = 'default', retryConfig?: Partial<RetryConfig>, observability?: ObservabilityConfig) {
    super(retryConfig, observability)
    this.projectId = projectId
  }

  getObservability() {
    return super.getObservability()
  }

  resetObservability() {
    super.resetObservability()
  }

  protected getCallbacks(): OrchestratorCallbacks {
    return {
      sendUserMessage: (msg) => chatManager.sendUserMessage(msg),
      broadcast: (agent, msg) => chatManager.broadcast(agent, msg),
      createTask: (title, desc, assignedTo, deps, files) =>
        taskManager.createTask(title, desc, assignedTo, deps, files),
      getTask: (id) => taskManager.getTask(id),
      updateTaskStatus: (id, status) => { taskManager.updateTaskStatus(id, status) },
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

    this.logInfo('Workflow started', { userMessage })
    this.getEventBus().emit({
      type: 'workflow:started',
      data: { userMessage },
    })

    try {
      cb.sendUserMessage(userMessage)

      const initialTask = cb.createTask(userMessage, userMessage, 'pm', [], [])

      this.getEventBus().emit({
        type: 'task:started',
        agentRole: 'pm',
        taskId: initialTask.id,
      })
      const pmResponse = await this.executeAgentWithRetry('pm', initialTask, cb)
      if (!pmResponse) {
        this.logError('Workflow completed', { success: false, reason: 'PM task failed after all retries' })
        this.getEventBus().emit({
          type: 'task:failed',
          agentRole: 'pm',
          taskId: initialTask.id,
          data: { reason: 'PM task failed after all retries' },
        })
        this.getEventBus().emit({
          type: 'workflow:failed',
          data: { reason: 'PM task failed after all retries' },
        })
        return this.createErrorResponse('PM task failed after all retries', cb, initialTask.id)
      }
      cb.broadcast('pm', pmResponse.message)
      this.getEventBus().emit({
        type: 'task:completed',
        agentRole: 'pm',
        taskId: initialTask.id,
      })

      const subTasks: Task[] = []
      if (pmResponse.tasks) {
        for (const taskData of pmResponse.tasks) {
          const task = cb.createTask(
            taskData.title,
            taskData.description,
            taskData.assignedTo,
            taskData.dependencies,
            taskData.files,
          )
          subTasks.push(task)
        }
      }

      const subTaskIds = subTasks.map((t) => t.id)

      const allFiles: WorkflowResult['files'] = []
      const completedTaskIds = new Set<string>()

      const resolvedSubTasks = resolveTitleDependencies(subTasks)

      let sortedTasks: Task[]
      try {
        sortedTasks = resolveTaskOrder(resolvedSubTasks)
      } catch (depError) {
        if (depError instanceof DependencyError) {
          this.logError('Dependency resolution failed', { error: depError.message })
          this.obs.errors.track(new OrchestratorError(depError.message))
          this.logError('Workflow completed', { success: false, reason: 'Dependency resolution failed' })
          this.getEventBus().emit({
            type: 'workflow:failed',
            data: { reason: 'Dependency resolution failed', error: depError.message },
          })
          return {
            success: false,
            messages: cb.getChatHistory().map(m => ({
              agent: m.agent,
              content: m.content,
              timestamp: m.timestamp,
            })),
            tasks: cb.getAllTasks(),
            error: {
              message: depError.message,
              timestamp: new Date(),
            },
        stats: this.buildWorkflowStats(subTaskIds.length, cb, completedTaskIds.size),
          }
        }
        throw depError
      }

      this.obs.perf.increment('orchestrator.tasks.total', subTaskIds.length)
      this.obs.perf.setGauge('orchestrator.tasks.active', subTaskIds.length)

      const levels = groupTasksByLevels(sortedTasks)

      for (const levelTaskIds of levels) {
        const levelTasks = levelTaskIds
          .map((id) => sortedTasks.find((t) => t.id === id))
          .filter((t): t is Task => t !== undefined)

        const promises = levelTasks.map((task) =>
          this.executeSingleTask(task, cb, subTaskIds, completedTaskIds, allFiles)
        )

        const levelResults = await Promise.allSettled(promises)

        for (const r of levelResults) {
          if (r.status === 'rejected') {
            this.logError('Unexpected rejection in parallel level', {
              error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            })
          }
        }
      }

      this.obs.perf.recordValue('orchestrator.workflow.duration', Date.now() - this.startTime)
      this.obs.perf.setGauge('orchestrator.tasks.active', 0)

      const hasSuccess = subTaskIds.length === 0 || completedTaskIds.size === subTaskIds.length
      this.logInfo('Workflow completed', { success: hasSuccess, completed: completedTaskIds.size, total: subTaskIds.length, failed: this.failedTasks.length })
      this.getEventBus().emit({
        type: 'workflow:completed',
        data: { success: hasSuccess, completed: completedTaskIds.size, total: subTaskIds.length, failed: this.failedTasks.length },
      })
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
        stats: this.buildWorkflowStats(subTaskIds.length, cb, completedTaskIds.size),
      }
    } catch (error) {
      this.logError('Fatal error in executeUserRequest', { error: error instanceof Error ? error.message : 'Unknown error' })
      this.obs.errors.track(error instanceof Error ? error : new Error(String(error)))
      this.logError('Fatal error in workflow', { error: error instanceof Error ? error.message : 'Unknown error' })
      this.getEventBus().emit({
        type: 'workflow:failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
      })
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
