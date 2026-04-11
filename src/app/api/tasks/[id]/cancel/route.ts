/**
 * POST /api/tasks/:id/cancel — Kill switch: gracefully cancel a running task/workflow
 *
 * Behaviour:
 * - Signals the Orchestrator's AbortController → current agent round completes,
 *   then no new rounds/levels start.
 * - Updates the task status to 'cancelled' in the TaskManager.
 * - Returns immediately (cancel is async — polling /status will show 'cancelled').
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, checkRateLimit, successResponse, errorResponse } from '@/lib/api/route-utils'
import { getDefaultContainer, Services } from '@/lib/core/services'
import type { Orchestrator } from '@/lib/orchestrator'
import type { TaskManager } from '@/lib/tasks/manager'

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

  try {
    const container = getDefaultContainer()
    const orchestrator = container.resolve(Services.Orchestrator) as Orchestrator
    const taskManager = container.resolve(Services.TaskManager) as TaskManager

    // Check the task exists
    const task = taskManager.getTask(taskId)
    if (!task) {
      return errorResponse(`Task ${taskId} not found`, 404)
    }

    // Already in a terminal state
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return successResponse({
        cancelled: false,
        taskId,
        reason: `Task is already in terminal state: ${task.status}`,
        status: task.status,
      })
    }

    // Signal the orchestrator to stop after the current agent round
    orchestrator.cancelWorkflow()

    // Mark this specific task as cancelled immediately so UI reflects it
    try {
      taskManager.updateTaskStatus(taskId, 'cancelled')
    } catch {
      // If the state transition isn't valid right now, we still signalled the abort
      // The orchestrator loop will cancel remaining tasks itself
    }

    return successResponse({
      cancelled: true,
      taskId,
      message: 'Cancel signal sent. The workflow will stop after the current agent round completes.',
      status: 'cancelled',
    })
  } catch (error) {
    return errorResponse(error, 500, 'Task Cancel API')
  }
}
