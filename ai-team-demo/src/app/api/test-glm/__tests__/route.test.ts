jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/llm/glm', () => ({
  GLMProvider: jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockResolvedValue('你好，我是 GLM-4！'),
  })),
}))

jest.mock('@/lib/security/utils', () => ({
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
}))

import { POST } from '../route'
import { RateLimiter } from '@/lib/security/utils'

const API_KEY = 'test-api-key-12345678901234567890'

interface MockRequestOptions {
  url?: string
  noAuth?: boolean
  headers?: Record<string, string>
  body?: Record<string, unknown> | string
}

function createMockRequest(options?: MockRequestOptions) {
  const url = options?.url || 'http://localhost/api/test-glm'
  const headers: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    'content-type': 'application/json',
    ...(options?.noAuth ? {} : { 'x-api-key': API_KEY }),
    ...(options?.headers || {}),
  }
  return {
    url,
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
    json: () => Promise.resolve(options?.body || {}),
    clone: () => createMockRequest({ ...options, url }),
    text: async () => options?.body ? JSON.stringify(options.body) : '',
    arrayBuffer: async () => new ArrayBuffer(0)
  }
}

describe('Authentication', () => {
  const originalApiKey = process.env.AGENT_API_KEY
  let originalNodeEnv: string | undefined

  beforeAll(() => {
    process.env.AGENT_API_KEY = API_KEY
    originalNodeEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      writable: true,
      configurable: true,
    })
  })

  afterAll(() => {
    if (originalApiKey) {
      process.env.AGENT_API_KEY = originalApiKey
    } else {
      delete process.env.AGENT_API_KEY
    }
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      writable: true,
      configurable: true,
    })
  })

  it('POST should return 401 without API key', async () => {
    const response = await POST(createMockRequest({ noAuth: true }))
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })
})

describe('/api/test-glm', () => {
  const originalApiKey = process.env.AGENT_API_KEY
  let originalNodeEnv: string | undefined

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV
    process.env.AGENT_API_KEY = API_KEY
  })

  afterAll(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      writable: true,
      configurable: true,
    })
    if (originalApiKey) {
      process.env.AGENT_API_KEY = originalApiKey
    } else {
      delete process.env.AGENT_API_KEY
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      writable: true,
      configurable: true,
    })
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
    ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(60)
  })

  afterEach(() => {
    ;(process as any).env.NODE_ENV = 'test'
  })

  it('should return error in production', async () => {
    ;(process as any).env.NODE_ENV = 'production'

    const response = await POST(createMockRequest())
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('not available in production')

    ;(process as any).env.NODE_ENV = 'test'
  })

  it('should return error when GLM_API_KEY not configured', async () => {
    const originalKey = process.env.GLM_API_KEY
    delete process.env.GLM_API_KEY

    const response = await POST(createMockRequest())
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('GLM_API_KEY')

    if (originalKey) process.env.GLM_API_KEY = originalKey
  })

  it('should successfully test GLM when configured', async () => {
    process.env.GLM_API_KEY = 'test-key'

    const response = await POST(createMockRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toContain('GLM')

    delete process.env.GLM_API_KEY
  })

  it('should enforce rate limiting', async () => {
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(false)
    ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(0)

    const response = await POST(createMockRequest())
    const data = await response.json()

    expect(response.status).toBe(429)
  })
})
