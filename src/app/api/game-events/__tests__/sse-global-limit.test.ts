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
  createSessionPoller: jest.fn(() => null),
}))

import { getConnectionStats, resetConnectionCounters, acquireConnection, releaseConnection } from '../route'

describe('SSE Global Connection Limit', () => {
  beforeEach(() => {
    resetConnectionCounters()
  })

  afterEach(() => {
    resetConnectionCounters()
  })

  it('should track active connections correctly', () => {
    const stats = getConnectionStats()
    expect(stats.totalConnections).toBe(0)
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
})