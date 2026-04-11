/**
 * WorkingMemory — SQLite-backed agent memory for ClawCompany workflows
 *
 * Provides short-term and cross-workflow memory for agents.
 * Key use cases:
 * - Remember review feedback so the next dev iteration knows what to fix
 * - Store project conventions discovered during PM analysis
 * - Track which approaches have been tried and rejected (anti-repeat)
 *
 * Storage: ~/.clawcompany/memory/working-memory.db (or custom path for testing)
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as crypto from 'crypto'

export interface MemoryEntry {
  id: string
  sessionId: string
  agentRole: string
  key: string
  value: string
  importance: number     // 0.0 – 1.0
  createdAt: number      // Unix ms
  expiresAt?: number     // Unix ms, undefined = no expiry
}

type MemoryRow = {
  id: string
  session_id: string
  agent_role: string
  key: string
  value: string
  importance: number
  created_at: number
  expires_at: number | null
}

const DEFAULT_DB_PATH = path.join(os.homedir(), '.clawcompany', 'memory', 'working-memory.db')

export class WorkingMemory {
  private db: Database.Database
  private static instance: WorkingMemory | null = null

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.migrate()
  }

  static getInstance(dbPath?: string): WorkingMemory {
    if (!WorkingMemory.instance) {
      WorkingMemory.instance = new WorkingMemory(dbPath)
    }
    return WorkingMemory.instance
  }

  static resetInstance(): void {
    WorkingMemory.instance = null
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS working_memory (
        id         TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        key        TEXT NOT NULL,
        value      TEXT NOT NULL,
        importance REAL NOT NULL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_wm_session    ON working_memory (session_id);
      CREATE INDEX IF NOT EXISTS idx_wm_key        ON working_memory (key);
      CREATE INDEX IF NOT EXISTS idx_wm_importance ON working_memory (importance DESC);
    `)
  }

  // ─── Write ───────────────────────────────────────────────────────────────

  /**
   * Store a memory entry.
   * If a memory with the same (sessionId, agentRole, key) already exists, it is replaced.
   *
   * @param sessionId   Unique workflow/session identifier
   * @param agentRole   The agent writing the memory (e.g. 'review', 'dev', 'pm')
   * @param key         Semantic key (e.g. 'last_review_feedback', 'project_conventions')
   * @param value       Content (plain text or JSON string)
   * @param importance  0.0 – 1.0, default 0.5
   * @param ttlMs       Optional time-to-live in milliseconds
   */
  remember(
    sessionId: string,
    agentRole: string,
    key: string,
    value: string,
    importance: number = 0.5,
    ttlMs?: number,
  ): void {
    const now = Date.now()
    const expiresAt = ttlMs != null ? now + ttlMs : null

    // Upsert: replace any existing entry with same (sessionId, agentRole, key)
    const existing = this.db.prepare(
      `SELECT id FROM working_memory WHERE session_id = ? AND agent_role = ? AND key = ?`
    ).get(sessionId, agentRole, key) as { id: string } | undefined

    if (existing) {
      this.db.prepare(
        `UPDATE working_memory SET value = ?, importance = ?, created_at = ?, expires_at = ? WHERE id = ?`
      ).run(value, importance, now, expiresAt, existing.id)
    } else {
      this.db.prepare(
        `INSERT INTO working_memory (id, session_id, agent_role, key, value, importance, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), sessionId, agentRole, key, value, importance, now, expiresAt)
    }
  }

  // ─── Read ────────────────────────────────────────────────────────────────

  /**
   * Recall the most recent non-expired memory entry for a given key.
   * If sessionId is provided, scopes to that session. Otherwise, returns the
   * most recent match across all sessions.
   */
  recall(key: string, sessionId?: string): MemoryEntry | null {
    const now = Date.now()
    let row: MemoryRow | undefined

    if (sessionId) {
      row = this.db.prepare(
        `SELECT * FROM working_memory
         WHERE key = ? AND session_id = ?
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY created_at DESC LIMIT 1`
      ).get(key, sessionId, now) as MemoryRow | undefined
    } else {
      row = this.db.prepare(
        `SELECT * FROM working_memory
         WHERE key = ?
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY created_at DESC LIMIT 1`
      ).get(key, now) as MemoryRow | undefined
    }

    return row ? this.rowToEntry(row) : null
  }

  /**
   * Return the top N most important, non-expired memories for a session.
   * Useful for injecting context into agent prompts.
   */
  getTopMemories(sessionId: string, limit: number = 10): MemoryEntry[] {
    const now = Date.now()
    const rows = this.db.prepare(
      `SELECT * FROM working_memory
       WHERE session_id = ?
         AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY importance DESC, created_at DESC
       LIMIT ?`
    ).all(sessionId, now, limit) as MemoryRow[]

    return rows.map(r => this.rowToEntry(r))
  }

  /**
   * Return all non-expired memories for a specific agent role.
   * Optionally scoped to a session.
   */
  getAgentMemories(agentRole: string, sessionId?: string, limit: number = 20): MemoryEntry[] {
    const now = Date.now()
    let rows: MemoryRow[]

    if (sessionId) {
      rows = this.db.prepare(
        `SELECT * FROM working_memory
         WHERE agent_role = ? AND session_id = ?
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY importance DESC, created_at DESC
         LIMIT ?`
      ).all(agentRole, sessionId, now, limit) as MemoryRow[]
    } else {
      rows = this.db.prepare(
        `SELECT * FROM working_memory
         WHERE agent_role = ?
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY importance DESC, created_at DESC
         LIMIT ?`
      ).all(agentRole, now, limit) as MemoryRow[]
    }

    return rows.map(r => this.rowToEntry(r))
  }

  // ─── Maintenance ─────────────────────────────────────────────────────────

  /**
   * Delete all expired entries. Returns count deleted.
   */
  purgeExpired(): number {
    const result = this.db.prepare(
      `DELETE FROM working_memory WHERE expires_at IS NOT NULL AND expires_at <= ?`
    ).run(Date.now())
    return result.changes
  }

  /**
   * Clear all memories. If sessionId provided, only clears that session.
   */
  clear(sessionId?: string): void {
    if (sessionId) {
      this.db.prepare(`DELETE FROM working_memory WHERE session_id = ?`).run(sessionId)
    } else {
      this.db.prepare(`DELETE FROM working_memory`).run()
    }
  }

  /** Total entry count (for debugging). */
  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as n FROM working_memory`).get() as { n: number }
    return row.n
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private rowToEntry(row: MemoryRow): MemoryEntry {
    return {
      id: row.id,
      sessionId: row.session_id,
      agentRole: row.agent_role,
      key: row.key,
      value: row.value,
      importance: row.importance,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? undefined,
    }
  }
}
