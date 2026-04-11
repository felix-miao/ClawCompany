import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import { RateLimiter } from '@/lib/security/utils'
import { isAppError, AppError, ErrorCategory, ErrorSeverity } from '@/lib/core/errors'
import { logger } from '@/lib/core/logger'

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

function getHttpStatusForError(error: unknown): number {
  if (isAppError(error)) {
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        return 400
      case ErrorCategory.GATEWAY:
        return 502
      case ErrorCategory.LLM:
        return 503
      default:
        break
    }
    if (error.severity === ErrorSeverity.LOW) return 400
  }
  return 500
}

export function errorResponse(error: unknown, status?: number, context?: string): NextResponse {
  let message: string
  let code: string | undefined
  let category: string | undefined

  if (isAppError(error)) {
    message = error.message
    code = error.code
    category = error.category
    if (status === undefined) {
      status = getHttpStatusForError(error)
    }
    logger.error(`[${context || 'API'}] AppError: ${error.message}`, {
      code: error.code,
      category: error.category,
      severity: error.severity,
      errorContext: error.context,
    })
  } else if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else if (error && typeof error === 'object') {
    message = (error as Record<string, unknown>).error as string || (error as Record<string, unknown>).message as string || 'Unknown error'
  } else {
    message = 'Unknown error'
  }

  if (status === undefined) status = 500

  if (!isAppError(error)) {
    if (context) {
      logger.error(`[${context}] Error: ${message}`)
    } else {
      logger.error(`API Error: ${message}`)
    }
  }

  const body: Record<string, unknown> = { success: false, error: message }
  if (code) body.code = code
  if (category) body.category = category
  return NextResponse.json(body, { status })
}

export function successResponse(data: Record<string, unknown>, request?: NextRequest): NextResponse {
  const response: Record<string, unknown> = { success: true, ...data }
  if (request) {
    const clientId = getClientId(request)
    response.remaining = RateLimiter.getRemaining(clientId)
  }
  return NextResponse.json(response)
}

type RouteHandler = (request: NextRequest) => Response | Promise<Response>

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function requireApiKey(request: NextRequest): NextResponse | null {
  const apiKey = process.env.AGENT_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Server authentication not configured' },
      { status: 500 }
    )
  }

  const headerKey =
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!headerKey || !safeEqual(headerKey, apiKey)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return null
}

export function withAuth(handler: RouteHandler, context?: string): RouteHandler {
  return async (request: NextRequest) => {
    const authError = requireApiKey(request)
    if (authError) return authError

    try {
      return await handler(request)
    } catch (error) {
      return errorResponse(error, undefined, context)
    }
  }
}

export function withRateLimit(handler: RouteHandler, context?: string): RouteHandler {
  return async (request: NextRequest) => {
    try {
      const rateLimitResponse = checkRateLimit(request)
      if (rateLimitResponse) return rateLimitResponse

      return await handler(request)
    } catch (error) {
      return errorResponse(error, undefined, context)
    }
  }
}

export function withErrorHandling(handler: RouteHandler, context?: string): RouteHandler {
  return async (request: NextRequest) => {
    try {
      return await handler(request)
    } catch (error) {
      if (isAppError(error)) {
        logger.error(`[${context || 'API'}] ${error.code}: ${error.message}`, {
          code: error.code,
          category: error.category,
          severity: error.severity,
          ...error.context,
        })
      } else {
        logger.error(`[${context || 'API'}] Unhandled error`, { error })
      }
      return errorResponse(error, undefined, context)
    }
  }
}

export function withRecovery(handler: RouteHandler, context?: string): RouteHandler {
  return async (request: NextRequest) => {
    const maxAttempts = 2
    let lastError: unknown

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await handler(request)
      } catch (error) {
        lastError = error
        if (isAppError(error) && error.severity === ErrorSeverity.CRITICAL) {
          logger.error(`[${context}] Critical error, not retrying`, {
            code: error.code,
            attempt: attempt + 1,
          })
          break
        }
        if (attempt < maxAttempts - 1) {
          logger.warn(`[${context}] Retrying after error (attempt ${attempt + 1})`, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    return errorResponse(lastError, undefined, context)
  }
}
