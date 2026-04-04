import { NextRequest } from 'next/server'

import { withAuth, withRateLimit, withErrorHandling, successResponse, errorResponse } from '@/lib/api/route-utils'
import { InputValidator } from '@/lib/security/utils'

const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789'

const POLL_MAX_ATTEMPTS = 30
const POLL_INTERVAL_MS = 2000

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
    console.log('[OpenClaw API] Session spawned:', data.sessionKey)

    const result = await pollForResult(data.sessionKey)

    return successResponse({
      messages: result.messages,
      sessionKey: data.sessionKey,
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

async function pollForResult(sessionKey: string): Promise<{ messages: Array<{ agent: string; content: string; timestamp: string }> }> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    try {
      const response = await fetch(
        `${OPENCLAW_GATEWAY_URL}/api/sessions/history?sessionKey=${sessionKey}&limit=10`,
      )

      if (!response.ok) {
        throw new Error(`History fetch error: ${response.status}`)
      }

      const history = await response.json()

      if (history && history.length > 0) {
        const lastMessage = history[0]

        if (lastMessage.status === 'completed') {
          return {
            messages: [{
              agent: 'pm',
              content: lastMessage.content,
              timestamp: new Date().toISOString(),
            }],
          }
        }

        if (lastMessage.status === 'failed') {
          throw new Error(`Session failed: ${lastMessage.content}`)
        }
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    } catch (error) {
      console.error('[OpenClaw API] Poll error:', error)
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }

  throw new Error('Polling timeout')
}