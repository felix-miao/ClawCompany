import { BaseOrchestrator, OrchestratorCallbacks, ObservabilityConfig } from '../core/base-orchestrator'
import { WorkflowResult, Task, RetryConfig } from '../core/types'
import { TaskQueue, TaskQueueOptions } from '../core/task-queue'
import { AgentManager } from '../agents/manager'
import { TaskManager } from '../tasks/manager'
import { ChatManager } from '../chat/manager'
import { SandboxedFileWriter } from '../security/sandbox'
import { resolveTaskGraph, DependencyError } from '../utils/task-resolver'
import { resolveTitleDependencies } from '../utils/resolve-title-deps'
import { OrchestratorError, FileSystemError } from '../core/errors'
import { SubTaskSchema } from '../agents/schemas'
import { UnifiedRetry } from '../core/unified-retry'
import { getGameEventStore } from '@/game/data/GameEventStore'

export type { WorkflowError, FailedTask, WorkflowStats, WorkflowResult } from '../core/types'
export { UnifiedRetry } from '../core/unified-retry'
export type { UnifiedRetryConfig, RetryExecutorOptions, RetryResult } from '../core/unified-retry'

interface ValidatedSubTask {
  title: string
  description: string
  assignedTo: 'dev' | 'review' | 'tester'
  dependencies: string[]
  files?: string[]
}

export function validateSubTasks(rawTasks: unknown): ValidatedSubTask[] {
  if (!Array.isArray(rawTasks)) return []

  const validTasks: ValidatedSubTask[] = []

  for (let i = 0; i < rawTasks.length; i++) {
    const raw = rawTasks[i]
    if (raw === null || raw === undefined || typeof raw !== 'object') {
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
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

export interface OrchestratorDependencies {
  agentManager: AgentManager
  taskManager: TaskManager
  chatManager: ChatManager
  sandboxedWriter: SandboxedFileWriter
}

export function createDefaultDependencies(sandboxedWriter: SandboxedFileWriter): OrchestratorDependencies {
  return {
    agentManager: new AgentManager(),
    taskManager: new TaskManager(),
    chatManager: new ChatManager(),
    sandboxedWriter,
  }
}

export class Orchestrator extends BaseOrchestrator {
  private projectId: string
  private sandboxedWriter: SandboxedFileWriter
  private taskQueue: TaskQueue
  private deps: OrchestratorDependencies
  private currentPMAnalysis: string = ''

  constructor(
    projectId: string = 'default',
    retryConfig?: Partial<RetryConfig>,
    observability?: ObservabilityConfig,
    taskQueueOptions?: OrchestratorTaskQueueOptions,
    deps?: OrchestratorDependencies,
  ) {
    super(retryConfig, observability)
    this.projectId = projectId
    this.sandboxedWriter = deps?.sandboxedWriter ?? new SandboxedFileWriter(process.cwd())
    this.deps = deps ?? createDefaultDependencies(this.sandboxedWriter)
    this.taskQueue = new TaskQueue({
      concurrency: taskQueueOptions?.concurrency ?? 3,
      defaultTimeout: taskQueueOptions?.defaultTimeout,
    })
  }

  getObservability() {
    return super.getObservability()
  }

  protected override async buildContext(callbacks: OrchestratorCallbacks) {
    const context = await super.buildContext(callbacks)
    if (this.currentPMAnalysis) {
      return { ...context, pmAnalysis: this.currentPMAnalysis }
    }
    return context
  }

  resetObservability() {
    super.resetObservability()
  }

  protected getCallbacks(): OrchestratorCallbacks {
    const { agentManager, taskManager, chatManager } = this.deps
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
        if (!result.success) {
          throw new FileSystemError(
            result.error ?? 'Sandbox blocked file write',
            filePath,
          )
        }
        if (result.warnings && result.warnings.length > 0) {
          // eslint-disable-next-line no-console
          console.warn('[Sandbox] Warnings for', filePath, ':', result.warnings)
        }
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
    this.currentPMAnalysis = ''

    const cb = this.getCallbacks()

    this.logInfo('Workflow started', { userMessage })
    this.emitWorkflowStarted({ userMessage })

    try {
      cb.sendUserMessage(userMessage)

      const initialTask = cb.createTask(userMessage, userMessage, 'pm', [], [])

      const pmResponse = await this.runAgentForTask(initialTask, cb, 'pm')
      if (!pmResponse) {
        this.emitWorkflowFailed({ reason: 'PM task failed after all retries' })
        return this.createErrorResponse('PM task failed after all retries', cb, initialTask.id)
      }
      // Capture PM analysis for injection into dev context (Fix 3)
      this.currentPMAnalysis = (pmResponse.metadata?.pmAnalysis as string) || ''
      const pmCompletedIds = new Set<string>()
      this.markTaskCompleted(initialTask, cb, pmCompletedIds, 'pm')

      const validatedTasks = validateSubTasks(pmResponse.tasks)

      // Emit pm:analysis-complete after PM generates task list
      getGameEventStore().push({
        type: 'pm:analysis-complete',
        agentId: 'pm-agent',
        timestamp: Date.now(),
        payload: {
          projectId: this.projectId,
          taskCount: validatedTasks.length,
          analysis: this.currentPMAnalysis,
        },
      })

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
          this.emitWorkflowFailed({ reason: 'Dependency resolution failed', error: depError.message })
          return this.createErrorResponse(depError.message, cb)
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
      this.emitWorkflowCompleted({ success: hasSuccess, completed: completedTaskIds.size, total: subTaskIds.length, failed: this.failedTasks.length })
      return {
        success: hasSuccess,
        messages: this.buildMessages(cb),
        tasks: cb.getAllTasks(),
        files: allFiles,
        failedTasks: this.failedTasks.length > 0 ? this.failedTasks : undefined,
        stats: this.buildWorkflowStats(subTaskIds.length, cb, completedTaskIds.size),
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      this.logError('Fatal error in executeUserRequest', { error: errMsg })
      this.obs.errors.track(error instanceof Error ? error : new Error(String(error)))
      this.emitWorkflowFailed({ error: errMsg })
      return this.createErrorResponse(errMsg, cb)
    }
  }

  getStatus() {
    return {
      projectId: this.projectId,
      tasks: this.deps.taskManager.getAllTasks(),
      messages: this.deps.chatManager.getHistory(),
      stats: this.deps.taskManager.getStats(),
    }
  }

  abortWorkflow(): void {
    this.taskQueue.abort()
  }

  getTaskQueueStats() {
    return this.taskQueue.getStats()
  }
}

export function createOrchestrator(deps: OrchestratorDependencies, options?: {
  projectId?: string
  retryConfig?: Partial<RetryConfig>
  observability?: ObservabilityConfig
  taskQueueOptions?: OrchestratorTaskQueueOptions
}): Orchestrator {
  return new Orchestrator(
    options?.projectId ?? 'default',
    options?.retryConfig,
    options?.observability,
    options?.taskQueueOptions,
    deps,
  )
}

/** @deprecated Use DI container via getDefaultContainer().resolve(Services.Orchestrator) instead.
 *  WARNING: This global singleton causes state pollution in concurrent requests.
 *  Do NOT use in production. Will be removed in a future release.
 */
// TODO: Remove this export once all consumers have migrated to DI container
// export const orchestrator = new Orchestrator()
