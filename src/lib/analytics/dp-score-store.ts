/**
 * DP Score Store — SQLite 持久化与趋势分析
 *
 * DP Score = Review Agent 的质量评分 × Independence Check 的惩罚因子
 *
 * 每次 review 完成后记录：
 * - task_id, timestamp
 * - proposer_score (Dev Agent 原始评分)
 * - critic_score   (Review Agent 给出的 score)
 * - dp_score       = critic_score × dpScorePenalty
 * - task_type      (dev / review / tester 等)
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'

// ─── 类型 ─────────────────────────────────────────────────────

export interface DPScoreRecord {
  id?: number
  task_id: string
  timestamp: number          // Unix ms
  proposer_score: number     // Dev Agent 认为的得分 (0-100)，无则默认 100
  critic_score: number       // Review Agent score (0-100)
  dp_score: number           // critic_score × dpScorePenalty (0-100)
  task_type: string          // task.assignedTo 或自定义类型
  independence_penalty: number // dpScorePenalty (0-1)
}

export interface DPScoreTrend {
  /** 最近 10 次 review 的平均 DP Score */
  recentAverage: number
  /** 最近 10 条记录 */
  recentRecords: DPScoreRecord[]
  /** 按任务类型分组的平均分 */
  byTaskType: Record<string, { average: number; count: number }>
  /** 最近 24 小时的分数趋势（按小时统计） */
  last24hHourly: Array<{ hour: string; average: number; count: number }>
  /** 总计录入条数 */
  totalCount: number
}

// ─── 存储类 ────────────────────────────────────────────────────

export class DPScoreStore {
  private db: Database.Database
  private static instance: DPScoreStore | null = null

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(
      process.env.HOME || '/tmp',
      '.clawcompany',
      'dp_scores.db'
    )

