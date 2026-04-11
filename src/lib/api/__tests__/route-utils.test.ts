import {
  errorResponse,
  successResponse,
  withErrorHandling,
  withRateLimit,
  withAuth,
  requireApiKey,
  getClientId,
  checkRateLimit,
} from '../route-utils'

import { RateLimiter } from '@/lib/security/utils'

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

jest.mock('@/lib/core/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

describe('route-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('errorResponse', () => {
    it('should preserve string error messages', async () => {
      const response = errorResponse('Invalid file path', 400)
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid file path')
    })

    it('should preserve Error object messages', async () => {
      const response = errorResponse(new Error('Something broke'), 500)
      const data = await response.json()
      expect(response.status).toBe(500)
      expect(data.error).toBe('Something broke')
    })

    it('should stringify object errors with error property', async () => {
      const response = errorResponse({ error: '消息不能为空' }, 400)
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.error).toBe('消息不能为空')
    })

    it('should stringify object errors with message property', async () => {
      const response = errorResponse({ message: 'validation failed' }, 400)
      const data = await response.json()
      expect(data.error).toBe('validation failed')
    })

    it('should handle unknown error types gracefully', async () => {
      const response = errorResponse(null, 500)
      const data = await response.json()
      expect(response.status).toBe(500)
      expect(data.error).toBe('Unknown error')
    })

    it('should default to status 500 when not specified', () => {
      const response = errorResponse('error')
      expect(response.status).toBe(500)
    })

    it('should handle number errors', async () => {
      const response = errorResponse(42, 500)
      const data = await response.json()
      expect(data.error).toBe('Unknown error')
    })

    it('should handle undefined errors', async () => {
      const response = errorResponse(undefined, 500)
      const data = await response.json()
      expect(data.error).toBe('Unknown error')
    })
  })

  describe('successResponse', () => {
    it('should return success response with data', () => {
      const response = successResponse({ items: [1, 2, 3] })
      expect(response.status).toBe(200)
    })
  })

  describe('getClientId', () => {
    it('should extract x-forwarded-for header', () => {
      const request = {
        headers: {
          get: (name: string) => name === 'x-forwarded-for' ? '1.2.3.4' : null,
        },
      } as any
      expect(getClientId(request)).toBe('1.2.3.4')
    })

    it('should default to unknown when header missing', () => {
      const request = {
        headers: {
          get: () => null,
        },
      } as any
      expect(getClientId(request)).toBe('unknown')
    })
  })

  describe('checkRateLimit', () => {
    it('should return null when rate limit is not exceeded', () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)

      const request = {
        headers: {
          get: () => '1.2.3.4',
        },
      } as any

      expect(checkRateLimit(request)).toBeNull()
    })

    it('should return 429 response when rate limit exceeded', () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(false)
      ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(0)

      const request = {
        headers: {
          get: () => '1.2.3.4',
        },
      } as any

      const response = checkRateLimit(request)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(429)
    })
  })

  describe('withErrorHandling', () => {
    it('should catch errors and return error response', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('handler failed'))
      const wrapped = withErrorHandling(handler, 'Test')
      const request = { url: 'http://localhost/test' } as any

      const response = await wrapped(request)
      expect(response.status).toBe(500)
    })

    it('should pass through successful responses', async () => {
      const handler = jest.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ success: true }),
      })
      const wrapped = withErrorHandling(handler, 'Test')
      const request = { url: 'http://localhost/test' } as any

      const response = await wrapped(request)
      expect(response.status).toBe(200)
    })
  })

  describe('requireApiKey', () => {
    const originalEnv = process.env

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    function makeRequest(headers: Record<string, string>): any {
      return {
        headers: {
          get: (name: string) => headers[name] ?? null,
        },
      }
    }

    it('should return null (open access) when AGENT_API_KEY is not set', () => {
      delete process.env.AGENT_API_KEY
      const response = requireApiKey(makeRequest({}) as any)
      expect(response).toBeNull()
    })

    it('should return 401 when no key is provided in headers', () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const response = requireApiKey(makeRequest({}) as any)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(401)
    })

    it('should return 401 for wrong key via x-api-key', async () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const response = requireApiKey(makeRequest({ 'x-api-key': 'wrong-key-value-xxxx' }) as any)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(401)
    })

    it('should return null for correct key via x-api-key', () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const response = requireApiKey(makeRequest({ 'x-api-key': 'test-secret-key-1234567890' }) as any)
      expect(response).toBeNull()
    })

    it('should return 401 for wrong key via Authorization Bearer', () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const response = requireApiKey(makeRequest({ authorization: 'Bearer wrong-key-val-xxxx' }) as any)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(401)
    })

    it('should return null for correct key via Authorization Bearer', () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const response = requireApiKey(makeRequest({ authorization: 'Bearer test-secret-key-1234567890' }) as any)
      expect(response).toBeNull()
    })

    it('should handle case-insensitive Bearer prefix', () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const response = requireApiKey(makeRequest({ authorization: 'bearer test-secret-key-1234567890' }) as any)
      expect(response).toBeNull()
    })

    it('should use timing-safe comparison (different lengths)', () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const response = requireApiKey(makeRequest({ 'x-api-key': 'short' }) as any)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(401)
    })

    it('should reject key that is a prefix of the correct key', () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const response = requireApiKey(makeRequest({ 'x-api-key': 'test-secret-key' }) as any)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(401)
    })
  })

  describe('withAuth', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should call handler when AGENT_API_KEY is not set (open access mode)', async () => {
      delete process.env.AGENT_API_KEY
      const handler = jest.fn().mockResolvedValue({ status: 200 })
      const wrapped = withAuth(handler, 'Test')
      const request = { headers: { get: () => null } } as any

      const response = await wrapped(request)
      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalled()
    })

    it('should call handler when authenticated', async () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const handler = jest.fn().mockResolvedValue({ status: 200 })
      const wrapped = withAuth(handler, 'Test')
      const request = {
        headers: {
          get: (name: string) => name === 'x-api-key' ? 'test-secret-key-1234567890' : null,
        },
      } as any

      const response = await wrapped(request)
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })

    it('should handle handler errors through errorResponse', async () => {
      process.env.AGENT_API_KEY = 'test-secret-key-1234567890'
      const handler = jest.fn().mockRejectedValue(new Error('boom'))
      const wrapped = withAuth(handler, 'Test')
      const request = {
        headers: {
          get: (name: string) => name === 'x-api-key' ? 'test-secret-key-1234567890' : null,
        },
      } as any

      const response = await wrapped(request)
      expect(response.status).toBe(500)
    })
  })
})
