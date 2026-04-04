jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
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

describe('Authentication', () => {
  const originalApiKey = process.env.AGENT_API_KEY
  let originalNodeEnv: string | undefined

  beforeAll(() => {
    process.env.AGENT_API_KEY = 'test-api-key-12345678901234567890'
    originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
  })

  afterAll(() => {
    if (originalApiKey) {
      process.env.AGENT_API_KEY = originalApiKey
    } else {
      delete process.env.AGENT_API_KEY
    }
    process.env.NODE_ENV = originalNodeEnv
  })

  it('POST should return 401 without API key', async () => {
    const response = await POST(createMockRequest())
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })
})

function createMockRequest(): any {
  return {
    headers: { get: () => '1.2.3.4' },
  }
}

describe('/api/test-glm', () => {
  let originalNodeEnv: string | undefined

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'test'
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
    ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(60)
  })

  afterEach(() => {
    process.env.NODE_ENV = 'test'
  })

  it('should return error in production', async () => {
    process.env.NODE_ENV = 'production'

    const response = await POST(createMockRequest())
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('not available in production')

    process.env.NODE_ENV = 'test'
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
