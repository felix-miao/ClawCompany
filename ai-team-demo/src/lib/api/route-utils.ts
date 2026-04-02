import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter } from '@/lib/security/utils'

export function getClientId(request: NextRequest): string {
  return request.headers.get('x-forwarded-for') || 'unknown'
}

export function checkRateLimit(request: NextRequest): NextResponse | null {
  const clientId = getClientId(request)
  if (!RateLimiter.isAllowed(clientId)) {
    return NextResponse.json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      remaining: RateLimiter.getRemaining(clientId)
    }, { status: 429 })
  }
  return null
}

export function errorResponse(error: unknown, status = 500, context?: string): NextResponse {
  let message: string
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else if (error && typeof error === 'object') {
    message = (error as any).error || (error as any).message || 'Unknown error'
  } else {
    message = 'Unknown error'
  }
  if (context) {
    console.error(`[${context}] Error:`, error)
  } else {
    console.error('API Error:', error)
  }
  return NextResponse.json({ success: false, error: message }, { status })
}

export function successResponse(data: Record<string, unknown>, request?: NextRequest): NextResponse {
  const response: Record<string, unknown> = { success: true, ...data }
  if (request) {
    const clientId = getClientId(request)
    response.remaining = RateLimiter.getRemaining(clientId)
  }
  return NextResponse.json(response)
}

type RouteHandler = (request: NextRequest) => Promise<NextResponse>

export function withRateLimit(handler: RouteHandler, context?: string): RouteHandler {
  return async (request: NextRequest) => {
    try {
      const rateLimitResponse = checkRateLimit(request)
      if (rateLimitResponse) return rateLimitResponse

      return await handler(request)
    } catch (error) {
      return errorResponse(error, 500, context)
    }
  }
}

export function withErrorHandling(handler: RouteHandler, context?: string): RouteHandler {
  return async (request: NextRequest) => {
    try {
      return await handler(request)
    } catch (error) {
      return errorResponse(error, 500, context)
    }
  }
}
