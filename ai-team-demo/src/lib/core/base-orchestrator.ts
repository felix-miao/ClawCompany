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

export abstract class BaseOrchestrator {
  protected retryConfig: RetryConfig
  protected totalRetries: number = 0
  protected failedTasks: FailedTask[] = []
  protected startTime: number = 0

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  }

  protected abstract getCallbacks(): OrchestratorCallbacks

  abstract executeUserRequest(userMessage: string): Promise<WorkflowResult>

  protected async executeAgentWithRetry(
    role: AgentRole,
    task: Task,
    callbacks: OrchestratorCallbacks
  ): Promise<AgentResponse | null> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const context = this.buildContext(callbacks)
        return await callbacks.executeAgent(role, task, context)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
            this.retryConfig.maxDelay
          )

          console.warn(
            `[Orchestrator] Retry ${attempt + 1}/${this.retryConfig.maxRetries} for ${role} agent after ${delay}ms:`,
            lastError.message
          )

          this.totalRetries++
          await this.sleep(delay)
        } else {
          console.error(
            `[Orchestrator] All ${this.retryConfig.maxRetries} retries failed for ${role} agent:`,
            lastError.message
          )
        }
      }
    }

    return null
  }

  protected buildContext(callbacks: OrchestratorCallbacks): AgentContext {
    return {
      projectId: 'default',
      tasks: callbacks.getAllTasks(),
      files: {},
      chatHistory: [],
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

  protected buildWorkflowStats(totalTasks: number, callbacks: OrchestratorCallbacks): WorkflowStats {
    return {
      totalTasks,
      successfulTasks: totalTasks - this.failedTasks.length,
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
