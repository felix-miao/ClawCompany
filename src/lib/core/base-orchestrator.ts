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
import { compressHistory } from '../chat/compression'
import { FileSnapshotManager } from '../tasks/file-snapshot-manager'
import { WorkingMemory } from '../memory/working-memory'
import { DAGateReason } from '../agents/devil-advocate-agent'
import { Logger, LogEntry } from './logger'
import { PerformanceMonitor } from './performance-monitor'
import { ErrorTracker, ErrorSummary } from './error-tracker'
import { OrchestratorError, AppError, isAppError, FileSystemError, ErrorCategory } from './errors'
import { AgentEventBus, AgentEventType } from './agent-event-bus'
import { UnifiedRetry } from './unified-retry'
import { getGameEventStore } from '@/game/data/GameEventStore'
import { DPScoreStore, buildDPScoreRecord } from '../analytics/dp-score-store'
import { TraceLogger } from '../analytics/trace-logger'
import { CheckpointService } from '../tasks/checkpoint-service'
import { ReviewMemoryStore, buildReviewHistoryContext } from '../tasks/review-memory-store'

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

export interface ReviewPipelineResult {
  reviewResult: AgentResponse
  daResult?: AgentResponse
  arbiterResult?: AgentResponse
  daTriggered: boolean
  daGateReason?: DAGateReason
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
  executeReviewPipeline: (task: Task, context: AgentContext, options?: { forceDA?: boolean; skipDA?: boolean }) => Promise<ReviewPipelineResult>
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
    trace: TraceLogger
  }
  protected logCount: number = 0
  private capturedLogs: LogEntry[] = []
  /** Shadow-git based snapshot manager — lazily initialized per project dir */
  private snapshotManager: FileSnapshotManager | null = null
  /** Working memory — lazily initialized */
  private workingMemory: WorkingMemory | null = null
  /** Review memory (FTS5) — lazily initialized */
  private reviewMemory: ReviewMemoryStore | null = null
  /** Current session ID for memory scoping */
  protected sessionId: string = `session-${Date.now()}`

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
      trace: TraceLogger.getInstance(),
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
    const traceStart = Date.now()
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

    const duration_ms = Date.now() - traceStart
    const agentResp = result.success ? (result.result as AgentResponse) : null
    const usage = agentResp?.metadata?.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined

    // ─── Persist trace event ────────────────────────────────────
    try {
      this.obs.trace.record({
        task_id: task.id,
        agent: role,
        started_at: traceStart,
        duration_ms,
        prompt_tokens: usage?.promptTokens ?? 0,
        completion_tokens: usage?.completionTokens ?? 0,
        total_tokens: usage?.totalTokens ?? 0,
        review_result: agentResp ? agentResp.status : 'error',
        metadata: { taskTitle: task.title, assignedTo: task.assignedTo },
      })
    } catch (traceErr) {
      // Non-fatal: trace write errors must never break the main flow
      this.logWarn('[Trace] Failed to record trace event', {
        taskId: task.id,
        role,
        error: traceErr instanceof Error ? traceErr.message : String(traceErr),
      })
    }
    // ───────────────────────────────────────────────────────────

    if (result.success) {
      return agentResp
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

    // ─── Context Compression ─────────────────────────────────────
    // Compress chat history when it exceeds 20 messages or ~50K tokens
    // to prevent LLM context window overflow in long-running workflows.
    const rawHistory = callbacks.getChatHistory()
    const chatHistory = await compressHistory(rawHistory)
    // ─────────────────────────────────────────────────────────────

    return {
      projectId: 'default',
      tasks,
      files,
      chatHistory,
      ...(this.buildMemoryHints().length > 0 ? { memoryHints: this.buildMemoryHints() } : {}),
    }
  }

  private buildMemoryHints(): string[] {
    try {
      const mem = this.getWorkingMemory()
      if (!mem) return []
      const entries = mem.getTopMemories(this.sessionId, 5)
      return entries.map(e => `[${e.agentRole}/${e.key}]: ${e.value}`)
    } catch {
      return []
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

  // ─── Working Memory helpers ───────────────────────────────────

  private getWorkingMemory(): WorkingMemory | null {
    if (this.workingMemory) return this.workingMemory
    try {
      this.workingMemory = WorkingMemory.getInstance()
      return this.workingMemory
    } catch (err) {
      this.logWarn('[WorkingMemory] Failed to initialize', {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  /** Lazily initialise ReviewMemoryStore (FTS5). Returns null on failure (non-fatal). */
  private getReviewMemory(): ReviewMemoryStore | null {
    if (this.reviewMemory) return this.reviewMemory
    try {
      this.reviewMemory = ReviewMemoryStore.getInstance()
      return this.reviewMemory
    } catch (err) {
      this.logWarn('[ReviewMemory] Failed to initialize', {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  /**
   * Store a memory entry for the current session.
   * Silently no-ops if memory system is unavailable.
   */
  protected rememberFact(
    agentRole: string,
    key: string,
    value: string,
    importance: number = 0.5,
    ttlMs?: number,
  ): void {
    try {
      this.getWorkingMemory()?.remember(this.sessionId, agentRole, key, value, importance, ttlMs)
    } catch (err) {
      this.logWarn('[WorkingMemory] remember failed', { key, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // ─── Snapshot helpers ─────────────────────────────────────────

  /**
   * Lazily initialise the FileSnapshotManager for the current project directory.
   * Silently no-ops if git is unavailable or init fails (snapshots are best-effort).
   */
  private getSnapshotManager(): FileSnapshotManager | null {
    if (this.snapshotManager) return this.snapshotManager
    try {
      const mgr = FileSnapshotManager.forProject(process.cwd())
      mgr.init()
      this.snapshotManager = mgr
      return mgr
    } catch (err) {
      this.logWarn('[FileSnapshot] Failed to initialize snapshot manager', {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  /**
   * Take a snapshot of the working tree. Returns snapshot ID or null on failure.
   */
  protected takeSnapshot(reason: string): string | null {
    try {
      const mgr = this.getSnapshotManager()
      if (!mgr) return null
      const id = mgr.snapshot(reason)
      this.logInfo('[FileSnapshot] Snapshot created', { id, reason })
      return id
    } catch (err) {
      this.logWarn('[FileSnapshot] Snapshot failed', {
        reason,
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  /**
   * Roll back to a previously-captured snapshot. No-ops gracefully on failure.
   */
  protected rollbackToSnapshot(snapshotId: string): void {
    try {
      const mgr = this.getSnapshotManager()
      if (!mgr) return
      mgr.rollback(snapshotId)
      this.logInfo('[FileSnapshot] Rollback complete', { snapshotId })
    } catch (err) {
      this.logWarn('[FileSnapshot] Rollback failed', {
        snapshotId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // ─── Dev workflow ─────────────────────────────────────────────

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
      // ─── Snapshot before dev modifies anything ────────────────
      const snapshotId = this.takeSnapshot(`before dev-agent task-${task.id} iteration-${iteration}`)

      // Emit dev:iteration-start before each dev attempt
      getGameEventStore().push({
        type: 'dev:iteration-start',
        agentId: 'dev-agent',
        timestamp: Date.now(),
        payload: { taskId: task.id, iteration, hasFeedback: !!context.reviewFeedback },
      })

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

      // ─── Inject historical review context (FTS5) ──────────────
      const reviewContextWithHistory = this.buildReviewContextWithHistory(task, reviewContext)
      // ─────────────────────────────────────────────────────────

      // ─── Review Pipeline（含 DA 智能门控）─────────────────────
      let pipelineResult: ReviewPipelineResult
      try {
        pipelineResult = await cb.executeReviewPipeline(task, reviewContextWithHistory)
      } catch {
        this.markTaskFailed(task, cb, 'review', 'Review pipeline threw an error')
        return
      }

      const reviewResponse = pipelineResult.reviewResult
      const arbiterResponse = pipelineResult.arbiterResult
      const daResponse = pipelineResult.daResult

      // Guard against null/undefined review result (edge case: mock/agent returned nothing)
      if (!reviewResponse) {
        this.markTaskFailed(task, cb, 'review', 'Review agent returned null response')
        return
      }

      if (pipelineResult.daTriggered) {
        this.logInfo('DA triggered in review pipeline', {
          taskId: task.id,
          gateReason: pipelineResult.daGateReason,
          daStatus: daResponse?.status,
          arbiterStatus: arbiterResponse?.status,
        })
        if (daResponse) cb.broadcast('devil-advocate', daResponse.message)
        if (arbiterResponse) cb.broadcast('review', arbiterResponse.message)
      }

      // 最终裁决者：Arbiter（若存在）> Review
      const finalResponse = arbiterResponse ?? reviewResponse

      cb.broadcast('review', finalResponse.message)

      // ─── DP Score 持久化（基于 Review score）─────────────────
      this.persistDPScore(task, reviewResponse)
      // ─────────────────────────────────────────────────────────

      // ─── Review Memory 索引（FTS5 跨任务学习）────────────────
      this.indexReviewMemory(task, reviewResponse)
      // ─────────────────────────────────────────────────────────

      // DA FATAL 判定：基本假设错误，不应继续迭代 → 转 HITL
      const daVerdict = (daResponse?.metadata as { daResult?: { verdict?: string } } | undefined)?.daResult?.verdict
      if (daVerdict === 'FATAL') {
        // Rollback files changed by the rejected dev iteration
        if (snapshotId) this.rollbackToSnapshot(snapshotId)
        this.markTaskAwaitingHumanReview(task, cb, 'review', 'DA verdict: FATAL — basic assumptions need human review')
        getGameEventStore().push({
          type: 'workflow:iteration-complete',
          agentId: 'review-agent',
          timestamp: Date.now(),
          payload: { taskId: task.id, totalIterations: iteration + 1, approved: false },
        })
        return
      }

      if (finalResponse.status === 'success') {
        this.markTaskCompleted(task, cb, completedTaskIds, 'review')
        // Emit workflow:iteration-complete on approval
        getGameEventStore().push({
          type: 'workflow:iteration-complete',
          agentId: 'review-agent',
          timestamp: Date.now(),
          payload: { taskId: task.id, totalIterations: iteration + 1, approved: true },
        })
        return
      }

      // Review not approved — check if we should iterate
      iteration++
      if (iteration >= MAX_ITERATIONS) {
        // Rollback the last rejected dev iteration's changes
        if (snapshotId) this.rollbackToSnapshot(snapshotId)
        this.markTaskAwaitingHumanReview(task, cb, 'review', `Review not approved after ${MAX_ITERATIONS} iterations — needs human decision`)
        // Emit workflow:iteration-complete on exhausted retries
        getGameEventStore().push({
          type: 'workflow:iteration-complete',
          agentId: 'review-agent',
          timestamp: Date.now(),
          payload: { taskId: task.id, totalIterations: iteration, approved: false },
        })
        return
      }

      // Review rejected — emit before retrying
      getGameEventStore().push({
        type: 'review:rejected',
        agentId: 'review-agent',
        timestamp: Date.now(),
        payload: { taskId: task.id, iteration, feedback: finalResponse.message ?? '' },
      })

      // ─── Rollback file changes from rejected dev iteration ────
      if (snapshotId) {
        this.rollbackToSnapshot(snapshotId)
      }

      // ─── Remember review feedback for next iteration ──────────
      this.rememberFact(
        'review',
        `last_feedback_task_${task.id}`,
        finalResponse.message.slice(0, 500),
        0.9,  // high importance — directly influences next dev iteration
      )

      // Pass review feedback (from arbiter if available) into the next dev iteration
      this.logInfo('Review not approved, retrying dev with feedback', {
        taskId: task.id,
        iteration,
        feedback: finalResponse.message.slice(0, 200),
      })
      context = { ...reviewContextWithHistory, reviewFeedback: finalResponse.message }
      cb.updateTaskStatus(task.id, 'in_progress')
    }
  }

  /**
   * 将本次 review 的 DP Score 持久化到 SQLite
   * - critic_score: Review Agent 在 metadata.score 中提供的分数（可能为 null）
   * - dpScorePenalty: 默认 1.0（Independence Check 尚未集成进主流程时使用）
   */
  private persistDPScore(task: Task, reviewResponse: AgentResponse): void {
    try {
      const criticScore = typeof reviewResponse.metadata?.score === 'number'
        ? reviewResponse.metadata.score as number
        : 70 // 无明确分数时保守默认值

      const record = buildDPScoreRecord(
        task.id,
        task.assignedTo ?? 'dev',
        criticScore,
        1.0,  // Independence Check 惩罚因子，当前默认 1.0（后续集成 runIndependenceCheck 时替换）
      )

      DPScoreStore.getInstance().save(record)
      this.logInfo('DP Score persisted', {
        taskId: task.id,
        dpScore: record.dp_score,
        criticScore: record.critic_score,
      })
    } catch (err) {
      // 持久化失败不影响主流程
      this.logWarn('Failed to persist DP Score', {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /**
   * Index review results into the FTS5 ReviewMemoryStore for cross-task learning.
   * Non-fatal: failures are logged as warnings.
   */
  private indexReviewMemory(task: Task, reviewResponse: AgentResponse): void {
    try {
      const store = this.getReviewMemory()
      if (!store) return
      const filePaths = task.files ?? []
      store.index(task.id, {
        message: reviewResponse.message,
        metadata: reviewResponse.metadata,
      }, filePaths)
      this.logInfo('[ReviewMemory] Indexed review issues', { taskId: task.id })
    } catch (err) {
      this.logWarn('[ReviewMemory] Failed to index review', {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /**
   * Build an augmented AgentContext with `reviewHistoryContext` injected from
   * the FTS5 ReviewMemoryStore. Non-fatal: returns base context on failure.
   */
  private buildReviewContextWithHistory(task: Task, baseContext: AgentContext): AgentContext {
    try {
      const store = this.getReviewMemory()
      if (!store) return baseContext
      // Only inject if there's any indexed history to surface
      if (store.getTotalCount() === 0) return baseContext
      const historyCtx = buildReviewHistoryContext(
        store,
        task.title + ' ' + task.description.slice(0, 200),
        task.files ?? [],
        5,
      )
      if (!historyCtx) return baseContext
      return { ...baseContext, reviewHistoryContext: historyCtx }
    } catch (err) {
      this.logWarn('[ReviewMemory] Failed to build history context', {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      })
      return baseContext
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

  private markTaskAwaitingHumanReview(
    task: Task,
    cb: OrchestratorCallbacks,
    role: AgentRole,
    reason: string,
  ): void {
    cb.updateTaskStatus(task.id, 'awaiting_human_review')
    this.obs.perf.increment('orchestrator.tasks.awaiting_human_review')
    this.logWarn('Task awaiting human review (HITL)', { taskId: task.id, reason })
    CheckpointService.getInstance().saveAwaitingHumanReview(task.id, reason)
    this.getEventBus().emit({
      type: 'task:failed',
      agentRole: role,
      taskId: task.id,
      data: { reason: `[HITL] ${reason}` },
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
