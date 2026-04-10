import {
  AgentRole,
  Task,
  AgentContext,
  WorkflowResult,
  WorkflowError,
  FailedTask,
  WorkflowStats,
  RetryConfig,
  AgentResponse,
  FileChange,
} from './types'
import { Logger, LogEntry } from './logger'
import { PerformanceMonitor } from './performance-monitor'
import { ErrorTracker, ErrorSummary } from './error-tracker'
import { OrchestratorError, AppError, isAppError, FileSystemError, ErrorCategory } from './errors'
import { AgentEventBus, AgentEventType } from './agent-event-bus'
import { UnifiedRetry } from './unified-retry'

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

export interface OrchestratorCallbacks {
  sendUserMessage: (message: string) => void
  broadcast: (agent: AgentRole, message: string) => void
  createTask: (title: string, description: string, assignedTo: AgentRole, deps: string[], files: string[]) => Task
  getTask: (id: string) => Task | undefined
  updateTaskStatus: (id: string, status: Task['status']) => void
  getAllTasks: () => Task[]
  getChatHistory: () => Array<{ agent: AgentRole | 'user'; content: string; timestamp?: Date }>
  executeAgent: (role: AgentRole, task: Task, context: AgentContext) => Promise<AgentResponse>
  readFile?: (path: string) => Promise<string | null>
  saveFile?: (path: string, content: string) => Promise<void>
  clearAll?: () => void
}

export interface ObservabilityConfig {
  logger?: Logger
  performanceMonitor?: PerformanceMonitor
  errorTracker?: ErrorTracker
  eventBus?: AgentEventBus
}

export interface ObservabilitySnapshot {
  performance: ReturnType<PerformanceMonitor['snapshot']>
  errorSummary: ErrorSummary
  logCount: number
}

export abstract class BaseOrchestrator {
  protected retry: UnifiedRetry
  protected totalRetries: number = 0
  protected failedTasks: FailedTask[] = []
  protected startTime: number = 0
  protected obs: {
    logger: Logger | null
    perf: PerformanceMonitor
    errors: ErrorTracker
    eventBus: AgentEventBus
  }
  protected logCount: number = 0
  private capturedLogs: LogEntry[] = []

  constructor(retryConfig?: Partial<RetryConfig>, observability?: ObservabilityConfig) {
    this.retry = new UnifiedRetry({
      maxRetries: retryConfig?.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
      initialDelay: retryConfig?.initialDelay ?? DEFAULT_RETRY_CONFIG.initialDelay,
      maxDelay: retryConfig?.maxDelay ?? DEFAULT_RETRY_CONFIG.maxDelay,
      backoffMultiplier: retryConfig?.backoffMultiplier ?? DEFAULT_RETRY_CONFIG.backoffMultiplier,
    })
    this.obs = {
      logger: observability?.logger ?? null,
      perf: observability?.performanceMonitor ?? new PerformanceMonitor(),
      errors: observability?.errorTracker ?? new ErrorTracker(),
      eventBus: observability?.eventBus ?? new AgentEventBus(),
    }
  }

  protected abstract getCallbacks(): OrchestratorCallbacks

  abstract executeUserRequest(userMessage: string): Promise<WorkflowResult>

  protected logInfo(message: string, context?: Record<string, unknown>): void {
    this.logCount++
    this.obs.logger?.info(message, context)
  }

  protected logWarn(message: string, context?: Record<string, unknown>): void {
    this.logCount++
    this.obs.logger?.warn(message, context)
    this.obs.eventBus.emit({
      type: 'error:tracked',
      data: { level: 'warn', message, ...context },
    })
  }

  protected logError(message: string, context?: Record<string, unknown>): void {
    this.logCount++
    this.obs.logger?.error(message, context)
    this.obs.eventBus.emit({
      type: 'error:tracked',
      data: { level: 'error', message, ...context },
    })
  }

  protected async executeAgentWithRetry(
    role: AgentRole,
    task: Task,
    callbacks: OrchestratorCallbacks
  ): Promise<AgentResponse | null> {
    // Build context once outside retry loop to avoid N+1 file reads (P2 fix)
    const context = await this.buildContext(callbacks)
    return this.executeAgentWithContext(role, task, callbacks, context)
  }