    // 确保目录存在
    const dir = path.dirname(resolvedPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(resolvedPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  /** 单例：全局共享同一个 DB 连接 */
  static getInstance(dbPath?: string): DPScoreStore {
    if (!DPScoreStore.instance) {
      DPScoreStore.instance = new DPScoreStore(dbPath)
    }
    return DPScoreStore.instance
  }

  /** 重置单例（测试用） */
  static resetInstance(): void {
    if (DPScoreStore.instance) {
      DPScoreStore.instance.close()
      DPScoreStore.instance = null
    }
  }

  // ─── Schema ─────────────────────────────────────────────────

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dp_scores (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id             TEXT    NOT NULL,
        timestamp           INTEGER NOT NULL,
        proposer_score      REAL    NOT NULL DEFAULT 100,
        critic_score        REAL    NOT NULL DEFAULT 0,
        dp_score            REAL    NOT NULL DEFAULT 0,
        task_type           TEXT    NOT NULL DEFAULT 'dev',
        independence_penalty REAL   NOT NULL DEFAULT 1.0
      );

      CREATE INDEX IF NOT EXISTS idx_dp_scores_timestamp
        ON dp_scores (timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_dp_scores_task_type
        ON dp_scores (task_type);

      CREATE INDEX IF NOT EXISTS idx_dp_scores_task_id
        ON dp_scores (task_id);
    `)
  }

  // ─── 写入 ────────────────────────────────────────────────────

  /**
   * 保存一条 DP Score 记录
   */
  save(record: Omit<DPScoreRecord, 'id'>): DPScoreRecord {
    const stmt = this.db.prepare(`
      INSERT INTO dp_scores
        (task_id, timestamp, proposer_score, critic_score, dp_score, task_type, independence_penalty)
      VALUES
        (@task_id, @timestamp, @proposer_score, @critic_score, @dp_score, @task_type, @independence_penalty)
    `)

    const info = stmt.run({
      task_id: record.task_id,
      timestamp: record.timestamp,
      proposer_score: Math.round(record.proposer_score * 100) / 100,
      critic_score: Math.round(record.critic_score * 100) / 100,
      dp_score: Math.round(record.dp_score * 100) / 100,
      task_type: record.task_type,
      independence_penalty: Math.round(record.independence_penalty * 1000) / 1000,
    })

    return { ...record, id: info.lastInsertRowid as number }
  }

  // ─── 读取 ────────────────────────────────────────────────────

  /**
   * 最近 N 条记录（默认 10）
   */
  getRecent(n: number = 10): DPScoreRecord[] {
    return this.db.prepare(`
      SELECT * FROM dp_scores
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    `).all(n) as DPScoreRecord[]
  }

  /**
   * 最近 N 次 review 的平均 DP Score
   */
  getRecentAverage(n: number = 10): number {
    const row = this.db.prepare(`
      SELECT AVG(dp_score) AS avg FROM (
        SELECT dp_score FROM dp_scores
        ORDER BY timestamp DESC, id DESC
        LIMIT ?
      )
    `).get(n) as { avg: number | null }

    return Math.round((row?.avg ?? 0) * 100) / 100
  }

  /**
   * 按任务类型分组的平均分
   */
  getByTaskType(): Record<string, { average: number; count: number }> {
    const rows = this.db.prepare(`
      SELECT
        task_type,
        AVG(dp_score) AS average,
        COUNT(*)      AS count
      FROM dp_scores
      GROUP BY task_type
      ORDER BY task_type
    `).all() as Array<{ task_type: string; average: number; count: number }>

    const result: Record<string, { average: number; count: number }> = {}
    for (const row of rows) {
      result[row.task_type] = {
        average: Math.round(row.average * 100) / 100,
        count: row.count,
      }
    }
    return result
  }

  /**
   * 最近 24 小时的逐小时趋势
   */
  getLast24hHourly(): Array<{ hour: string; average: number; count: number }> {
    const since = Date.now() - 24 * 60 * 60 * 1000

    const rows = this.db.prepare(`
      SELECT
        strftime('%Y-%m-%d %H:00', datetime(timestamp / 1000, 'unixepoch')) AS hour,
        AVG(dp_score) AS average,
        COUNT(*)      AS count
      FROM dp_scores
      WHERE timestamp >= ?
      GROUP BY hour
      ORDER BY hour ASC
    `).all(since) as Array<{ hour: string; average: number; count: number }>

    return rows.map(r => ({
      hour: r.hour,
      average: Math.round(r.average * 100) / 100,
      count: r.count,
    }))
  }

  /**
   * 总条数
   */
  getTotalCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM dp_scores').get() as { n: number }
    return row.n
  }

  // ─── 综合趋势 API ─────────────────────────────────────────────

  /**
   * 返回完整趋势分析报告
   */
  getTrend(): DPScoreTrend {
    const recentRecords = this.getRecent(10)
    const recentAverage = this.getRecentAverage(10)
    const byTaskType = this.getByTaskType()
    const last24hHourly = this.getLast24hHourly()
    const totalCount = this.getTotalCount()

    return {
      recentAverage,
      recentRecords,
      byTaskType,
      last24hHourly,
      totalCount,
    }
  }

  // ─── 工具 ─────────────────────────────────────────────────────

  close(): void {
    this.db.close()
  }
}

// ─── 便捷函数：从 review 结果构建 DPScoreRecord ───────────────

/**
 * 从 Review Agent 输出和 Independence Check 结果构建 DP Score 记录
 *
 * @param taskId         任务 ID
 * @param taskType       任务类型（assignedTo）
 * @param criticScore    Review Agent 给出的 score (0-100)
 * @param dpScorePenalty Independence Check 惩罚因子 (0-1)
 * @param proposerScore  Dev Agent 自评分 (可选，默认 100)
 */
export function buildDPScoreRecord(
  taskId: string,
  taskType: string,
  criticScore: number,
  dpScorePenalty: number = 1.0,
  proposerScore: number = 100,
): Omit<DPScoreRecord, 'id'> {
  const dp_score = Math.max(0, Math.min(100, criticScore * dpScorePenalty))

  return {
    task_id: taskId,
    timestamp: Date.now(),
    proposer_score: proposerScore,
    critic_score: criticScore,
    dp_score,
    task_type: taskType,
    independence_penalty: dpScorePenalty,
  }
}
