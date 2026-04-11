/**
 * GET /api/metrics/trace/:taskId
 *
 * Returns a structured trace summary for a specific task, including all agent
 * execution steps, durations, token usage, and review results.
 *
 * Query params:
 *   ?events=1   — include raw event list (default: yes)
 *
 * Response shape:
 * {
 *   ok: true,
 *   data: {
 *     task_id: string,
 *     total_duration_ms: number,
 *     total_tokens: number,
 *     agents_involved: string[],
 *     final_review_result: string | null,
 *     events: TraceEvent[],
 *   }
 * }
 *
 * Also supports:
 *   GET /api/metrics/trace   (no taskId) — list of recent task IDs
 */

import { NextRequest, NextResponse } from 'next/server'
import { TraceLogger } from '@/lib/analytics/trace-logger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params

  if (!taskId || taskId.trim() === '') {
    return NextResponse.json(
      { ok: false, error: 'taskId is required' },
      { status: 400 },
    )
  }

  try {
    const store = TraceLogger.getInstance()
    const summary = store.getSummary(taskId)

    if (summary.events.length === 0) {
      return NextResponse.json(
        { ok: false, error: `No trace events found for task: ${taskId}` },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, data: summary })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