  protected async executeAgentWithContext(
    role: AgentRole,
    task: Task,
    callbacks: OrchestratorCallbacks,
    context: AgentContext,
  ): Promise<AgentResponse | null> {
    const result = await this.retry.execute(
      async () => {
        const timerId = this.obs.perf.startTimer(`agent.${role}`)
        try {
          return await callbacks.executeAgent(role, task, context)
        } finally {
          this.obs.perf.stopTimer(timerId)
        }
      },
      {
        onRetry: (error, attempt, delay) => {
          this.logWarn('Agent execution retry', {
            role,
            attempt,
            delay,
            error: error.message,
          })

          this.obs.eventBus.emit({
            type: 'agent:retrying',
            agentRole: role,
            taskId: task.id,
            data: {
              attempt,
              delay,
              error: error.message,
            },
          })

          this.obs.perf.increment('orchestrator.retries')
          this.totalRetries++
        },
        onExhausted: (error) => {
          this.logError('Agent retries exhausted', {
            role,
            error: error.message,
          })

          this.obs.eventBus.emit({
            type: 'agent:failed',
            agentRole: role,
            taskId: task.id,
            data: {
              error: error.message,
            },
          })

          this.obs.errors.track(isAppError(error) && error.category !== ErrorCategory.SYSTEM ? error : new OrchestratorError(error.message, { cause: error }))
        },
      }
    )

    if (result.success) {
      return result.result as AgentResponse
    }

    return null
  }

  protected async buildContext(callbacks: OrchestratorCallbacks): Promise<AgentContext> {
    const tasks = callbacks.getAllTasks()
    const files: Record<string, string> = {}
    for (const task of tasks) {
      for (const filePath of task.files) {
        if (files[filePath] !== undefined) continue
        if (callbacks.readFile) {
          try {
            const content = await callbacks.readFile(filePath)
            files[filePath] = content ?? ''
          } catch {
            files[filePath] = ''
          }
        } else {
          files[filePath] = ''
        }
      }
    }

    return {
      projectId: 'default',
      tasks,
      files,
      chatHistory: callbacks.getChatHistory(),
    }
  }

  protected recordFailedTask(task: Task, errorMessage: string): void {
    this.failedTasks.push({
      taskId: task.id,
      taskTitle: task.title,
      error: errorMessage,
      retryCount: 0,
      timestamp: new Date(),
    })
  }

  getObservability(): ObservabilitySnapshot {
    return {
      performance: this.obs.perf.snapshot(),
      errorSummary: this.obs.errors.getSummary(),
      logCount: this.logCount,
    }
  }

  getEventBus(): AgentEventBus {
    return this.obs.eventBus
  }

  resetObservability(): void {
    this.obs.perf.reset()
    this.obs.errors.clear()
    this.obs.eventBus.clear()
    this.logCount = 0
  }

