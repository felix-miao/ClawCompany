import { NextRequest } from 'next/server'

import { withAuth, withRateLimit, successResponse, errorResponse } from '@/lib/api/route-utils'
import { InputValidator } from '@/lib/security/utils'

// Route segment config: allow longer max duration for streaming use cases
export const maxDuration = 300

const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789'

export const POST = withAuth(withRateLimit(async (request: NextRequest) => {
  const body = await request.json()
  const { action, userRequest } = body

  if (action !== 'orchestrate') {
    return errorResponse('Invalid action', 400)
  }

  if (!userRequest || typeof userRequest !== 'string') {
    return errorResponse('User request is required', 400)
  }

  const sanitizedRequest = InputValidator.sanitize(userRequest)

  try {
    const response = await fetch(`${OPENCLAW_GATEWAY_URL}/api/sessions/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: sanitizedRequest,
        model: 'zai/glm-5',
        thinking: 'high',
      }),
    })

    if (!response.ok) {
      return errorResponse(`Gateway request failed: ${response.status}`, 500)
    }

    const data = await response.json()
    const sessionKey = data.sessionKey
    console.log('[OpenClaw API] Session spawned:', sessionKey)

    // P0-B fix: immediately return sessionKey instead of blocking 60s poll.
    // Frontend should listen for results via the /api/game-events SSE stream,
    // which polls the gateway and emits session:completed events.
    return successResponse({
      status: 'started',
      sessionKey,
    }, request)
  } catch (error) {
    return errorResponse(error, 500, 'OpenClaw API')
  }
}, 'OpenClaw API'))

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const response = await fetch(`${OPENCLAW_GATEWAY_URL}/api/status`)

    if (!response.ok) {
      return successResponse({
        connected: false,
        error: `Gateway returned ${response.status}`,
      })
    }

    const data = await response.json()

    return successResponse({ connected: true, gateway: data })
  } catch (error) {
    return successResponse({
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}, 'OpenClaw Status API')
