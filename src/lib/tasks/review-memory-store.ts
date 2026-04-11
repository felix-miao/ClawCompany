/**
 * ReviewMemoryStore — FTS5-based cross-task review memory
 *
 * Implements SQLite FTS5 full-text search over historical code review issues,
 * enabling the Reviewer to learn from past reviews and avoid repeating the same
 * feedback. Cross-task patterns surfaced by getPatterns() help the reviewer
 * focus on recurring issues across the codebase.
 *
 * Storage: ~/.clawcompany/review-memory.db
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewIssue {
  task_id: string
  file_path: string
  issue_type: string       // e.g. 'type-safety', 'error-handling', 'security', 'performance'
  description: string      // Full description — indexed by FTS5
  severity: 'critical' | 'warning' | 'info'
  resolved: boolean
}

export interface ReviewMemoryEntry extends ReviewIssue {
  id?: number
  timestamp: number        // Unix ms
}

export interface SearchResult extends ReviewMemoryEntry {
  /** FTS5 BM25 relevance rank (lower = more relevant) */
  rank: number
}

export interface PatternSummary {
  issue_type: string
  file_path: string
  count: number
  last_seen: number        // Unix ms of most recent occurrence
  example_description: string
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class ReviewMemoryStore {
  private db: Database.Database
  private static instance: ReviewMemoryStore | null = null

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(
      os.homedir(),
      '.clawcompany',
      'review-memory.db',
    )

    const dir = path.dirname(resolvedPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(resolvedPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  /** Singleton — shared across the process */
  static getInstance(dbPath?: string): ReviewMemoryStore {
    if (!ReviewMemoryStore.instance) {
      ReviewMemoryStore.instance = new ReviewMemoryStore(dbPath)
    }
    return ReviewMemoryStore.instance
  }

  /** Reset singleton (test use only) */
  static resetInstance(): void {
    if (ReviewMemoryStore.instance) {
      ReviewMemoryStore.instance.close()
      ReviewMemoryStore.instance = null
    }
  }

  // ─── Schema ─────────────────────────────────────────────────────────────────

  private initSchema(): void {
    this.db.exec(`
      -- Backing store with metadata columns
      CREATE TABLE IF NOT EXISTS review_memory_data (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id     TEXT    NOT NULL,
        file_path   TEXT    NOT NULL DEFAULT '',
        issue_type  TEXT    NOT NULL DEFAULT '',
        description TEXT    NOT NULL DEFAULT '',
        severity    TEXT    NOT NULL DEFAULT 'info',
        resolved    INTEGER NOT NULL DEFAULT 0,
        timestamp   INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rm_task_id
        ON review_memory_data (task_id);

      CREATE INDEX IF NOT EXISTS idx_rm_file_path
        ON review_memory_data (file_path);

      CREATE INDEX IF NOT EXISTS idx_rm_issue_type
        ON review_memory_data (issue_type);

      CREATE INDEX IF NOT EXISTS idx_rm_timestamp
        ON review_memory_data (timestamp DESC);

      -- FTS5 virtual table — content= points to the backing table
      -- Named rm_fts to avoid shadow table name collision with review_memory_data
      CREATE VIRTUAL TABLE IF NOT EXISTS rm_fts USING fts5(
        task_id,
        file_path,
        issue_type,
        description,
        severity,
        resolved,
        content='review_memory_data',
        content_rowid='id',
        tokenize='unicode61 remove_diacritics 1'
      );

      -- Triggers to keep FTS5 in sync with backing table
      CREATE TRIGGER IF NOT EXISTS rm_ai AFTER INSERT ON review_memory_data BEGIN
        INSERT INTO rm_fts(rowid, task_id, file_path, issue_type, description, severity, resolved)
          VALUES (new.id, new.task_id, new.file_path, new.issue_type, new.description, new.severity, new.resolved);
      END;

      CREATE TRIGGER IF NOT EXISTS rm_ad AFTER DELETE ON review_memory_data BEGIN
        INSERT INTO rm_fts(rm_fts, rowid, task_id, file_path, issue_type, description, severity, resolved)
          VALUES ('delete', old.id, old.task_id, old.file_path, old.issue_type, old.description, old.severity, old.resolved);
      END;

      CREATE TRIGGER IF NOT EXISTS rm_au AFTER UPDATE ON review_memory_data BEGIN
        INSERT INTO rm_fts(rm_fts, rowid, task_id, file_path, issue_type, description, severity, resolved)
          VALUES ('delete', old.id, old.task_id, old.file_path, old.issue_type, old.description, old.severity, old.resolved);
        INSERT INTO rm_fts(rowid, task_id, file_path, issue_type, description, severity, resolved)
          VALUES (new.id, new.task_id, new.file_path, new.issue_type, new.description, new.severity, new.resolved);
      END;
    `)
  }

  // ─── Write ───────────────────────────────────────────────────────────────────

  /**
   * Index a single review issue into the FTS5 store.
   * Returns the assigned row ID.
   */
  indexIssue(issue: ReviewIssue): number {
    const stmt = this.db.prepare(`
      INSERT INTO review_memory_data
        (task_id, file_path, issue_type, description, severity, resolved, timestamp)
      VALUES
        (@task_id, @file_path, @issue_type, @description, @severity, @resolved, @timestamp)
    `)

    const info = stmt.run({
      task_id: issue.task_id,
      file_path: issue.file_path ?? '',
      issue_type: issue.issue_type ?? '',
      description: issue.description,
      severity: issue.severity ?? 'info',
      resolved: issue.resolved ? 1 : 0,
      timestamp: Date.now(),
    })

    return info.lastInsertRowid as number
  }

  /**
   * Index a batch of review issues from a completed review response.
   *
   * Accepts a structured review result: an object with a `checks` or
   * `suggestions` array, or a free-form string (parsed heuristically).
   *
   * @param taskId   The task that was just reviewed
   * @param review   Review Agent response metadata or message string
   * @param filePaths Files that were reviewed (for tagging)
   */
  index(
    taskId: string,
    review: {
      message?: string
      metadata?: Record<string, unknown>
    },
    filePaths: string[] = [],
  ): void {
    const issues = this.extractIssues(taskId, review, filePaths)
    const insertMany = this.db.transaction((items: ReviewIssue[]) => {
      for (const item of items) {
        this.indexIssue(item)
      }
    })
    insertMany(issues)
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  /**
   * Full-text search over review issues.
   * Uses FTS5 BM25 ranking via `rank` column.
   *
   * @param query  FTS5 query string (e.g. "security injection", "async performance")
   * @param topK   Maximum number of results to return (default 10)
   */
  search(query: string, topK: number = 10): SearchResult[] {
    if (!query || query.trim().length === 0) return []

    // Escape FTS5 special chars to prevent query parse errors
    const safeQuery = this.escapeFts5Query(query)

    try {
      const rows = this.db.prepare(`
        SELECT
          d.id,
          d.task_id,
          d.file_path,
          d.issue_type,
          d.description,
          d.severity,
          d.resolved,
          d.timestamp,
          fts.rank
        FROM rm_fts fts
        JOIN review_memory_data d ON d.id = fts.rowid
        WHERE rm_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `).all(safeQuery, topK) as Array<{
        id: number
        task_id: string
        file_path: string
        issue_type: string
        description: string
        severity: string
        resolved: number
        timestamp: number
        rank: number
      }>

      return rows.map(r => ({
        id: r.id,
        task_id: r.task_id,
        file_path: r.file_path,
        issue_type: r.issue_type,
        description: r.description,
        severity: r.severity as ReviewIssue['severity'],
        resolved: r.resolved === 1,
        timestamp: r.timestamp,
        rank: r.rank,
      }))
    } catch {
      // FTS5 query syntax error — fall back to LIKE search
      return this.fallbackSearch(query, topK)
    }
  }

  /**
   * Get recurring issue patterns for a specific file path (or all files).
   * Returns patterns sorted by frequency (count DESC), useful for surfacing
   * "this file has had X errors before" context.
   *
   * @param filePath  Exact file path to filter, or '' / undefined for all files
   */
  getPatterns(filePath?: string): PatternSummary[] {
    if (filePath && filePath.trim().length > 0) {
      return this.db.prepare(`
        SELECT
          issue_type,
          file_path,
          COUNT(*)             AS count,
          MAX(timestamp)       AS last_seen,
          MAX(description)     AS example_description
        FROM review_memory_data
        WHERE file_path = ?
        GROUP BY issue_type, file_path
        ORDER BY count DESC, last_seen DESC
        LIMIT 20
      `).all(filePath) as PatternSummary[]
    }

    return this.db.prepare(`
      SELECT
        issue_type,
        file_path,
        COUNT(*)             AS count,
        MAX(timestamp)       AS last_seen,
        MAX(description)     AS example_description
      FROM review_memory_data
      GROUP BY issue_type, file_path
      ORDER BY count DESC, last_seen DESC
      LIMIT 50
    `).all() as PatternSummary[]
  }

  /**
   * Get the total number of indexed review issues.
   */
  getTotalCount(): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) AS n FROM review_memory_data'
    ).get() as { n: number }
    return row.n
  }

  /**
   * Mark an issue as resolved (e.g. after the next review passes).
   */
  markResolved(id: number): void {
    this.db.prepare(
      'UPDATE review_memory_data SET resolved = 1 WHERE id = ?'
    ).run(id)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Extract structured ReviewIssue objects from a review agent response.
   * Handles both JSON-structured metadata (checks/suggestions) and plain text.
   */
  private extractIssues(
    taskId: string,
    review: { message?: string; metadata?: Record<string, unknown> },
    filePaths: string[],
  ): ReviewIssue[] {
    const issues: ReviewIssue[] = []
    const primaryFile = filePaths[0] ?? ''

    // ── 1. Try structured checks from metadata ────────────────────────────────
    const checks = review.metadata?.checks
    if (Array.isArray(checks)) {
      for (const check of checks as Array<{
        name?: string
        passed?: boolean
        warning?: boolean
        message?: string
      }>) {
        if (check.passed && !check.warning) continue  // skip passing checks
        const severity: ReviewIssue['severity'] = check.warning
          ? 'warning'
          : !check.passed
            ? 'critical'
            : 'info'

        const description = [check.name, check.message].filter(Boolean).join(' — ')
        if (!description) continue

        issues.push({
          task_id: taskId,
          file_path: primaryFile,
          issue_type: this.inferIssueType(check.name ?? '', description),
          description,
          severity,
          resolved: false,
        })
      }
    }

    // ── 2. Try structured suggestions from metadata ───────────────────────────
    const suggestions = review.metadata?.suggestions
    if (Array.isArray(suggestions)) {
      for (const s of suggestions as string[]) {
        if (!s || typeof s !== 'string') continue
        issues.push({
          task_id: taskId,
          file_path: primaryFile,
          issue_type: this.inferIssueType('', s),
          description: s,
          severity: 'info',
          resolved: false,
        })
      }
    }

    // ── 3. Fall back to parsing plain text message ────────────────────────────
    if (issues.length === 0 && review.message) {
      const lines = review.message.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        // Pick lines that look like issues (bullet points, ❌ ⚠️ markers, numbered)
        if (
          trimmed.startsWith('❌') ||
          trimmed.startsWith('⚠️') ||
          /^[-*•]\s/.test(trimmed) ||
          /^\d+\.\s/.test(trimmed)
        ) {
          const description = trimmed.replace(/^[❌⚠️\-*•\d.]\s*/, '').trim()
          if (description.length < 10) continue
          issues.push({
            task_id: taskId,
            file_path: primaryFile,
            issue_type: this.inferIssueType('', description),
            description,
            severity: trimmed.startsWith('❌') ? 'critical' : 'warning',
            resolved: false,
          })
        }
      }
    }

    // Deduplicate by description to avoid storing noise
    const seen = new Set<string>()
    return issues.filter(i => {
      if (seen.has(i.description)) return false
      seen.add(i.description)
      return true
    })
  }

  /**
   * Heuristically infer a canonical issue_type from a check name or description.
   */
  private inferIssueType(name: string, description: string): string {
    const text = `${name} ${description}`.toLowerCase()
    if (/security|inject|xss|csrf|auth|eval|dangerously/.test(text)) return 'security'
    if (/perform|loop|await.*loop|promise\.all|render|memo/.test(text)) return 'performance'
    if (/type|any\b|typescript|interface|generic/.test(text)) return 'type-safety'
    if (/error|try.?catch|exception|throw|reject/.test(text)) return 'error-handling'
    if (/test|coverage|spec|unit/.test(text)) return 'test-coverage'
    if (/access|aria|a11y|label|role/.test(text)) return 'accessibility'
    if (/style|indent|format|prettier|lint/.test(text)) return 'code-style'
    if (/logic|null|undefined|edge.?case|off.?by/.test(text)) return 'logic'
    return 'general'
  }

  /**
   * Escape FTS5 special characters to prevent query parse failures.
   * FTS5 special chars: " * ^ ( ) :
   */
  private escapeFts5Query(query: string): string {
    // Wrap each token as a phrase query to avoid operator issues
    const tokens = query.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return '""'
    return tokens.map(t => `"${t.replace(/"/g, '""')}"`).join(' ')
  }

  /**
   * Fallback LIKE-based search when FTS5 query parsing fails.
   */
  private fallbackSearch(query: string, topK: number): SearchResult[] {
    const term = `%${query.replace(/[%_]/g, '\\$&')}%`
    const rows = this.db.prepare(`
      SELECT
        id, task_id, file_path, issue_type, description,
        severity, resolved, timestamp,
        0 AS rank
      FROM review_memory_data
      WHERE description LIKE ? ESCAPE '\\'
         OR issue_type LIKE ? ESCAPE '\\'
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(term, term, topK) as Array<{
      id: number; task_id: string; file_path: string; issue_type: string
      description: string; severity: string; resolved: number; timestamp: number; rank: number
    }>

    return rows.map(r => ({
      id: r.id,
      task_id: r.task_id,
      file_path: r.file_path,
      issue_type: r.issue_type,
      description: r.description,
      severity: r.severity as ReviewIssue['severity'],
      resolved: r.resolved === 1,
      timestamp: r.timestamp,
      rank: r.rank,
    }))
  }

  close(): void {
    this.db.close()
  }
}

// ─── Prompt helpers ────────────────────────────────────────────────────────────

/**
 * Build a concise "historical context" block to inject into the Reviewer prompt.
 * Returns an empty string when no relevant history exists.
 *
 * @param store     ReviewMemoryStore instance
 * @param query     Search query (e.g. task title or file description)
 * @param filePaths Files to fetch per-file patterns for
 * @param topK      Max search results to include (default 5)
 */
export function buildReviewHistoryContext(
  store: ReviewMemoryStore,
  query: string,
  filePaths: string[] = [],
  topK: number = 5,
): string {
  const parts: string[] = []

  // 1. Semantic search results
  const results = store.search(query, topK)
  if (results.length > 0) {
    parts.push('## 历史 Review 相关问题（供参考）')
    for (const r of results) {
      const resolved = r.resolved ? ' [已修复]' : ''
      parts.push(`- [${r.severity.toUpperCase()}${resolved}] ${r.issue_type}: ${r.description}`)
    }
  }

  // 2. Per-file recurring patterns
  if (filePaths.length > 0) {
    const patterns: typeof results = []
    for (const fp of filePaths.slice(0, 3)) {
      const ps = store.getPatterns(fp)
      for (const p of ps.slice(0, 3)) {
        if (p.count >= 2) {
          patterns.push({
            task_id: '',
            file_path: p.file_path,
            issue_type: p.issue_type,
            description: `${p.example_description} (出现 ${p.count} 次)`,
            severity: 'warning',
            resolved: false,
            timestamp: p.last_seen,
            rank: 0,
          })
        }
      }
    }
    if (patterns.length > 0) {
      parts.push('\n## 该文件历史高频问题')
      for (const p of patterns) {
        parts.push(`- [${p.issue_type}] ${p.description}`)
      }
    }
  }

  if (parts.length === 0) return ''
  return parts.join('\n') + '\n\n请结合以上历史问题进行本次 Review，避免遗漏已知模式。\n'
}
