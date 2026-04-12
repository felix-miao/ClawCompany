import { ReadableStream as NodeReadableStream } from 'node:stream/web'

jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(url: string) {}
  },
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/api/route-utils', () => ({
  getClientId: () => 'mock-ip',
  withAuth: jest.fn((handler) => handler),
  withRateLimit: jest.fn((handler) => handler),
  successResponse: jest.fn(),
}))

jest.mock('@/lib/gateway/session-poller', () => ({
  getSessionPoller: jest.fn(() => null),
}))

import { getSessionPoller } from '@/lib/gateway/session-poller'
import { GET, getConnectionStats, resetConnectionCounters, acquireConnection, releaseConnection } from '../route'

describe('SSE Global Connection Limit', () => {
  beforeAll(() => {
    ;(globalThis as any).ReadableStream = NodeReadableStream
    ;(globalThis as any).Response = class Response {
      body: unknown
      headers: unknown
      status: number

      constructor(body?: unknown, init?: { headers?: unknown; status?: number }) {
        this.body = body
        this.headers = init?.headers
        this.status = init?.status ?? 200
      }
    }
  })

  beforeEach(() => {
    resetConnectionCounters()
  })

  afterEach(() => {
    resetConnectionCounters()
  })

  it('should track active connections correctly', () => {
    const stats = getConnectionStats()
    expect(stats.totalConnections).toBe(0)
    expect(stats.sseSubscriberCount).toBe(0)
  })

  it('should handle multiple IPs correctly', () => {
    for (let i = 0; i < 10; i++) {
      acquireConnection(`192.168.1.${i}`)
    }
    
    const stats = getConnectionStats()
    expect(stats.totalConnections).toBe(10)
  })

  it('should release connections correctly', () => {
    acquireConnection('10.0.0.1')
    acquireConnection('10.0.0.1')
    releaseConnection('10.0.0.1')
    
    const stats = getConnectionStats()
    expect(stats.totalConnections).toBe(1)
  })

  it('should enforce MAX_SSE_CONNECTIONS=100 global limit', () => {
    for (let i = 0; i < 100; i++) {
      const result = acquireConnection(`10.0.0.${i}`)
      expect(result).toBe(true)
    }
    
    const overLimit = acquireConnection('10.0.0.100')
    expect(overLimit).toBe(false)
  })

  it('should enforce MAX_SSE_PER_IP=5 per IP limit', () => {
    for (let i = 0; i < 5; i++) {
      const result = acquireConnection('192.168.1.50')
      expect(result).toBe(true)
    }
    
    const overLimit = acquireConnection('192.168.1.50')
    expect(overLimit).toBe(false)
  })

  it('should stop the shared poller when the last SSE subscriber disconnects', async () => {
    const start = jest.fn()
    const stop = jest.fn()
    ;(getSessionPoller as jest.Mock).mockReturnValue({
      isRunning: () => false,
      start,
      stop,
    })

    const controller = new AbortController()
    const request = {
      url: 'http://localhost/api/game-events',
      headers: { get: () => null },
      signal: controller.signal,
    } as any

    await GET(request)

    expect(start).toHaveBeenCalledTimes(1)
    expect(getConnectionStats().sseSubscriberCount).toBe(1)

    controller.abort()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(stop).toHaveBeenCalledTimes(1)
    expect(getConnectionStats().sseSubscriberCount).toBe(0)
  })
})
