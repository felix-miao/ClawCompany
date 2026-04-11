/**
 * GET /api/metrics/trace
 *
 * Lists recent task IDs that have trace events.
 *
 * Query params:
 *   ?limit=N   — number of task IDs to return (default 20, max 100)
 *
 * Response:
 * {
 *   ok: true,
 *   data: {
 *     task_ids: string[],
 *     total_event_count: number,
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { TraceLogger } from '@/lib/analytics/trace-logger'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 20

    const store = TraceLogger.getInstance()
    const task_ids = store.getRecentTaskIds(limit)
    const total_event_count = store.getTotalEventCount()

    return NextResponse.json({ ok: true, data: { task_ids, total_event_count } })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
