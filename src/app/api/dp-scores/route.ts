/**
 * GET /api/dp-scores/trend
 *
 * 返回 DP Score 趋势分析报告：
 * - 最近 10 次 review 的平均 DP Score
 * - 按任务类型分组的平均分
 * - 最近 24 小时的逐小时趋势
 * - 最近 10 条记录
 *
 * GET /api/dp-scores/trend?limit=N  —— 调整"最近 N 次"
 *
 * POST /api/dp-scores
 * Body: { taskId, taskType, criticScore, dpScorePenalty?, proposerScore? }
 *
 * 手动录入一条 DP Score（可用于测试或外部集成）
 */

import { NextRequest, NextResponse } from 'next/server'
import { DPScoreStore, buildDPScoreRecord } from '@/lib/analytics/dp-score-store'
import { z } from 'zod'

// ─── GET: 趋势报告 ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 10

    const store = DPScoreStore.getInstance()

    const [recentRecords, recentAverage, byTaskType, last24hHourly, totalCount] = [
      store.getRecent(limit),
      store.getRecentAverage(limit),
      store.getByTaskType(),
      store.getLast24hHourly(),
      store.getTotalCount(),
    ]

    return NextResponse.json({
      ok: true,
      data: {
        recentAverage,
        recentRecords,
        byTaskType,
        last24hHourly,
        totalCount,
        limit,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

// ─── POST: 手动录入 ──────────────────────────────────────────

const PostBodySchema = z.object({
  taskId: z.string().min(1),
  taskType: z.string().min(1).default('dev'),
  criticScore: z.number().min(0).max(100),
  dpScorePenalty: z.number().min(0).max(1).optional().default(1.0),
  proposerScore: z.number().min(0).max(100).optional().default(100),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = PostBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid body', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { taskId, taskType, criticScore, dpScorePenalty, proposerScore } = parsed.data

    const record = buildDPScoreRecord(taskId, taskType, criticScore, dpScorePenalty, proposerScore)
    const saved = DPScoreStore.getInstance().save(record)

    return NextResponse.json({ ok: true, data: saved }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
