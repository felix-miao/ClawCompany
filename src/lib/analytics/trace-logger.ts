/**
 * TraceLogger — Per-task execution trace storage (SQLite)
 *
 * Records a structured event for every agent execution step, capturing:
 * - task_id, agent role
 * - duration_ms (wall-clock latency for this agent call)
 * - token_usage (prompt + completion tokens if available in AgentResponse.metadata)
 * - review_result ('success' | 'rejected' | 'error' | null)
 *
 * DB location: ~/.clawcompany/traces.db
 *
 * Exposed via:  GET /api/metrics/trace/:taskId
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'

// ─── Types ────────────────────────────────────────────────────

export interface TraceEvent {
  id?: number
  task_id: string
  agent: string
  started_at: number       // Unix ms — when the agent call started
  duration_ms: number      // wall-clock ms for this step
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  review_result: string | null   // 'success' | 'rejected' | 'error' | null
  metadata: string               // JSON blob for extra context
}

export interface TraceEventInput {
  task_id: string
  agent: string
  started_at: number
  duration_ms: number
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  review_result?: string | null
  metadata?: Record<string, unknown>
}

export interface TaskTraceSummary {
  task_id: string
  events: TraceEvent[]
  total_duration_ms: number
  total_tokens: number
  agents_involved: string[]
  final_review_result: string | null
}

// ─── Store ────────────────────────────────────────────────────

export class TraceLogger {
  private db: Database.Database
  private static instance: TraceLogger | null = null

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(
      process.env.HOME || '/tmp',
      '.clawcompany',
      'traces.db',
    )

    const dir = path.dirname(resolvedPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(resolvedPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  static getInstance(dbPath?: string): TraceLogger {
    if (!TraceLogger.instance) {
      TraceLogger.instance = new TraceLogger(dbPath)
    }
    return TraceLogger.instance
  }

  static resetInstance(): void {
    if (TraceLogger.instance) {
      TraceLogger.instance.close()
      TraceLogger.instance = null
    }
  }

  // ─── Schema ──────────────────────────────────────────────────

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trace_events (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id          TEXT    NOT NULL,
        agent            TEXT    NOT NULL,
        started_at       INTEGER NOT NULL,
        duration_ms      INTEGER NOT NULL DEFAULT 0,
        prompt_tokens    INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens     INTEGER NOT NULL DEFAULT 0,
        review_result    TEXT,
        metadata         TEXT    NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_trace_task_id
        ON trace_events (task_id);

      CREATE INDEX IF NOT EXISTS idx_trace_started_at
        ON trace_events (started_at DESC);

      CREATE INDEX IF NOT EXISTS idx_trace_agent
        ON trace_events (agent);
    `)
  }

  // ─── Write ───────────────────────────────────────────────────

  /**
   * Append a single trace event for one agent call within a task.
   */
  record(event: TraceEventInput): TraceEvent {
    const stmt = this.db.prepare(`
      INSERT INTO trace_events
        (task_id, agent, started_at, duration_ms,
         prompt_tokens, completion_tokens, total_tokens,
         review_result, metadata)
      VALUES
        (@task_id, @agent, @started_at, @duration_ms,
         @prompt_tokens, @completion_tokens, @total_tokens,
         @review_result, @metadata)
    `)

    const row = {
      task_id: event.task_id,
      agent: event.agent,
      started_at: event.started_at,
      duration_ms: event.duration_ms,
      prompt_tokens: event.prompt_tokens ?? 0,
      completion_tokens: event.completion_tokens ?? 0,
      total_tokens: event.total_tokens ?? 0,
      review_result: event.review_result ?? null,
      metadata: JSON.stringify(event.metadata ?? {}),
    }

    const result = stmt.run(row)
    return { ...row, id: Number(result.lastInsertRowid) }
  }

  // ─── Read ────────────────────────────────────────────────────

  /**
   * Return all trace events for a given task_id.
   */
  getByTaskId(taskId: string): TraceEvent[] {
    return this.db
      .prepare('SELECT * FROM trace_events WHERE task_id = ? ORDER BY started_at ASC')
      .all(taskId) as TraceEvent[]
  }

  /**
   * Return a rolled-up summary for a task_id.
   */
  getSummary(taskId: string): TaskTraceSummary {
    const events = this.getByTaskId(taskId)

    const total_duration_ms = events.reduce((acc, e) => acc + e.duration_ms, 0)
    const total_tokens = events.reduce((acc, e) => acc + e.total_tokens, 0)
    const agents_involved = [...new Set(events.map(e => e.agent))]

    // Last non-null review result wins
    const final_review_result =
      events
        .filter(e => e.review_result !== null)
        .map(e => e.review_result)
        .pop() ?? null

    return {
      task_id: taskId,
      events,
      total_duration_ms,
      total_tokens,
      agents_involved,
      final_review_result,
    }
  }

  /**
   * List recent task IDs that have trace events (up to `limit`).
   */
  getRecentTaskIds(limit = 20): string[] {
    const rows = this.db
      .prepare(`
        SELECT DISTINCT task_id
        FROM trace_events
        ORDER BY started_at DESC
        LIMIT ?
      `)
      .all(limit) as Array<{ task_id: string }>
    return rows.map(r => r.task_id)
  }

  getTotalEventCount(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM trace_events')
      .get() as { n: number }
    return row.n
  }

  close(): void {
    this.db.close()
  }
}
