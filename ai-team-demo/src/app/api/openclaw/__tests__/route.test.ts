jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/security/utils', () => ({
  InputValidator: {
    validateMessage: (msg: string) => {
      if (!msg || msg.trim().length === 0) {
        return { valid: false, error: 'userRequest is required' }
      }
      if (msg.length > 10000) {
        return { valid: false, error: 'Message too long' }
      }
      return { valid: true }
    },
  },
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
}))

import { POST, GET } from '../route'
import { RateLimiter } from '@/lib/security/utils'

describe('Authentication', () => {
  const originalApiKey = process.env.AGENT_API_KEY

  beforeAll(() => {
    process.env.AGENT_API_KEY = 'test-api-key-12345678901234567890'
  })

  afterAll(() => {
    if (originalApiKey) {
      process.env.AGENT_API_KEY = originalApiKey
    } else {
      delete process.env.AGENT_API_KEY
    }
  })

  it('POST should return 401 without API key', async () => {
    const request = createMockRequest({ body: { action: 'orchestrate', userRequest: 'test' } })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('GET should return 401 without API key', async () => {
    const request = createMockRequest()
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })
})

function createMockRequest(options?: any): any {
  const url = options?.url || 'http://localhost/api/openclaw'
  return {
    url,
    headers: { get: () => '1.2.3.4' },
    json: () => Promise.resolve(options?.body || {}),
  }
}

describe('/api/openclaw', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
    ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(60)
    globalThis.fetch = jest.fn() as any
    fetchSpy = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('POST - Orchestrate', () => {
    it('should reject invalid action', async () => {
      const request = createMockRequest({
        body: { action: 'invalid', userRequest: 'test' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid action')
    })

    it('should reject empty userRequest', async () => {
      const request = createMockRequest({
        body: { action: 'orchestrate', userRequest: '' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should reject missing userRequest', async () => {
      const request = createMockRequest({
        body: { action: 'orchestrate' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
    })

    it('should reject too long userRequest', async () => {
      const request = createMockRequest({
        body: { action: 'orchestrate', userRequest: 'a'.repeat(10001) },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
    })

    it('should handle gateway spawn error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as Response)

      const request = createMockRequest({
        body: { action: 'orchestrate', userRequest: 'Build something' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Gateway error')
    })

    it('should enforce rate limiting', async () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(false)
      ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(0)

      const request = createMockRequest({
        body: { action: 'orchestrate', userRequest: 'test' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
    })

    it('should successfully orchestrate and poll for result', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessionKey: 'session-1' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ status: 'completed', content: 'Analysis done' }]),
        } as Response)

      const request = createMockRequest({
        body: { action: 'orchestrate', userRequest: 'Analyze this' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.messages).toBeDefined()
      expect(data.sessionKey).toBe('session-1')
    })

    it('should handle failed session status', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessionKey: 'session-fail' }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: async () => ([{ status: 'failed', content: 'Error occurred' }]),
        } as Response)

      const request = createMockRequest({
        body: { action: 'orchestrate', userRequest: 'test' },
      })

      jest.useFakeTimers()
      const promise = POST(request)
      await jest.runAllTimersAsync()
      const response = await promise
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
      jest.useRealTimers()
    }, 30000)

    it('should handle poll timeout', async () => {
      jest.useFakeTimers()

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessionKey: 'session-timeout' }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: async () => ([{ status: 'running', content: 'still running' }]),
        } as Response)

      const request = createMockRequest({
        body: { action: 'orchestrate', userRequest: 'test' },
      })

      const promise = POST(request)
      await jest.runAllTimersAsync()
      const response = await promise
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Timeout')

      jest.useRealTimers()
    }, 30000)
  })

  describe('GET - Status', () => {
    it('should return connected status when gateway is up', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '1.0.0' }),
      } as Response)

      const request = createMockRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.connected).toBe(true)
    })

    it('should return disconnected when gateway returns non-ok', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as Response)

      const request = createMockRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.connected).toBe(false)
    })

    it('should handle gateway fetch error', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Connection refused'))

      const request = createMockRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })
})