  protected createErrorResponse(
    errorMessage: string,
    callbacks: OrchestratorCallbacks,
    taskId?: string
  ): WorkflowResult {
    return {
      success: false,
      messages: callbacks.getChatHistory().map(m => ({
        agent: m.agent,
        content: m.content,
      })),
      tasks: callbacks.getAllTasks(),
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

  protected buildWorkflowStats(totalTasks: number, callbacks: OrchestratorCallbacks, completedCount?: number): WorkflowStats {
    return {
      totalTasks,
      successfulTasks: completedCount ?? totalTasks - this.failedTasks.length,
      failedTasks: this.failedTasks.length,
      totalRetries: this.totalRetries,
      executionTime: Date.now() - this.startTime,
    }
  }

  protected buildMessages(callbacks: OrchestratorCallbacks): Array<{ agent: AgentRole | 'user'; content: string; timestamp?: Date }> {
    return callbacks.getChatHistory().map(m => ({
      agent: m.agent,
      content: m.content,
      timestamp: m.timestamp,
    }))
  }

  protected emitWorkflowStarted(data: Record<string, unknown>): void {
    this.getEventBus().emit({
      type: 'workflow:started',
      data,
    })
  }

  protected emitWorkflowCompleted(data: Record<string, unknown>): void {
    this.getEventBus().emit({
      type: 'workflow:completed',
      data,
    })
  }

  protected emitWorkflowFailed(data: Record<string, unknown>): void {
    this.getEventBus().emit({
      type: 'workflow:failed',
      data,
    })
  }

  protected async executeSingleTask(
    task: Task,
    cb: OrchestratorCallbacks,
    subTaskIds: string[],
    completedTaskIds: Set<string>,
    allFiles: FileChange[],
  ): Promise<void> {
    if (this.checkUnresolvedDependency(task, subTaskIds, completedTaskIds)) return

    try {
      cb.updateTaskStatus(task.id, 'in_progress')

      if (task.assignedTo === 'dev') {
        await this.executeDevWorkflow(task, cb, completedTaskIds, allFiles)
      } else if (task.assignedTo === 'pm' || task.assignedTo === 'review' || task.assignedTo === 'tester') {
        await this.executeAgentWorkflow(task, cb, task.assignedTo, completedTaskIds)
      } else {
        this.logWarn('Unknown agent role, treating as generic agent', { taskId: task.id, role: task.assignedTo })
        await this.executeAgentWorkflow(task, cb, task.assignedTo as AgentRole, completedTaskIds)
      }
    } catch (error) {
      this.handleTaskError(task, error)
    }
  }

  private checkUnresolvedDependency(
    task: Task,
    subTaskIds: string[],
    completedTaskIds: Set<string>,
  ): boolean {
    const unresolvedDep = task.dependencies.find(
      (dep) => subTaskIds.includes(dep) && !completedTaskIds.has(dep),
    )
    if (!unresolvedDep) return false

    this.logWarn('Skipping task: dependency not completed', { taskId: task.id, dependency: unresolvedDep })
    this.recordFailedTask(task, `Dependency not completed: ${unresolvedDep}`)
    this.obs.perf.increment('orchestrator.tasks.failed')
    this.getEventBus().emit({
      type: 'task:skipped',
      taskId: task.id,
      data: { dependency: unresolvedDep, reason: 'Dependency not completed' },
    })
    return true
  }

  private async executeDevWorkflow(
    task: Task,
    cb: OrchestratorCallbacks,
    completedTaskIds: Set<string>,
    allFiles: FileChange[],
  ): Promise<void> {
    const MAX_ITERATIONS = 3
    let iteration = 0
    let context = await this.buildContext(cb)

    while (iteration < MAX_ITERATIONS) {
      const devResponse = await this.runAgentForTaskWithContext(task, cb, 'dev', context)
      if (!devResponse) {
        this.markTaskFailed(task, cb, 'dev', 'Dev agent returned null response')
        return
      }

      await this.saveResponseFiles(task, cb, devResponse.files, allFiles)
      task.files = allFiles.map(f => f.path)

      cb.updateTaskStatus(task.id, 'review')

      // Rebuild context so review can see newly saved files
      const reviewContext = await this.buildContext(cb)
      const reviewResponse = await this.runAgentForTaskWithContext(task, cb, 'review', reviewContext)
      if (!reviewResponse) {
        this.markTaskFailed(task, cb, 'review', 'Review agent returned null response')
        return
      }

      cb.broadcast('review', reviewResponse.message)

      if (reviewResponse.status === 'success') {
        this.markTaskCompleted(task, cb, completedTaskIds, 'review')
        return
      }

      // Review not approved — check if we should iterate
      iteration++
      if (iteration >= MAX_ITERATIONS) {
        this.markTaskFailed(task, cb, 'review', `Review not approved after ${MAX_ITERATIONS} iterations`)
        return
      }

      // Pass review feedback into the next dev iteration
      this.logInfo('Review not approved, retrying dev with feedback', {
        taskId: task.id,
        iteration,
        feedback: reviewResponse.message.slice(0, 200),
      })
      context = { ...reviewContext, reviewFeedback: reviewResponse.message }
      cb.updateTaskStatus(task.id, 'in_progress')
    }
  }

  private async executeAgentWorkflow(
    task: Task,
    cb: OrchestratorCallbacks,
    role: AgentRole,
    completedTaskIds: Set<string>,
  ): Promise<void> {
    const response = await this.runAgentForTask(task, cb, role)
    if (!response) return

    if (response.status === 'success') {
      cb.updateTaskStatus(task.id, 'review')
      this.markTaskCompleted(task, cb, completedTaskIds, role)
    } else {
      this.markTaskFailed(task, cb, role, `${role} returned non-success`)
    }
  }

  private markTaskFailed(
    task: Task,
    cb: OrchestratorCallbacks,
    role: AgentRole,
    reason: string,
  ): void {
    cb.updateTaskStatus(task.id, 'failed')
    this.recordFailedTask(task, reason)
    this.obs.perf.increment('orchestrator.tasks.failed')
    this.obs.errors.track(new OrchestratorError(reason, { taskId: task.id, role }))
    this.logWarn('Task execution failed', { taskId: task.id, success: false, reason })
    this.getEventBus().emit({
      type: 'task:failed',
      agentRole: role,
      taskId: task.id,
      data: { reason },
    })
  }

  protected async runAgentForTask(
    task: Task,
    cb: OrchestratorCallbacks,
    role: AgentRole,
  ): Promise<AgentResponse | null> {
    this.emitTaskStarted(task, role)
    const response = await this.executeAgentWithRetry(role, task, cb)

    if (!response) {
      this.emitTaskFailed(task, role, `${role} task failed after all retries`)
      return null
    }

    cb.broadcast(role, response.message)
    return response
  }

  protected async runAgentForTaskWithContext(
    task: Task,
    cb: OrchestratorCallbacks,
    role: AgentRole,
    context: AgentContext,
  ): Promise<AgentResponse | null> {
    this.emitTaskStarted(task, role)
    const response = await this.executeAgentWithContext(role, task, cb, context)

    if (!response) {
      this.emitTaskFailed(task, role, `${role} task failed after all retries`)
      return null
    }

    cb.broadcast(role, response.message)
    return response
  }

  protected emitTaskStarted(task: Task, role: AgentRole): void {
    this.logInfo('Task execution started', { taskId: task.id, role })
    this.getEventBus().emit({
      type: 'task:started',
      agentRole: role,
      taskId: task.id,
    })
  }

  protected emitTaskFailed(task: Task, role: AgentRole, reason: string): void {
    this.recordFailedTask(task, reason)
    this.obs.perf.increment('orchestrator.tasks.failed')
    this.logError('Task execution completed', { taskId: task.id, success: false, reason: `${role} task failed` })
    this.getEventBus().emit({
      type: 'task:failed',
      agentRole: role,
      taskId: task.id,
      data: { reason },
    })
  }

  protected markTaskCompleted(
    task: Task,
    cb: OrchestratorCallbacks,
    completedTaskIds: Set<string>,
    role: AgentRole,
  ): void {
    cb.updateTaskStatus(task.id, 'completed')
    completedTaskIds.add(task.id)
    this.obs.perf.increment('orchestrator.tasks.completed')
    this.logInfo('Task execution completed', { taskId: task.id, success: true })
    this.getEventBus().emit({
      type: 'task:completed',
      agentRole: role,
      taskId: task.id,
    })
  }

  private async saveResponseFiles(
    task: Task,
    cb: OrchestratorCallbacks,
    files: FileChange[] | undefined,
    allFiles: FileChange[],
  ): Promise<void> {
    if (!files || files.length === 0) return

    for (const file of files) {
      try {
        await cb.saveFile?.(file.path, file.content)
        this.logInfo('File saved', { path: file.path })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        this.logError('File save failed', { path: file.path, error: errMsg })
        this.obs.errors.track(
          error instanceof Error
            ? new FileSystemError(error.message, file.path)
            : new FileSystemError(String(error), file.path),
        )
        this.getEventBus().emit({
          type: 'error:tracked',
          agentRole: 'dev',
          taskId: task.id,
          data: { level: 'error', message: 'File save failed', path: file.path, error: errMsg },
        })
      }
    }
    allFiles.push(...files)
  }

  private handleTaskError(task: Task, error: unknown): void {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    this.logError('Unexpected error in task', { taskId: task.id, error: errMsg })
    this.recordFailedTask(task, errMsg)
    this.obs.perf.increment('orchestrator.tasks.failed')
    this.obs.errors.track(error instanceof Error ? error : new Error(String(error)))
    this.logError('Task execution completed', { taskId: task.id, success: false, error: errMsg })
    this.getEventBus().emit({
      type: 'task:failed',
      taskId: task.id,
      data: { error: errMsg },
    })
  }

  reset(): void {
    this.totalRetries = 0
    this.failedTasks = []
    const cb = this.getCallbacks()
    cb.clearAll?.()
  }
}
