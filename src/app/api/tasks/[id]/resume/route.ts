/**
 * POST /api/tasks/:id/resume — 从 checkpoint 恢复任务
 *
 * 恢复策略：
 * - 'after_pm'   → PM 已完成，replay 原始 userMessage 触发全新工作流
 * - 'completed'  → 已完成，返回 resumed: false
 * - 'failed'     → 已失败，返回失败原因，让调用方决定是否重试
 * - 'fresh'      → 无可恢复 checkpoint，返回 resumed: false
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, checkRateLimit, successResponse, errorResponse } from '@/lib/api/route-utils'
import { CheckpointService } from '@/lib/tasks/checkpoint-service'
import { getDefaultContainer, Services } from '@/lib/core/services'
import type { Orchestrator } from '@/lib/orchestrator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authError = requireApiKey(request)
  if (authError) return authError

  const rateLimitError = checkRateLimit(request)
  if (rateLimitError) return rateLimitError

  const { id: taskId } = await params

  if (!taskId || taskId.trim().length === 0) {
    return errorResponse('Task ID is required', 400)
  }

  const cs = CheckpointService.getInstance()
  const resumeInfo = cs.getResumePoint(taskId)

  if (resumeInfo.point === 'completed') {
    return successResponse({
      resumed: false,
      taskId,
      resumePoint: 'completed',
      reason: 'Task already completed. No resume needed.',
    })
  }

  if (resumeInfo.point === 'fresh') {
    return successResponse({
      resumed: false,
      taskId,
      resumePoint: 'fresh',
      reason: 'No recoverable checkpoint found. Re-submit the original request.',
    })
  }

  if (resumeInfo.point === 'failed') {
    return successResponse({
      resumed: false,
      taskId,
      resumePoint: 'failed',
      reason: resumeInfo.outputs.error ?? 'Task failed. Re-submit to retry from scratch.',
      outputs: resumeInfo.outputs,
    })
  }

  // resumePoint === 'after_pm' → replay original userMessage through the Orchestrator
  const subTasks = resumeInfo.outputs.subTasks
  if (!Array.isArray(subTasks) || subTasks.length === 0) {
    return errorResponse('Checkpoint found but subTasks list is empty or invalid', 422)
  }

  const userMessage = resumeInfo.outputs.userMessage
    ?? resumeInfo.outputs.pmMessage
    ?? '(resume)'

  try {
    const orchestrator = getDefaultContainer().resolve(Services.Orchestrator) as Orchestrator
    const result = await orchestrator.executeUserRequest(userMessage)

    return successResponse({
      resumed: true,
      taskId,
      newTaskId: result.tasks?.[0]?.id,
      resumePoint: 'after_pm',
      workflowResult: {
        success: result.success,
        messages: result.messages,
        tasks: result.tasks,
        stats: result.stats,
        failedTasks: result.failedTasks,
      },
    })
  } catch (error) {
    return errorResponse(error, 500, 'Task Resume API')
  }
}
