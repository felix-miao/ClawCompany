/**
 * POST /api/tasks/:id/human-decision
 *
 * HITL endpoint: accept a human decision for tasks stuck in `awaiting_human_review`.
 *
 * Body JSON:
 *   {
 *     "decision": "approve" | "reject" | "retry",
 *     "comment": "optional human note"
 *   }
 *
 * Responses:
 *   200 { success: true, taskId, decision, newStatus }
 *   400 Bad request / invalid decision
 *   404 Task not in awaiting_human_review state
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, successResponse, errorResponse } from '@/lib/api/route-utils'
import { CheckpointService } from '@/lib/tasks/checkpoint-service'

type HumanDecision = 'approve' | 'reject' | 'retry'

const VALID_DECISIONS: readonly HumanDecision[] = ['approve', 'reject', 'retry']

function isValidDecision(value: unknown): value is HumanDecision {
  return typeof value === 'string' && (VALID_DECISIONS as readonly string[]).includes(value)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authError = requireApiKey(request)
  if (authError) return authError

  const { id: taskId } = await params

  if (!taskId || taskId.trim().length === 0) {
    return errorResponse('Task ID is required', 400)
  }

  let body: { decision?: unknown; comment?: unknown }
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const { decision, comment } = body

  if (!isValidDecision(decision)) {
    return errorResponse(
      `Invalid decision "${String(decision)}". Must be one of: ${VALID_DECISIONS.join(', ')}`,
      400,
    )
  }

  const cs = CheckpointService.getInstance()
  const statusInfo = cs.getStatus(taskId)

  if (!statusInfo.found) {
    return errorResponse(`Task "${taskId}" not found in checkpoint store`, 404)
  }

  if (statusInfo.status !== 'awaiting_human_review') {
    return errorResponse(
      `Task "${taskId}" is not awaiting human review (current status: ${statusInfo.status ?? 'unknown'})`,
      404,
    )
  }

  const commentStr = typeof comment === 'string' ? comment : ''

  // Map decision → new checkpoint status
  switch (decision) {
    case 'approve': {
      // Human approves the work despite review disagreement → mark completed
      cs.saveCompleted(taskId)
      return successResponse({
        taskId,
        decision,
        newStatus: 'completed',
        comment: commentStr,
        message: 'Task approved by human reviewer — marked as completed.',
      })
    }

    case 'reject': {
      cs.saveError(taskId, `Human decision: REJECT. ${commentStr}`.trim())
      return successResponse({
        taskId,
        decision,
        newStatus: 'failed',
        comment: commentStr,
        message: 'Task rejected by human reviewer — marked as failed.',
      })
    }

    case 'retry': {
      // Reset to running so the orchestrator can pick it up again
      cs.saveInitial(taskId, statusInfo.outputs.userMessage ?? `[HITL retry] ${commentStr}`.trim())
      return successResponse({
        taskId,
        decision,
        newStatus: 'running',
        comment: commentStr,
        message: 'Task reset for retry — orchestrator can re-process from fresh.',
      })
    }
  }
}
