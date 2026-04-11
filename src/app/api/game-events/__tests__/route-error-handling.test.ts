jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    json: () => Promise<unknown>
    constructor(url: string, options?: { body?: string }) {
      this.json = async () => options?.body ? JSON.parse(options.body) : {}
    }
  },
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
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
    debug: jest.fn(),
  },
}))

jest.mock('@/lib/gateway/session-poller', () => ({
  getSessionPoller: jest.fn(() => ({
    isRunning: () => false,
    start: jest.fn(),
  })),
  createSessionPoller: jest.fn(() => ({
    isRunning: () => false,
    start: jest.fn(),
  })),
}))

jest.mock('@/lib/api/route-utils', () => ({
  ...jest.requireActual('@/lib/api/route-utils'),
  getClientId: (request: any) => request.headers.get('x-forwarded-for') || 'unknown',
}))

import { POST, GET } from '../route'
import { GameEventStore, setGameEventStore, resetGameEventStore } from '@/game/data/GameEventStore'
import { RateLimiter } from '@/lib/security/utils'
import { createMockNextRequest } from '@/test-utils/next-request-mock'

const API_KEY = 'test-api-key-12345678901234567890'

describe('Game Events API - Error Handling', () => {
  let store: GameEventStore

  beforeAll(() => {
    process.env.AGENT_API_KEY = API_KEY
  })

  beforeEach(() => {
    store = new GameEventStore()
    setGameEventStore(store)
    jest.clearAllMocks()
  })

  afterEach(() => {
    resetGameEventStore()
  })

  describe('POST /api/game-events - validation', () => {
    it('should return 400 when type is missing', async () => {
      const request = createMockNextRequest({
        method: 'POST',
        headers: { 'x-api-key': API_KEY },
        body: {},
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    it('should return 400 when type is empty string', async () => {
      const request = createMockNextRequest({
        method: 'POST',
        headers: { 'x-api-key': API_KEY },
        body: { type: '' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    it('should return success with valid event', async () => {
      const event = {
        type: 'agent:status-change',
        agentId: 'dev1',
        status: 'busy',
      }

      const request = createMockNextRequest({
        method: 'POST',
        headers: { 'x-api-key': API_KEY },
        body: event,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.event).toBeDefined()
      expect(data.event.type).toBe('agent:status-change')
      expect(data.event.timestamp).toBeDefined()
    })

    it('should use provided timestamp when given', async () => {
      const event = {
        type: 'agent:status-change',
        agentId: 'dev1',
        status: 'busy',
        timestamp: 12345,
      }

      const request = createMockNextRequest({
        method: 'POST',
        headers: { 'x-api-key': API_KEY },
        body: event,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.event.timestamp).toBe(12345)
    })
  })

  describe('POST /api/game-events - authentication', () => {
    it('should return 401 without API key', async () => {
      const request = createMockNextRequest({
        method: 'POST',
        noAuth: true,
        body: { type: 'test' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Unauthorized')
    })

    it('should return 401 with wrong API key', async () => {
      const request = createMockNextRequest({
        method: 'POST',
        headers: { 'x-api-key': 'wrong-key-that-is-long-enough' },
        body: { type: 'test' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })
  })

  describe('POST /api/game-events - rate limiting', () => {
    it('should return 429 when rate limit exceeded', async () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(false)
      ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(0)

      const request = createMockNextRequest({
        method: 'POST',
        headers: { 'x-api-key': API_KEY },
        body: { type: 'test' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Rate limit')
    })

    it('should pass through when rate limit not exceeded', async () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
      ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(59)

      const request = createMockNextRequest({
        method: 'POST',
        headers: { 'x-api-key': API_KEY },
        body: { type: 'agent:status-change', agentId: 'dev1', status: 'busy' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('POST /api/game-events - error response format', () => {
    it('should have success: false and error field on validation error', async () => {
      const request = createMockNextRequest({
        method: 'POST',
        headers: { 'x-api-key': API_KEY },
        body: {},
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error')
      expect(typeof data.error).toBe('string')
    })

    it('should have success: true on successful event creation', async () => {
      const request = createMockNextRequest({
        method: 'POST',
        headers: { 'x-api-key': API_KEY },
        body: { type: 'agent:status-change', agentId: 'dev1', status: 'busy' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('event')
      expect(data.event).toHaveProperty('type')
      expect(data.event).toHaveProperty('timestamp')
    })
  })

  describe('GET /api/game-events - authentication', () => {
    it('should return 401 without API key', async () => {
      const request = createMockNextRequest({
        method: 'GET',
        noAuth: true,
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Unauthorized')
    })

    it('should return 401 with wrong API key', async () => {
      const request = createMockNextRequest({
        method: 'GET',
        headers: { 'x-api-key': 'wrong-key-that-is-long-enough' },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })
  })
})
