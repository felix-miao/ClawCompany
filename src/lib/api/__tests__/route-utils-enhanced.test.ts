import {
  errorResponse,
  successResponse,
  withErrorHandling,
  withRateLimit,
  withRecovery,
  getClientId,
  checkRateLimit,
} from '../route-utils'

import { RateLimiter } from '@/lib/security/utils'
import { AppError, ValidationError, AgentError, ErrorCategory, ErrorSeverity } from '@/lib/core/errors'
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

describe('route-utils (enhanced)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('errorResponse (enhanced)', () => {
    it('should include error code and category for AppError', async () => {
      const error = new ValidationError('bad input', { field: 'email' })
      const response = errorResponse(error)
      const data = await response.json()
      expect(data.error).toBe('bad input')
      expect(data.code).toBe('VALIDATION_ERROR')
      expect(data.category).toBe(ErrorCategory.VALIDATION)
      expect(response.status).toBe(400)
    })

    it('should map AppError severity to HTTP status', async () => {
      const critical = new AppError('SYS_001', 'critical error', ErrorCategory.SYSTEM, {
        severity: ErrorSeverity.CRITICAL,
      })
      const response = errorResponse(critical)
      expect(response.status).toBe(500)
    })

    it('should map validation errors to 400', async () => {
      const error = new ValidationError('invalid field')
      const response = errorResponse(error)
      expect(response.status).toBe(400)
    })

    it('should preserve backward compat with plain errors', async () => {
      const response = errorResponse(new Error('plain error'))
      const data = await response.json()
      expect(data.error).toBe('plain error')
      expect(response.status).toBe(500)
    })

    it('should preserve backward compat with string errors', async () => {
      const response = errorResponse('string error', 400)
      const data = await response.json()
      expect(data.error).toBe('string error')
      expect(response.status).toBe(400)
    })

    it('should preserve backward compat with object errors', async () => {
      const response = errorResponse({ error: 'object error' }, 400)
      const data = await response.json()
      expect(data.error).toBe('object error')
    })

    it('should handle unknown error types', async () => {
      const response = errorResponse(null)
      const data = await response.json()
      expect(data.error).toBe('Unknown error')
    })
  })

  describe('withRecovery', () => {
    it('should wrap handler with error recovery', async () => {
      const handler = jest.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ success: true }),
      })
      const wrapped = withRecovery(handler, 'TestRecovery')
      const request = { headers: { get: () => '1.2.3.4' } } as any
      const response = await wrapped(request)
      expect(response.status).toBe(200)
    })

    it('should attempt recovery on AppError', async () => {
      const handler = jest.fn()
        .mockRejectedValueOnce(new AgentError('temp fail', 'dev'))
        .mockResolvedValueOnce({ status: 200, json: async () => ({ success: true }) })
      const wrapped = withRecovery(handler, 'TestRecovery')
      const request = { headers: { get: () => '1.2.3.4' } } as any
      const response = await wrapped(request)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(response.status).toBe(200)
    })

    it('should return error response when recovery fails', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('persistent fail'))
      const wrapped = withRecovery(handler, 'TestRecovery')
      const request = { headers: { get: () => '1.2.3.4' } } as any
      const response = await wrapped(request)
      expect(response.status).toBe(500)
    })
  })

  describe('withErrorHandling (enhanced)', () => {
    it('should log AppError with structured context', async () => {
      const loggerSpy = jest.spyOn(logger, 'error').mockImplementation()
      const error = new AgentError('agent failed', 'pm', { taskId: 'task-1' })
      const handler = jest.fn().mockRejectedValue(error)
      const wrapped = withErrorHandling(handler, 'TestAgent')
      const request = { url: 'http://localhost/test' } as any
      await wrapped(request)
      expect(loggerSpy).toHaveBeenCalled()
      loggerSpy.mockRestore()
    })
  })
})
