import { NextRequest } from 'next/server'

import { GitManager } from '@/lib/git/manager'
import { InputValidator } from '@/lib/security/utils'
import { withAuth, withRateLimit, successResponse, errorResponse } from '@/lib/api/route-utils'

const gitManager = new GitManager(process.cwd())

export const POST = withAuth(withRateLimit(async (request: NextRequest) => {
  const body = await request.json()
  const { message, autoPush = false } = body

  if (!message || typeof message !== 'string') {
    return errorResponse('Commit message is required', 400)
  }

  const sanitizedMessage = InputValidator.sanitize(message)

  const result = autoPush
    ? await gitManager.commitAndPush(sanitizedMessage)
    : await gitManager.commit(sanitizedMessage)

  if (!result.success) {
    return errorResponse(result.error || 'Commit failed', 400)
  }

  return successResponse({
    commitHash: result.commitHash,
    message: result.message,
  }, request)
}, 'Git API'))

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'

    if (action === 'status') {
      const status = await gitManager.status()
      return successResponse({ status })
    }

    if (action === 'log') {
      const limit = parseInt(searchParams.get('limit') || '10')
      const log = await gitManager.log(limit)
      return successResponse({ log })
    }

    return errorResponse('Invalid action', 400)
  } catch (error) {
    return errorResponse(error, 500, 'Git API')
  }
}, 'Git API')

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { action, branchName } = body

    if (action === 'create') {
      if (!branchName || !InputValidator.validateAgentId(branchName)) {
        return errorResponse('Invalid branch name', 400)
      }

      await gitManager.createBranch(branchName)
      return successResponse({ branch: branchName })
    }

    if (action === 'checkout') {
      if (!branchName) {
        return errorResponse('Branch name is required', 400)
      }

      await gitManager.checkout(branchName)
      return successResponse({ branch: branchName })
    }

    return errorResponse('Invalid action', 400)
  } catch (error) {
    return errorResponse(error, 500, 'Git API')
  }
}, 'Git API')