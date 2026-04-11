/**
 * GET /api/tasks/:id/status — 查询任务 checkpoint 状态
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, successResponse, errorResponse } from '@/lib/api/route-utils'
import { CheckpointService } from '@/lib/tasks/checkpoint-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authError = requireApiKey(request)
  if (authError) return authError

  const { id: taskId } = await params

  if (!taskId || taskId.trim().length === 0) {
    return errorResponse('Task ID is required', 400)
  }

  try {
    const cs = CheckpointService.getInstance()
    const statusInfo = cs.getStatus(taskId)
    const checkpoints = cs.getCheckpoints(taskId)
    const resumeInfo = cs.getResumePoint(taskId)

    return successResponse({
      taskId,
      found: statusInfo.found,
      status: statusInfo.status,
      stage: statusInfo.stage,
      updatedAt: statusInfo.updatedAt,
      outputs: statusInfo.outputs,
      checkpoints,
      resumable: resumeInfo.point === 'after_pm',
      resumePoint: resumeInfo.point,
    })
  } catch (error) {
    return errorResponse(error, 500, 'Task Status API')
  }
}
