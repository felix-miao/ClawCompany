/**
 * CheckpointManager — 高级断点续传管理，支持工作流恢复与状态重建
 *
 * 功能：
 * - 全局工作流状态快照保存/恢复
 * - 任务级断点与进度追踪
 * - 失败任务自动补偿（saga 模式）
 * - 死信队列（DLQ）处理永久失败
 * - 级联故障检测与熔断
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'

// ─── 类型定义 ─────────────────────────────────────────────────────

export type WorkflowCheckpointStatus =
  | 'pending'
  | 'running'
  | 'pm_complete'
  | 'dev_complete'
  | 'review_complete'
  | 'completed'
  | 'failed'
  | 'awaiting_human_review'
  | 'compensating'
  | 'compensated'

export interface WorkflowCheckpoint {
  id?: number
  workflow_id: string
  status: WorkflowCheckpointStatus
  stage: string
  input: WorkflowInput
  state: WorkflowState
  metadata: WorkflowMetadata
  created_at: number
  updated_at: number
}

export interface WorkflowInput {
  userMessage: string
  projectId?: string
}

export interface WorkflowState {
  tasks: TaskState[]
  messages: MessageState[]
  files: FileState[]
  currentAgent?: string
  currentTaskId?: string
  iterationCounts: Record<string, number>
}

export interface TaskState {
  id: string
  title: string
  description: string
  assignedTo: string
  status: 'pending' | 'in_progress' | 'review' | 'completed' | 'failed' | 'cancelled'
  dependencies: string[]
  files: string[]
  output?: string
  error?: string
  retryCount: number
  completedAt?: number
}

export interface MessageState {
  id: string
  agent: string
  content: string
  timestamp: number
}

export interface FileState {
  path: string
  content: string
  action: 'create' | 'modify' | 'delete'
}

export interface WorkflowMetadata {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  totalRetries: number
  executionTimeMs?: number
}

export interface CompensationAction {
  taskId: string
  type: 'rollback' | 'refund' | 'cleanup'
  payload: Record<string, unknown>
  executed: boolean
}

export interface DLQEntry {
  id: string
  workflow_id: string
  task_id: string
  error: string
  attempts: number
  last_attempt: number
  created_at: number
}

export interface CircuitBreakerState {
  workflowId: string
  failures: number
  state: 'closed' | 'open' | 'half_open'
  lastFailure: number
}

export interface CheckpointManagerConfig {
  dbPath?: string
  maxRetries: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
  dlqTtlDays: number
}

// ─── 默认配置 ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: CheckpointManagerConfig = {
  dbPath: path.join(process.env.HOME || '/tmp', '.clawcompany', 'resilience', 'checkpoint-manager.db'),
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60000,
  dlqTtlDays: 30,
}

// ─── CheckpointManager ────────────────────────────────────────────

export class CheckpointManager {
  private db: Database.Database
  private config: CheckpointManagerConfig
  private compensationQueue: CompensationAction[]
  private circuitBreakers: Map<string, CircuitBreakerState>
  private static instance: CheckpointManager | null = null

  constructor(config?: Partial<CheckpointManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.compensationQueue = []
    this.circuitBreakers = new Map()

    const dir = path.dirname(this.config.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(this.config.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  static getInstance(config?: Partial<CheckpointManagerConfig>): CheckpointManager {
    if (!CheckpointManager.instance) {
      CheckpointManager.instance = new CheckpointManager(config)
    }
    return CheckpointManager.instance
  }

  static resetInstance(): void {
    if (CheckpointManager.instance) {
      CheckpointManager.instance.close()
      CheckpointManager.instance = null
    }
  }

  // ─── Schema ─────────────────────────────────────────────────

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_checkpoints (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id  TEXT    NOT NULL,
        status        TEXT    NOT NULL,
        stage         TEXT    NOT NULL,
        input         TEXT    NOT NULL,
        state         TEXT    NOT NULL,
        metadata     TEXT    NOT NULL,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_wc_workflow_id
        ON workflow_checkpoints (workflow_id);

      CREATE INDEX IF NOT EXISTS idx_wc_status
        ON workflow_checkpoints (status);

      CREATE TABLE IF NOT EXISTS dlq (
        id            TEXT PRIMARY KEY,
        workflow_id  TEXT    NOT NULL,
        task_id       TEXT    NOT NULL,
        error        TEXT    NOT NULL,
        attempts     INTEGER NOT NULL DEFAULT 0,
        last_attempt  INTEGER NOT NULL,
        created_at    INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_dlq_workflow_id
        ON dlq (workflow_id);

      CREATE TABLE IF NOT EXISTS circuit_breakers (
        workflow_id  TEXT PRIMARY KEY,
        failures     INTEGER NOT NULL DEFAULT 0,
        state        TEXT    NOT NULL DEFAULT 'closed',
        last_failure INTEGER
      );
    `)
  }

  // ─── 工作流快照 ────────────────────────────────────────────

  /**
   * 保存工作流完整快照
   */
  saveWorkflow(workflow: Omit<WorkflowCheckpoint, 'id' | 'created_at' | 'updated_at'>): WorkflowCheckpoint {
    const now = Date.now()
    const existing = this.getLatestWorkflow(workflow.workflow_id)

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE workflow_checkpoints
        SET status = @status,
            stage = @stage,
            input = @input,
            state = @state,
            metadata = @metadata,
            updated_at = @updated_at
        WHERE id = @id
      `)
      stmt.run({
        id: existing.id,
        status: workflow.status,
        stage: workflow.stage,
        input: JSON.stringify(workflow.input),
        state: JSON.stringify(workflow.state),
        metadata: JSON.stringify(workflow.metadata),
        updated_at: now,
      })
      return { ...existing, ...workflow, updated_at: now }
    }

    const stmt = this.db.prepare(`
      INSERT INTO workflow_checkpoints
        (workflow_id, status, stage, input, state, metadata, created_at, updated_at)
      VALUES
        (@workflow_id, @status, @stage, @input, @state, @metadata, @created_at, @updated_at)
    `)
    const info = stmt.run({
      workflow_id: workflow.workflow_id,
      status: workflow.status,
      stage: workflow.stage,
      input: JSON.stringify(workflow.input),
      state: JSON.stringify(workflow.state),
      metadata: JSON.stringify(workflow.metadata),
      created_at: now,
      updated_at: now,
    })
    return { ...workflow, id: info.lastInsertRowid as number, created_at: now, updated_at: now }
  }

  /**
   * 获取工作流最新快照
   */
  getLatestWorkflow(workflowId: string): WorkflowCheckpoint | null {
    const row = this.db.prepare(`
      SELECT * FROM workflow_checkpoints
      WHERE workflow_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get(workflowId) as (WorkflowCheckpoint & { input: string; state: string; metadata: string }) | undefined

    if (!row) return null

    return {
      ...row,
      input: JSON.parse(row.input) as WorkflowInput,
      state: JSON.parse(row.state) as WorkflowState,
      metadata: JSON.parse(row.metadata) as WorkflowMetadata,
    }
  }

  /**
   * 获取所有工作流快照
   */
  getWorkflowHistory(workflowId: string): WorkflowCheckpoint[] {
    const rows = this.db.prepare(`
      SELECT * FROM workflow_checkpoints
      WHERE workflow_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(workflowId) as (WorkflowCheckpoint & { input: string; state: string; metadata: string })[]

    return rows.map(row => ({
      ...row,
      input: JSON.parse(row.input) as WorkflowInput,
      state: JSON.parse(row.state) as WorkflowState,
      metadata: JSON.parse(row.metadata) as WorkflowMetadata,
    }))
  }

  /**
   * 获取可恢复工作流列表
   */
  getResumableWorkflows(): WorkflowCheckpoint[] {
    const rows = this.db.prepare(`
      SELECT c1.* FROM workflow_checkpoints c1
      INNER JOIN (
        SELECT workflow_id, MAX(id) AS max_id
        FROM workflow_checkpoints
        GROUP BY workflow_id
      ) c2 ON c1.id = c2.max_id
      WHERE c1.status IN ('running', 'pm_complete', 'dev_complete', 'review_complete')
      ORDER BY c1.updated_at DESC
    `).all() as (WorkflowCheckpoint & { input: string; state: string; metadata: string })[]

    return rows.map(row => ({
      ...row,
      input: JSON.parse(row.input) as WorkflowInput,
      state: JSON.parse(row.state) as WorkflowState,
      metadata: JSON.parse(row.metadata) as WorkflowMetadata,
    }))
  }

  // ─── 任务状态管理 ────────────────────────────────────────────

  /**
   * 更新任务状态
   */
  updateTaskStatus(workflowId: string, task: TaskState): void {
    const workflow = this.getLatestWorkflow(workflowId)
    if (!workflow) return

    const taskIndex = workflow.state.tasks.findIndex(t => t.id === task.id)
    if (taskIndex >= 0) {
      workflow.state.tasks[taskIndex] = task
    } else {
      workflow.state.tasks.push(task)
    }

    this.saveWorkflow({
      workflow_id: workflowId,
      status: workflow.status,
      stage: workflow.stage,
      input: workflow.input,
      state: workflow.state,
      metadata: workflow.metadata,
    })
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(workflowId: string, taskId: string): TaskState | null {
    const workflow = this.getLatestWorkflow(workflowId)
    if (!workflow) return null
    return workflow.state.tasks.find(t => t.id === taskId) ?? null
  }

  // ─── 熔断器 ───────────────────────────────────────────────

  /**
   * 记录失败
   */
  recordFailure(workflowId: string): void {
    const existing = this.circuitBreakers.get(workflowId) ?? {
      workflowId,
      failures: 0,
      state: 'closed' as const,
      lastFailure: 0,
    }

    existing.failures++
    existing.lastFailure = Date.now()

    if (existing.failures >= this.config.circuitBreakerThreshold) {
      existing.state = 'open'
    }

    this.db.prepare(`
      INSERT INTO circuit_breakers (workflow_id, failures, state, last_failure)
      VALUES (@workflow_id, @failures, @state, @last_failure)
      ON CONFLICT(workflow_id) DO UPDATE SET
        failures = @failures,
        state = @state,
        last_failure = @last_failure
    `).run({
      workflow_id: workflowId,
      failures: existing.failures,
      state: existing.state,
      last_failure: existing.lastFailure,
    })

    this.circuitBreakers.set(workflowId, existing)
  }

  /**
   * 记录成功
   */
  recordSuccess(workflowId: string): void {
    const existing = this.circuitBreakers.get(workflowId)
    if (!existing) return

    if (existing.state === 'half_open') {
      existing.state = 'closed'
      existing.failures = 0
    }

    this.db.prepare(`
      UPDATE circuit_breakers
      SET failures = @failures, state = @state
      WHERE workflow_id = @workflow_id
    `).run({
      workflow_id: workflowId,
      failures: existing.failures,
      state: existing.state,
    })

    this.circuitBreakers.set(workflowId, existing)
  }

  /**
   * 获取熔断器状态
   */
  getCircuitBreakerState(workflowId: string): CircuitBreakerState | null {
    const row = this.db.prepare(`
      SELECT * FROM circuit_breakers WHERE workflow_id = ?
    `).get(workflowId) as CircuitBreakerState | undefined

    if (!row) return null

    // 自动检查是否需要从 open 转为 half_open
    if (row.state === 'open') {
      const elapsed = Date.now() - row.lastFailure
      if (elapsed >= this.config.circuitBreakerResetMs) {
        row.state = 'half_open'
        this.db.prepare(`
          UPDATE circuit_breakers SET state = 'half_open' WHERE workflow_id = ?
        `).run(workflowId)
      }
    }

    return row
  }

  // ─── 死信队列（DLQ） ─────────────────────────────────────────

  /**
   * 添加到 DLQ
   */
  addToDLQ(workflowId: string, taskId: string, error: string): void {
    const id = crypto.randomUUID()
    const now = Date.now()

    this.db.prepare(`
      INSERT INTO dlq (id, workflow_id, task_id, error, attempts, last_attempt, created_at)
      VALUES (@id, @workflow_id, @task_id, @error, 1, @last_attempt, @created_at)
    `).run({
      id,
      workflow_id: workflowId,
      task_id: taskId,
      error,
      last_attempt: now,
      created_at: now,
    })
  }

  /**
   * 重试 DLQ 条目
   */
  retryDLQ(dlqId: string): DLQEntry | null {
    const entry = this.db.prepare(`
      SELECT * FROM dlq WHERE id = ?
    `).get(dlqId) as DLQEntry | undefined

    if (!entry) return null

    if (entry.attempts >= this.config.maxRetries) {
      return entry // 已达到最大重试次数
    }

    this.db.prepare(`
      UPDATE dlq SET attempts = attempts + 1, last_attempt = @last_attempt WHERE id = @id
    `).run({ id: dlqId, last_attempt: Date.now() })

    return { ...entry, attempts: entry.attempts + 1, last_attempt: Date.now() }
  }

  /**
   * 获取 DLQ 所有条目
   */
  getDLQ(workflowId?: string): DLQEntry[] {
    if (workflowId) {
      return this.db.prepare(`
        SELECT * FROM dlq WHERE workflow_id = ? ORDER BY created_at DESC
      `).all(workflowId) as DLQEntry[]
    }
    return this.db.prepare(`
      SELECT * FROM dlq ORDER BY created_at DESC
    `).all() as DLQEntry[]
  }

  /**
   * 从 DLQ 移除（已处理）
   */
  removeFromDLQ(dlqId: string): void {
    this.db.prepare(`DELETE FROM dlq WHERE id = ?`).run(dlqId)
  }

  // ─── Saga 补偿 ───────────────────────────────────────────────

  /**
   * 注册补偿动作
   */
  registerCompensation(action: CompensationAction): void {
    this.compensationQueue.push(action)
  }

  /**
   * 执行所有补偿动作
   */
  async executeCompensations(
    onAction: (action: CompensationAction) => Promise<void>
  ): Promise<void> {
    // 逆序执行补偿
    for (const action of this.compensationQueue.reverse()) {
      if (!action.executed) {
        try {
          await onAction(action)
          action.executed = true
        } catch (err) {
          console.error('[CheckpointManager] Compensation failed:', err)
        }
      }
    }
    this.compensationQueue.length = 0
  }

  // ─── 工具方法 ─────────────────────────────────────────────────

  /**
   * 生成新的 workflow ID
   */
  generateWorkflowId(): string {
    return `wf-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  }

  /**
   * 判断工作流是否可恢复
   */
  canResume(workflowId: string): boolean {
    const latest = this.getLatestWorkflow(workflowId)
    if (!latest) return false

    return ['running', 'pm_complete', 'dev_complete', 'review_complete'].includes(latest.status)
  }

  /**
   * 判断工作流是否已完成
   */
  isCompleted(workflowId: string): boolean {
    const latest = this.getLatestWorkflow(workflowId)
    return latest?.status === 'completed'
  }

  /**
   * 删除工作流记录
   */
  deleteWorkflow(workflowId: string): void {
    this.db.prepare(`DELETE FROM workflow_checkpoints WHERE workflow_id = ?`).run(workflowId)
    this.db.prepare(`DELETE FROM dlq WHERE workflow_id = ?`).run(workflowId)
    this.db.prepare(`DELETE FROM circuit_breakers WHERE workflow_id = ?`).run(workflowId)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalWorkflows: number
    running: number
    completed: number
    failed: number
    dlqEntries: number
  } {
    const total = (this.db.prepare(`SELECT COUNT(DISTINCT workflow_id) as n FROM workflow_checkpoints`).get() as { n: number }).n
    const running = (this.db.prepare(`
      SELECT COUNT(*) as n FROM workflow_checkpoints WHERE status = 'running'
    `).get() as { n: number }).n
    const completed = (this.db.prepare(`
      SELECT COUNT(*) as n FROM workflow_checkpoints WHERE status = 'completed'
    `).get() as { n: number }).n
    const failed = (this.db.prepare(`
      SELECT COUNT(*) as n FROM workflow_checkpoints WHERE status = 'failed'
    `).get() as { n: number }).n
    const dlq = (this.db.prepare(`SELECT COUNT(*) as n FROM dlq`).get() as { n: number }).n

    return { totalWorkflows: total, running, completed, failed, dlqEntries: dlq }
  }

  close(): void {
    this.db.close()
  }
}

export default CheckpointManager