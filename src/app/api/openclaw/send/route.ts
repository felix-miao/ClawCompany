import { NextRequest } from 'next/server'

import { withAuth, successResponse, errorResponse } from '@/lib/api/route-utils'
import { createGatewayClient } from '@/lib/gateway/client'

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const { sessionKey, message } = body as { sessionKey?: string; message?: string }

  if (!sessionKey || typeof sessionKey !== 'string') {
    return errorResponse('Missing or invalid sessionKey', 400)
  }

  if (!message || typeof message !== 'string') {
    return errorResponse('Missing or invalid message', 400)
  }

  const client = createGatewayClient()

  try {
    await client.connect()
    const result = await client.sessions_send(sessionKey, message)
    await client.disconnect()

    return successResponse({ result })
  } catch (error) {
    await client.disconnect().catch(() => {})
    return errorResponse(error, undefined, 'OpenClaw Send API')
  }
}, 'OpenClaw Send API')
