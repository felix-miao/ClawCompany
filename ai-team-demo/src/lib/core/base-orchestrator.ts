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
} from './types'
import { Logger, LogEntry } from './logger'
import { PerformanceMonitor } from './performance-monitor'
import { ErrorTracker, ErrorSummary } from './error-tracker'
import { OrchestratorError, AppError, isAppError } from './errors'
import { AgentEventBus, AgentEventType } from './agent-event-bus'

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

export interface OrchestratorCallbacks {
  sendUserMessage: (message: string) => void
  broadcast: (agent: AgentRole, message: string) => void
  createTask: (title: string, description: string, assignedTo: AgentRole | 'dev', deps: string[], files: string[]) => Task
  getTask: (id: string) => Task | undefined
  updateTaskStatus: (id: string, status: Task['status']) => void
  getAllTasks: () => Task[]
  getChatHistory: () => Array<{ agent: AgentRole | 'user'; content: string; timestamp?: Date }>
  executeAgent: (role: AgentRole, task: Task, context: AgentContext) => Promise<AgentResponse>
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
  protected retryConfig: RetryConfig
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
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
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
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      const timerId = this.obs.perf.startTimer(`agent.${role}`)
      try {
        const context = this.buildContext(callbacks)
        const result = await callbacks.executeAgent(role, task, context)
        this.obs.perf.stopTimer(timerId)
        this.obs.perf.recordValue(`orchestrator.agent.${role}.duration`, this.obs.perf.getMetricEntries(`agent.${role}`).length > 0 ? Date.now() - this.startTime : 0)
        return result
      } catch (error) {
        this.obs.perf.stopTimer(timerId)
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
            this.retryConfig.maxDelay
          )

          this.logWarn('Agent execution retry', {
            role,
            attempt: attempt + 1,
            maxRetries: this.retryConfig.maxRetries,
            delay,
            error: lastError.message,
          })

          this.obs.eventBus.emit({
            type: 'agent:retrying',
            agentRole: role,
            taskId: task.id,
            data: {
              attempt: attempt + 1,
              maxRetries: this.retryConfig.maxRetries,
              delay,
              error: lastError.message,
            },
          })

          this.obs.perf.increment('orchestrator.retries')
          this.totalRetries++
          await this.sleep(delay)
        } else {
          this.logError('Agent retries exhausted', {
            role,
            maxRetries: this.retryConfig.maxRetries,
            error: lastError.message,
          })

          this.obs.eventBus.emit({
            type: 'agent:failed',
            agentRole: role,
            taskId: task.id,
            data: {
              maxRetries: this.retryConfig.maxRetries,
              error: lastError.message,
            },
          })

          this.obs.errors.track(isAppError(lastError) ? lastError : new OrchestratorError(lastError.message, { cause: lastError }))
        }
      }
    }

    return null
  }

  protected buildContext(callbacks: OrchestratorCallbacks): AgentContext {
    const tasks = callbacks.getAllTasks()
    const files: Record<string, string> = {}
    for (const task of tasks) {
      for (const filePath of task.files) {
        files[filePath] = ''
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
      retryCount: this.retryConfig.maxRetries,
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

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  reset(): void {
    this.totalRetries = 0
    this.failedTasks = []
    const cb = this.getCallbacks()
    cb.clearAll?.()
  }
}
