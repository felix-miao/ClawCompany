import { NextRequest } from 'next/server'

import { withAuth, withRateLimit, successResponse, errorResponse } from '@/lib/api/route-utils'
import { InputValidator } from '@/lib/security/utils'

const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789'
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN

function gatewayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (OPENCLAW_GATEWAY_TOKEN) {
    headers['Authorization'] = `Bearer ${OPENCLAW_GATEWAY_TOKEN}`
  }
  return headers
}

/**
 * POST /api/openclaw
 *
 * Spawns an agent session and returns the sessionKey immediately.
 * The client is responsible for polling GET /api/openclaw?sessionKey=<key>
 * to retrieve the result asynchronously (P0-A fix: no server-side blocking poll).
 */
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
    const response = await fetch(`${OPENCLAW_GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: gatewayHeaders(),
      body: JSON.stringify({
        tool: 'sessions_spawn',
        args: { task: sanitizedRequest, mode: 'run' },
        sessionKey: 'main',
      }),
    })

    if (!response.ok) {
      return errorResponse(`Gateway request failed: ${response.status}`, 500)
    }

    const data = await response.json()
    const sessionKey = data.result?.sessionKey ?? data.result
    console.log('[OpenClaw API] Session spawned:', sessionKey)

    // P0-A fix: return sessionKey immediately — no server-side blocking poll.
    // The client should poll GET /api/openclaw?sessionKey=<key> for the result.
    return successResponse({ sessionKey, status: 'pending' }, request)
  } catch (error) {
    return errorResponse(error, 500, 'OpenClaw API')
  }
}, 'OpenClaw API'))

/**
 * GET /api/openclaw
 *
 * Without ?sessionKey: returns gateway connection status.
 * With ?sessionKey=<key>: polls the session for completion and returns the result
 *   (or { status: 'pending' } if still running).
 *
 * Clients should poll this endpoint every few seconds rather than waiting
 * on a long-lived server-side request.
 */
export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const sessionKey = searchParams.get('sessionKey')

  // Session status poll
  if (sessionKey) {
    try {
      const response = await fetch(`${OPENCLAW_GATEWAY_URL}/tools/invoke`, {
        method: 'POST',
        headers: gatewayHeaders(),
        body: JSON.stringify({
          tool: 'sessions_history',
          args: { sessionKey, limit: 10 },
          sessionKey: 'main',
        }),
      })

      if (!response.ok) {
        return errorResponse(`History fetch error: ${response.status}`, 500)
      }

      const data = await response.json()
      const history = data.result

      if (history && history.length > 0) {
        const lastMessage = history[0]

        if (lastMessage.status === 'completed') {
          return successResponse({
            status: 'completed',
            messages: [{
              agent: 'pm',
              content: lastMessage.content,
              timestamp: new Date().toISOString(),
            }],
            sessionKey,
          })
        }

        if (lastMessage.status === 'failed') {
          return errorResponse(`Session failed: ${lastMessage.content}`, 500)
        }
      }

      return successResponse({ status: 'pending', sessionKey })
    } catch (error) {
      return errorResponse(error, 500, 'OpenClaw Status API')
    }
  }

  // Gateway connection status
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
