import { BaseOrchestrator, OrchestratorCallbacks, ObservabilityConfig } from '../core/base-orchestrator'
import { WorkflowResult, Task, RetryConfig, FileChange } from '../core/types'
import { TaskQueue, TaskQueueOptions } from '../core/task-queue'
import { agentManager } from '../agents/manager'
import { taskManager } from '../tasks/manager'
import { chatManager } from '../chat/manager'
import { fileSystemManager } from '../filesystem/manager'
import { SandboxedFileWriter } from '../security/sandbox'
import { resolveTaskGraph, DependencyError } from '../utils/task-resolver'
import { resolveTitleDependencies } from '../utils/resolve-title-deps'
import { OrchestratorError, FileSystemError } from '../core/errors'
import { SubTaskSchema } from '../agents/schemas'

export type { WorkflowError, FailedTask, WorkflowStats, WorkflowResult } from '../core/types'

interface ValidatedSubTask {
  title: string
  description: string
  assignedTo: 'dev' | 'review'
  dependencies: string[]
  files?: string[]
}

export function validateSubTasks(rawTasks: unknown): ValidatedSubTask[] {
  if (!Array.isArray(rawTasks)) return []

  const validTasks: ValidatedSubTask[] = []

  for (let i = 0; i < rawTasks.length; i++) {
    const raw = rawTasks[i]
    if (raw === null || raw === undefined || typeof raw !== 'object') {
      console.warn(
        '[Orchestrator]',
        'SubTask validation failed',
        { index: i, reason: `Expected object, got ${raw === null ? 'null' : typeof raw}` },
      )
      continue
    }

    const parsed = SubTaskSchema.safeParse(raw)
    if (parsed.success) {
      const data = parsed.data
      const files = Array.isArray((raw as Record<string, unknown>).files)
        ? ((raw as Record<string, unknown>).files as string[])
        : []
      validTasks.push({ ...data, files })
    } else {
      const reason = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      console.warn(
        '[Orchestrator]',
        'SubTask validation failed',
        { index: i, reason, raw: typeof raw === 'object' ? Object.keys(raw as object) : undefined },
      )
    }
  }

  return validTasks
}

export interface OrchestratorTaskQueueOptions extends TaskQueueOptions {}

export class Orchestrator extends BaseOrchestrator {
  private projectId: string
  private sandboxedWriter: SandboxedFileWriter
  private taskQueue: TaskQueue

  constructor(
    projectId: string = 'default',
    retryConfig?: Partial<RetryConfig>,
    observability?: ObservabilityConfig,
    taskQueueOptions?: OrchestratorTaskQueueOptions,
  ) {
    super(retryConfig, observability)
    this.projectId = projectId
    this.sandboxedWriter = new SandboxedFileWriter(process.cwd())
    this.taskQueue = new TaskQueue({
      concurrency: taskQueueOptions?.concurrency ?? 3,
      defaultTimeout: taskQueueOptions?.defaultTimeout,
    })
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
      saveFile: async (filePath, content) => {
        const result = await this.sandboxedWriter.writeFile(filePath, content)
        if (result.success) {
          if (result.warnings && result.warnings.length > 0) {
            console.warn('[Sandbox] Warnings for', filePath, ':', result.warnings)
          }
          return
        }
        await fileSystemManager.createFile(filePath, content)
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

      const validatedTasks = validateSubTasks(pmResponse.tasks)
      const subTasks: Task[] = []
      for (const taskData of validatedTasks) {
        const task = cb.createTask(
          taskData.title,
          taskData.description,
          taskData.assignedTo,
          taskData.dependencies,
          taskData.files ?? [],
        )
        subTasks.push(task)
      }

      const subTaskIds = subTasks.map((t) => t.id)

      const allFiles: WorkflowResult['files'] = []
      const completedTaskIds = new Set<string>()

      const resolvedSubTasks = resolveTitleDependencies(subTasks)

      let sortedTasks: Task[]
      let taskLevels: string[][]
      try {
        const graph = resolveTaskGraph(resolvedSubTasks)
        sortedTasks = graph.sorted
        taskLevels = graph.levels
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

      for (const levelTaskIds of taskLevels) {
        const levelTasks = levelTaskIds
          .map((id) => sortedTasks.find((t) => t.id === id))
          .filter((t): t is Task => t !== undefined)

        const taskPromises = levelTasks.map((task) =>
          this.taskQueue.add(async () => {
            await this.executeSingleTask(task, cb, subTaskIds, completedTaskIds, allFiles)
          })
        )

        const levelResults = await Promise.allSettled(taskPromises)

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

  abortWorkflow(): void {
    this.taskQueue.abort()
  }

  getTaskQueueStats() {
    return this.taskQueue.getStats()
  }
}

export const orchestrator = new Orchestrator()
