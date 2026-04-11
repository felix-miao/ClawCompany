/**
 * Task Checkpoint Store — SQLite 持久化任务执行断点
 *
 * 在工作流的每个关键阶段保存 checkpoint：
 * - PM 分析完成 (pm_complete)
 * - Dev 实现完成 (dev_complete)
 * - Review 完成 (review_complete)
 * - 工作流完成 (completed) 或失败 (failed)
 *
 * 进程重启后可通过 task_id 查询最新 checkpoint 并断点续传。
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'

// ─── 类型 ─────────────────────────────────────────────────────

export type CheckpointStage = 'initial' | 'pm' | 'dev' | 'review'

export type CheckpointStatus =
  | 'pending'
  | 'running'
  | 'pm_complete'
  | 'dev_complete'
  | 'review_complete'
  | 'completed'
  | 'failed'

export interface TaskCheckpoint {
  id?: number
  task_id: string
  status: CheckpointStatus
  stage: CheckpointStage
  agent_outputs: string   // JSON-encoded CheckpointAgentOutputs
  created_at: number      // Unix ms
  updated_at: number      // Unix ms
}

/** 各阶段的 agent 输出数据 */
export interface CheckpointAgentOutputs {
  userMessage?: string
  pmAnalysis?: string
  pmMessage?: string
  subTasks?: unknown[]
  devFiles?: Array<{ path: string; content: string }>
  devMessage?: string
  reviewApproved?: boolean
  reviewFeedback?: string
  reviewMessage?: string
  error?: string
}

// ─── Store ────────────────────────────────────────────────────

export class TaskCheckpointStore {
  private db: Database.Database
  private static instance: TaskCheckpointStore | null = null

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(
      process.env.HOME || '/tmp',
      '.clawcompany',
      'task_checkpoints.db'
    )

    const dir = path.dirname(resolvedPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(resolvedPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  /** 单例：全局共享同一个 DB 连接 */
  static getInstance(dbPath?: string): TaskCheckpointStore {
    if (!TaskCheckpointStore.instance) {
      TaskCheckpointStore.instance = new TaskCheckpointStore(dbPath)
    }
    return TaskCheckpointStore.instance
  }

  /** 重置单例（测试用） */
  static resetInstance(): void {
    if (TaskCheckpointStore.instance) {
      TaskCheckpointStore.instance.close()
      TaskCheckpointStore.instance = null
    }
  }

  // ─── Schema ─────────────────────────────────────────────────

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_checkpoints (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id       TEXT    NOT NULL,
        status        TEXT    NOT NULL,
        stage         TEXT    NOT NULL,
        agent_outputs TEXT    NOT NULL DEFAULT '{}',
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_checkpoints_task_id
        ON task_checkpoints (task_id);

      CREATE INDEX IF NOT EXISTS idx_checkpoints_status
        ON task_checkpoints (status);

      CREATE INDEX IF NOT EXISTS idx_checkpoints_updated_at
        ON task_checkpoints (updated_at DESC);
    `)
  }

  // ─── 写入 ────────────────────────────────────────────────────

  /**
   * 保存 checkpoint（upsert by task_id + stage）
   *
   * 同一 task_id + stage 的 checkpoint 会更新（updated_at + status + agent_outputs），
   * 新 stage 则新建一条记录。
   */
  save(checkpoint: Omit<TaskCheckpoint, 'id'>): TaskCheckpoint {
    const existing = this.getLatestByTaskAndStage(checkpoint.task_id, checkpoint.stage)

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE task_checkpoints
        SET status        = @status,
            agent_outputs = @agent_outputs,
            updated_at    = @updated_at
        WHERE id = @id
      `)
      stmt.run({
        id: existing.id,
        status: checkpoint.status,
        agent_outputs: checkpoint.agent_outputs,
        updated_at: checkpoint.updated_at,
      })
      return { ...existing, ...checkpoint }
    }

    const stmt = this.db.prepare(`
      INSERT INTO task_checkpoints
        (task_id, status, stage, agent_outputs, created_at, updated_at)
      VALUES
        (@task_id, @status, @stage, @agent_outputs, @created_at, @updated_at)
    `)
    const info = stmt.run(checkpoint)
    return { ...checkpoint, id: info.lastInsertRowid as number }
  }

  // ─── 读取 ────────────────────────────────────────────────────

  /**
   * 获取某任务的最新 checkpoint（id DESC 最新插入/更新的行）
   */
  getLatest(taskId: string): TaskCheckpoint | null {
    const row = this.db.prepare(`
      SELECT * FROM task_checkpoints
      WHERE task_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get(taskId) as TaskCheckpoint | undefined
    return row ?? null
  }

  /**
   * 获取某任务某阶段的 checkpoint
   */
  getLatestByTaskAndStage(taskId: string, stage: CheckpointStage): TaskCheckpoint | null {
    const row = this.db.prepare(`
      SELECT * FROM task_checkpoints
      WHERE task_id = ? AND stage = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get(taskId, stage) as TaskCheckpoint | undefined
    return row ?? null
  }

  /**
   * 获取某任务所有 checkpoint（时间升序）
   */
  getAll(taskId: string): TaskCheckpoint[] {
    return this.db.prepare(`
      SELECT * FROM task_checkpoints
      WHERE task_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(taskId) as TaskCheckpoint[]
  }

  /**
   * 按 status 查询（用于监控和恢复）
   */
  getByStatus(status: CheckpointStatus, limit: number = 50): TaskCheckpoint[] {
    return this.db.prepare(`
      SELECT * FROM task_checkpoints
      WHERE status = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(status, limit) as TaskCheckpoint[]
  }

  /**
   * 获取可恢复的任务（pm_complete 但未 completed/failed）
   */
  getResumable(): TaskCheckpoint[] {
    return this.db.prepare(`
      SELECT c1.* FROM task_checkpoints c1
      INNER JOIN (
        SELECT task_id, MAX(id) AS max_id
        FROM task_checkpoints
        GROUP BY task_id
      ) c2 ON c1.id = c2.max_id
      WHERE c1.status IN ('pm_complete', 'dev_complete', 'running')
      ORDER BY c1.updated_at DESC
    `).all() as TaskCheckpoint[]
  }

  /**
   * 解析 agent_outputs JSON
   */
  parseOutputs(checkpoint: TaskCheckpoint): CheckpointAgentOutputs {
    try {
      return JSON.parse(checkpoint.agent_outputs) as CheckpointAgentOutputs
    } catch {
      return {}
    }
  }

  // ─── 工具 ─────────────────────────────────────────────────────

  getTotalCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM task_checkpoints').get() as { n: number }
    return row.n
  }

  close(): void {
    this.db.close()
  }
}

// ─── 便捷构建函数 ──────────────────────────────────────────────

export function buildCheckpoint(
  taskId: string,
  status: CheckpointStatus,
  stage: CheckpointStage,
  outputs: CheckpointAgentOutputs,
): Omit<TaskCheckpoint, 'id'> {
  const now = Date.now()
  return {
    task_id: taskId,
    status,
    stage,
    agent_outputs: JSON.stringify(outputs),
    created_at: now,
    updated_at: now,
  }
}
