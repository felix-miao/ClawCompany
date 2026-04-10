jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/security/utils', () => ({
  InputValidator: {
    sanitize: (str: string) => str.replace(/[`$]/g, ''),
  },
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
}))

jest.mock('@/lib/gateway/client', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    sessions_send: jest.fn(),
  }

  return {
    OpenClawGatewayClient: jest.fn(() => mockClient),
    createGatewayClient: jest.fn(() => mockClient),
    __mockClient: mockClient,
  }
})

import { POST } from '../route'
import { __mockClient } from '@/lib/gateway/client'

const API_KEY = 'test-api-key-12345678901234567890'

function createMockRequest(body: Record<string, unknown>, options?: { noAuth?: boolean }) {
  const headers: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    'content-type': 'application/json',
    ...(options?.noAuth ? {} : { 'x-api-key': API_KEY }),
  }
  return {
    url: 'http://localhost/api/openclaw/send',
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
    json: () => Promise.resolve(body),
  }
}

describe('/api/openclaw/send', () => {
  const originalApiKey = process.env.AGENT_API_KEY

  beforeAll(() => {
    process.env.AGENT_API_KEY = API_KEY
  })

  afterAll(() => {
    if (originalApiKey) {
      process.env.AGENT_API_KEY = originalApiKey
    } else {
      delete process.env.AGENT_API_KEY
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    __mockClient.connect.mockResolvedValue(undefined)
    __mockClient.disconnect.mockResolvedValue(undefined)
  })

  it('should send message successfully', async () => {
    __mockClient.sessions_send.mockResolvedValue({
      status: 'sent',
      messageId: 'msg-123',
    })

    const request = createMockRequest({
      sessionKey: 'agent:main:subagent:abc',
      message: 'Hello agent',
    })
    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.result.status).toBe('sent')
    expect(data.result.messageId).toBe('msg-123')
  })

  it('should return 400 when sessionKey is missing', async () => {
    const request = createMockRequest({
      message: 'Hello agent',
    })
    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain('sessionKey')
  })

  it('should return 400 when message is missing', async () => {
    const request = createMockRequest({
      sessionKey: 'agent:main:subagent:abc',
    })
    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain('message')
  })

  it('should return 401 without API key', async () => {
    const request = createMockRequest({
      sessionKey: 'agent:main:subagent:abc',
      message: 'Hello',
    }, { noAuth: true })

    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('should handle gateway errors gracefully', async () => {
    __mockClient.sessions_send.mockRejectedValue(new Error('Session not found'))

    const request = createMockRequest({
      sessionKey: 'agent:main:subagent:nonexistent',
      message: 'Hello',
    })
    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
  })
})
