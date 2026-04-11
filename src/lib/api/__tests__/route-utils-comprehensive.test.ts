import {
  errorResponse,
  successResponse,
  withErrorHandling,
  withRateLimit,
  withRecovery,
  withAuth,
  requireApiKey,
  getClientId,
  checkRateLimit,
} from '../route-utils'

import { RateLimiter } from '@/lib/security/utils'
import * as rateLimiterModule from '@/lib/security/rate-limiter'
import { AppError, ValidationError, AgentError, LLMError, GatewayError, ErrorCategory, ErrorSeverity } from '@/lib/core/errors'
import { logger } from '@/lib/core/logger'

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/security/utils', () => ({
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
}))

jest.mock('@/lib/security/rate-limiter', () => ({
  check: jest.fn((_ip: string) => ({
    allowed: true,
    remaining: 9,
    limit: 10,
    resetAt: Date.now() + 60000,
  })),
  getRemaining: jest.fn(() => 9),
}))

describe('route-utils comprehensive', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('errorResponse - all error category mappings', () => {
    it('should map GATEWAY error to 502', async () => {
      const error = new GatewayError('upstream failure')
      const response = errorResponse(error)
      expect(response.status).toBe(502)
      const data = await response.json()
      expect(data.error).toBe('upstream failure')
      expect(data.category).toBe(ErrorCategory.GATEWAY)
    })

    it('should map LLM error to 503', async () => {
      const error = new LLMError('model unavailable', 'glm')
      const response = errorResponse(error)
      expect(response.status).toBe(503)
      const data = await response.json()
      expect(data.error).toBe('model unavailable')
      expect(data.category).toBe(ErrorCategory.LLM)
    })

    it('should map SYSTEM error to 500', async () => {
      const error = new AppError('SYS_001', 'system failure', ErrorCategory.SYSTEM)
      const response = errorResponse(error)
      expect(response.status).toBe(500)
    })

    it('should map AGENT error to 500', async () => {
      const error = new AgentError('agent crash', 'dev')
      const response = errorResponse(error)
      expect(response.status).toBe(500)
    })

    it('should map ORCHESTRATOR error to 500', async () => {
      const error = new AppError('ORCH_001', 'orchestration failed', ErrorCategory.ORCHESTRATOR)
      const response = errorResponse(error)
      expect(response.status).toBe(500)
    })

    it('should map NETWORK error to 500', async () => {
      const error = new AppError('NET_001', 'network timeout', ErrorCategory.NETWORK)
      const response = errorResponse(error)
      expect(response.status).toBe(500)
    })

    it('should map FILESYSTEM error to 500', async () => {
      const error = new AppError('FS_001', 'disk full', ErrorCategory.FILESYSTEM)
      const response = errorResponse(error)
      expect(response.status).toBe(500)
    })

    it('should use LOW severity override to 400', async () => {
      const error = new AppError('CUSTOM_001', 'low severity', ErrorCategory.SYSTEM, {
        severity: ErrorSeverity.LOW,
      })
      const response = errorResponse(error)
      expect(response.status).toBe(400)
    })

    it('should allow explicit status override for AppError', async () => {
      const error = new ValidationError('bad input')
      const response = errorResponse(error, 422)
      expect(response.status).toBe(422)
    })

    it('should include code and category in response for AppError', async () => {
      const error = new ValidationError('test')
      const response = errorResponse(error)
      const data = await response.json()
      expect(data.code).toBe('VALIDATION_ERROR')
      expect(data.category).toBe(ErrorCategory.VALIDATION)
      expect(data.success).toBe(false)
    })

    it('should handle boolean true as error', async () => {
      const response = errorResponse(true)
      const data = await response.json()
      expect(data.error).toBe('Unknown error')
    })

    it('should handle object with neither error nor message property', async () => {
      const response = errorResponse({ foo: 'bar' })
      const data = await response.json()
      expect(data.error).toBe('Unknown error')
    })
  })

  describe('requireApiKey', () => {
    const originalEnv = process.env.AGENT_API_KEY

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.AGENT_API_KEY = originalEnv
      } else {
        delete process.env.AGENT_API_KEY
      }
    })

    it('should return 500 when AGENT_API_KEY not configured', async () => {
      delete process.env.AGENT_API_KEY
      const request = {
        headers: { get: () => null },
      } as any
      const response = requireApiKey(request)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(500)
      const data = await response!.json()
      expect(data.error).toBe('Server authentication not configured')
    })

    it('should accept x-api-key header', () => {
      process.env.AGENT_API_KEY = 'my-secret-key'
      const request = {
        headers: {
          get: (name: string) => {
            if (name === 'x-api-key') return 'my-secret-key'
            return null
          },
        },
      } as any
      const result = requireApiKey(request)
      expect(result).toBeNull()
    })

    it('should accept Authorization Bearer header', async () => {
      process.env.AGENT_API_KEY = 'my-secret-key'
      const request = {
        headers: {
          get: (name: string) => {
            if (name === 'x-api-key') return null
            if (name === 'authorization') return 'Bearer my-secret-key'
            return null
          },
        },
      } as any
      const result = requireApiKey(request)
      expect(result).toBeNull()
    })

    it('should accept case-insensitive Bearer prefix', async () => {
      process.env.AGENT_API_KEY = 'my-secret-key'
      const request = {
        headers: {
          get: (name: string) => {
            if (name === 'x-api-key') return null
            if (name === 'authorization') return 'bearer my-secret-key'
            return null
          },
        },
      } as any
      const result = requireApiKey(request)
      expect(result).toBeNull()
    })

    it('should return 401 when key does not match', async () => {
      process.env.AGENT_API_KEY = 'my-secret-key'
      const request = {
        headers: {
          get: (name: string) => {
            if (name === 'x-api-key') return 'wrong-key'
            return null
          },
        },
      } as any
      const response = requireApiKey(request)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(401)
      const data = await response!.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 when no key provided', async () => {
      process.env.AGENT_API_KEY = 'my-secret-key'
      const request = {
        headers: { get: () => null },
      } as any
      const response = requireApiKey(request)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(401)
    })
  })

  describe('withAuth', () => {
    const originalEnv = process.env.AGENT_API_KEY

    beforeEach(() => {
      process.env.AGENT_API_KEY = 'test-key'
    })

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.AGENT_API_KEY = originalEnv
      } else {
        delete process.env.AGENT_API_KEY
      }
    })

    it('should return auth error when key missing', async () => {
      const handler = jest.fn().mockResolvedValue({ status: 200, json: async () => ({ success: true }) })
      const wrapped = withAuth(handler, 'Test')
      const request = { headers: { get: () => null } } as any
      const response = await wrapped(request)
      expect(response.status).toBe(401)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should call handler when authenticated', async () => {
      const handler = jest.fn().mockResolvedValue({ status: 200, json: async () => ({ success: true }) })
      const wrapped = withAuth(handler, 'Test')
      const request = {
        headers: { get: (n: string) => n === 'x-api-key' ? 'test-key' : null },
      } as any
      const response = await wrapped(request)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(200)
    })

    it('should catch handler errors and return errorResponse', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('handler exploded'))
      const wrapped = withAuth(handler, 'TestAuth')
      const request = {
        headers: { get: (n: string) => n === 'x-api-key' ? 'test-key' : null },
      } as any
      const response = await wrapped(request)
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('handler exploded')
    })

    it('should catch AppError in handler and map to correct status', async () => {
      const handler = jest.fn().mockRejectedValue(new ValidationError('invalid'))
      const wrapped = withAuth(handler, 'TestAuth')
      const request = {
        headers: { get: (n: string) => n === 'x-api-key' ? 'test-key' : null },
      } as any
      const response = await wrapped(request)
      expect(response.status).toBe(400)
    })
  })

  describe('withRecovery', () => {
    it('should return success on first attempt', async () => {
      const handler = jest.fn().mockResolvedValue({ status: 200, json: async () => ({}) })
      const wrapped = withRecovery(handler, 'TestRecovery')
      const request = { headers: { get: () => '1.2.3.4' } } as any
      const response = await wrapped(request)
      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should retry on non-critical error and succeed', async () => {
      const handler = jest.fn()
        .mockRejectedValueOnce(new Error('temp fail'))
        .mockResolvedValueOnce({ status: 200, json: async () => ({}) })
      const wrapped = withRecovery(handler, 'TestRecovery')
      const request = { headers: { get: () => '1.2.3.4' } } as any
      const response = await wrapped(request)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(response.status).toBe(200)
    })

    it('should not retry on CRITICAL severity error', async () => {
      const handler = jest.fn().mockRejectedValue(
        new AppError('CRIT_001', 'critical failure', ErrorCategory.SYSTEM, {
          severity: ErrorSeverity.CRITICAL,
        })
      )
      const loggerSpy = jest.spyOn(logger, 'error').mockImplementation()
      const wrapped = withRecovery(handler, 'TestRecovery')
      const request = { headers: { get: () => '1.2.3.4' } } as any
      const response = await wrapped(request)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(500)
      loggerSpy.mockRestore()
    })

    it('should return error after max retries exhausted', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('persistent'))
      const wrapped = withRecovery(handler, 'TestRecovery')
      const request = { headers: { get: () => '1.2.3.4' } } as any
      const response = await wrapped(request)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('persistent')
    })

    it('should warn on retry attempts', async () => {
      const handler = jest.fn()
        .mockRejectedValueOnce(new Error('first fail'))
        .mockResolvedValueOnce({ status: 200, json: async () => ({}) })
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation()
      const wrapped = withRecovery(handler, 'TestRecovery')
      const request = { headers: { get: () => '1.2.3.4' } } as any
      await wrapped(request)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('successResponse', () => {
    it('should include remaining when request provided', () => {
      ;(rateLimiterModule.getRemaining as jest.Mock).mockReturnValue(42)
      const request = {
        headers: { get: (n: string) => n === 'x-forwarded-for' ? '1.2.3.4' : null },
      } as any
      const response = successResponse({ items: [1, 2] }, request)
      expect(response.status).toBe(200)
    })

    it('should work without request', () => {
      const response = successResponse({ data: 'test' })
      expect(response.status).toBe(200)
    })
  })

  describe('checkRateLimit', () => {
    it('should return 429 with remaining count', async () => {
      ;(rateLimiterModule.check as jest.Mock).mockReturnValue({
        allowed: false,
        remaining: 0,
        limit: 10,
        resetAt: Date.now() + 60000,
        retryAfter: 30,
      })
      const request = {
        headers: { get: () => '1.2.3.4' },
      } as any
      const response = checkRateLimit(request)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(429)
      const data = await response!.json()
      expect(data.remaining).toBe(0)
    })
  })

  describe('withErrorHandling', () => {
    it('should handle non-AppError errors', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('generic error'))
      const wrapped = withErrorHandling(handler, 'Test')
      const request = { url: 'http://localhost/test' } as any
      const response = await wrapped(request)
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('generic error')
    })

    it('should handle string thrown as error', async () => {
      const handler = jest.fn().mockImplementation(() => { throw 'string error' })
      const wrapped = withErrorHandling(handler, 'Test')
      const request = { url: 'http://localhost/test' } as any
      const response = await wrapped(request)
      expect(response.status).toBe(500)
    })

    it('should use default context when not provided', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('fail'))
      const wrapped = withErrorHandling(handler)
      const request = { url: 'http://localhost/test' } as any
      const response = await wrapped(request)
      expect(response.status).toBe(500)
    })
  })
})
