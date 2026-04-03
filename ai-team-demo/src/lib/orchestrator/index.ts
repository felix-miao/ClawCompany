import { BaseOrchestrator, OrchestratorCallbacks, ObservabilityConfig } from '../core/base-orchestrator'
import { WorkflowResult, Task, RetryConfig } from '../core/types'
import { agentManager } from '../agents/manager'
import { taskManager } from '../tasks/manager'
import { chatManager } from '../chat/manager'
import { fileSystemManager } from '../filesystem/manager'
import { resolveTaskOrder, DependencyError } from '../utils/task-resolver'
import { resolveTitleDependencies } from '../utils/resolve-title-deps'
import { OrchestratorError, FileSystemError } from '../core/errors'
import { createLogger } from '../core/logger'

export type { WorkflowError, FailedTask, WorkflowStats, WorkflowResult } from '../core/types'

export class Orchestrator extends BaseOrchestrator {
  private projectId: string
  private readonly log = createLogger('orchestrator')

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
          this.log.error('Dependency resolution failed', { error: depError.message })
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

      for (const task of sortedTasks) {
        const unresolvedDep = task.dependencies.find(
          (dep) => subTaskIds.includes(dep) && !completedTaskIds.has(dep),
        )
        if (unresolvedDep) {
          this.log.warn('Skipping task: dependency not completed', { taskId: task.id, dependency: unresolvedDep })
          this.logWarn('Task skipped due to unmet dependency', { taskId: task.id, dependency: unresolvedDep })
          this.obs.perf.increment('orchestrator.tasks.failed')
          this.getEventBus().emit({
            type: 'task:skipped',
            taskId: task.id,
            data: { dependency: unresolvedDep, reason: 'Dependency not completed' },
          })
          continue
        }

        try {
          cb.updateTaskStatus(task.id, 'in_progress')

          if (task.assignedTo === 'dev') {
            this.logInfo('Task execution started', { taskId: task.id, role: 'dev' })
            this.getEventBus().emit({
              type: 'task:started',
              agentRole: 'dev',
              taskId: task.id,
            })

            const devResponse = await this.executeAgentWithRetry('dev', task, cb)

            if (!devResponse) {
              this.recordFailedTask(task, 'Dev task failed after all retries')
              this.obs.perf.increment('orchestrator.tasks.failed')
              this.logError('Task execution completed', { taskId: task.id, success: false, reason: 'Dev task failed' })
              this.getEventBus().emit({
                type: 'task:failed',
                agentRole: 'dev',
                taskId: task.id,
                data: { reason: 'Dev task failed after all retries' },
              })
              continue
            }

            cb.broadcast('dev', devResponse.message)

            if (devResponse.files) {
              for (const file of devResponse.files) {
                try {
                  await cb.saveFile?.(file.path, file.content)
                  console.log(`Saved file: ${file.path}`)
                  this.log.info('File saved', { path: file.path })
                  this.logInfo('File saved', { path: file.path })
                } catch (error) {
                  this.log.error('Failed to save file', { path: file.path, error: error instanceof Error ? error.message : String(error) })
                  this.logError('File save failed', { path: file.path, error: error instanceof Error ? error.message : String(error) })
                  const fsErr = error instanceof Error
                    ? new FileSystemError(error.message, file.path)
                    : new FileSystemError(String(error), file.path)
                  this.obs.errors.track(fsErr)
                  this.getEventBus().emit({
                    type: 'error:tracked',
                    agentRole: 'dev',
                    taskId: task.id,
                    data: { level: 'error', message: 'File save failed', path: file.path, error: error instanceof Error ? error.message : String(error) },
                  })
                }
              }
              allFiles.push(...devResponse.files)
            }

            cb.updateTaskStatus(task.id, 'review')

            const reviewResponse = await this.executeAgentWithRetry('review', task, cb)

            if (!reviewResponse) {
              this.recordFailedTask(task, 'Review task failed after all retries')
              this.obs.perf.increment('orchestrator.tasks.failed')
              this.logError('Task execution completed', { taskId: task.id, success: false, reason: 'Review task failed' })
              this.getEventBus().emit({
                type: 'task:failed',
                agentRole: 'review',
                taskId: task.id,
                data: { reason: 'Review task failed after all retries' },
              })
              continue
            }

            cb.broadcast('review', reviewResponse.message)

            if (reviewResponse.status === 'success') {
              cb.updateTaskStatus(task.id, 'done')
              completedTaskIds.add(task.id)
              this.obs.perf.increment('orchestrator.tasks.completed')
              this.logInfo('Task execution completed', { taskId: task.id, success: true })
              this.getEventBus().emit({
                type: 'task:completed',
                agentRole: 'review',
                taskId: task.id,
              })
            } else {
              cb.updateTaskStatus(task.id, 'pending')
              this.logInfo('Task execution completed', { taskId: task.id, success: false, reason: 'Review not approved' })
            }
          }
        } catch (error) {
          this.log.error('Unexpected error in task', { taskId: task.id, error: error instanceof Error ? error.message : 'Unknown error' })
          this.recordFailedTask(task, error instanceof Error ? error.message : 'Unknown error')
          this.obs.perf.increment('orchestrator.tasks.failed')
          this.obs.errors.track(error instanceof Error ? error : new Error(String(error)))
          this.logError('Task execution completed', { taskId: task.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
          this.getEventBus().emit({
            type: 'task:failed',
            taskId: task.id,
            data: { error: error instanceof Error ? error.message : 'Unknown error' },
          })
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
      this.log.error('Fatal error in executeUserRequest', { error: error instanceof Error ? error.message : 'Unknown error' })
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
