jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/storage/manager', () => {
  ;(global as any).__mockConvStorageManager__ = {
    createConversation: jest.fn(),
    loadConversation: jest.fn(),
    saveConversation: jest.fn(),
    listConversations: jest.fn(),
    deleteConversation: jest.fn(),
  }
  return {
    StorageManager: jest.fn().mockImplementation(() => (global as any).__mockConvStorageManager__),
  }
})

jest.mock('@/lib/security/utils', () => ({
  InputValidator: {
    sanitize: (str: string) => str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;'),
  },
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
}))

import { POST, GET, PUT, DELETE } from '../route'
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
    const request = createMockRequest({ body: { title: 'Test' } })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('GET should return 401 without API key', async () => {
    const request = createMockRequest({ url: 'http://localhost/api/conversations' })
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('PUT should return 401 without API key', async () => {
    const request = createMockRequest({ body: { conversationId: 'conv-1', title: 'New' } })
    const response = await PUT(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('DELETE should return 401 without API key', async () => {
    const request = createMockRequest({ url: 'http://localhost/api/conversations?id=conv-1' })
    const response = await DELETE(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })
})

function createMockRequest(options?: any): any {
  const url = options?.url || 'http://localhost/api/conversations'
  return {
    url,
    headers: { get: () => '1.2.3.4' },
    json: () => Promise.resolve(options?.body || {}),
  }
}

const getMockStorage = () => (global as any).__mockConvStorageManager__

describe('/api/conversations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
    ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(60)

    const storage = getMockStorage()
    storage.createConversation.mockReset()
    storage.loadConversation.mockReset()
    storage.saveConversation.mockReset()
    storage.listConversations.mockReset()
    storage.deleteConversation.mockReset()
  })

  describe('POST - Create Conversation', () => {
    it('should create conversation with valid title', async () => {
      const storage = getMockStorage()
      const conv = {
        id: 'conv-1',
        title: 'Test Conversation',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      storage.createConversation.mockReturnValue(conv)
      storage.saveConversation.mockResolvedValue(undefined)

      const request = createMockRequest({
        body: { title: 'Test Conversation' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.conversation).toBeDefined()
      expect(storage.createConversation).toHaveBeenCalledWith('Test Conversation')
      expect(storage.saveConversation).toHaveBeenCalledWith(conv)
    })

    it('should reject missing title', async () => {
      const request = createMockRequest({ body: {} })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('required')
    })

    it('should reject non-string title', async () => {
      const request = createMockRequest({ body: { title: 123 } })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should reject null title', async () => {
      const request = createMockRequest({ body: { title: null } })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
    })

    it('should sanitize title', async () => {
      const storage = getMockStorage()
      storage.createConversation.mockReturnValue({ id: 'conv-1', title: 'clean', messages: [] })
      storage.saveConversation.mockResolvedValue(undefined)

      const request = createMockRequest({
        body: { title: '<script>alert("xss")</script>Hello' },
      })

      await POST(request)
      // HTML entities encoding, not tag removal
      expect(storage.createConversation).toHaveBeenCalledWith(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;Hello'
      )
    })

    it('should enforce rate limiting', async () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(false)
      ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(0)

      const request = createMockRequest({ body: { title: 'Test' } })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('Rate limit')
    })
  })

  describe('GET - List/Get Conversations', () => {
    it('should list all conversations', async () => {
      const storage = getMockStorage()
      storage.listConversations.mockResolvedValue([
        { id: '1', title: 'Conv 1' },
        { id: '2', title: 'Conv 2' },
      ])

      const request = createMockRequest({
        url: 'http://localhost/api/conversations',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.conversations).toHaveLength(2)
      expect(data.total).toBe(2)
    })

    it('should get specific conversation by id', async () => {
      const storage = getMockStorage()
      storage.loadConversation.mockResolvedValue({
        id: 'conv-123',
        title: 'Test Conv',
        messages: [],
      })

      const request = createMockRequest({
        url: 'http://localhost/api/conversations?id=conv-123',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.conversation.id).toBe('conv-123')
    })

    it('should return 404 for non-existent conversation', async () => {
      const storage = getMockStorage()
      storage.loadConversation.mockResolvedValue(null)

      const request = createMockRequest({
        url: 'http://localhost/api/conversations?id=nonexistent',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    it('should return empty list when no conversations', async () => {
      const storage = getMockStorage()
      storage.listConversations.mockResolvedValue([])

      const request = createMockRequest({
        url: 'http://localhost/api/conversations',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.conversations).toEqual([])
      expect(data.total).toBe(0)
    })
  })

  describe('PUT - Update Conversation', () => {
    it('should update conversation title', async () => {
      const storage = getMockStorage()
      const existing = {
        id: 'conv-1',
        title: 'Old Title',
        messages: [],
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      storage.loadConversation.mockResolvedValue(existing)
      storage.saveConversation.mockResolvedValue(undefined)

      const request = createMockRequest({
        body: { conversationId: 'conv-1', title: 'New Title' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(storage.saveConversation).toHaveBeenCalled()
    })

    it('should reject missing conversationId', async () => {
      const request = createMockRequest({ body: { title: 'New' } })
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should return 404 for non-existent conversation', async () => {
      const storage = getMockStorage()
      storage.loadConversation.mockResolvedValue(null)

      const request = createMockRequest({
        body: { conversationId: 'nonexistent', title: 'New' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    it('should update without changing title when not provided', async () => {
      const storage = getMockStorage()
      const existing = {
        id: 'conv-1',
        title: 'Existing Title',
        messages: [],
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      storage.loadConversation.mockResolvedValue(existing)
      storage.saveConversation.mockResolvedValue(undefined)

      const request = createMockRequest({
        body: { conversationId: 'conv-1' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(existing.title).toBe('Existing Title')
    })
  })

  describe('DELETE - Delete Conversation', () => {
    it('should delete conversation', async () => {
      const storage = getMockStorage()
      storage.deleteConversation.mockResolvedValue(undefined)

      const request = createMockRequest({
        url: 'http://localhost/api/conversations?id=conv-1',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(storage.deleteConversation).toHaveBeenCalledWith('conv-1')
    })

    it('should reject missing conversation id', async () => {
      const request = createMockRequest({
        url: 'http://localhost/api/conversations',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })
  })

  describe('Error Handling', () => {
    it('should handle JSON parse errors in POST', async () => {
      const request = {
        url: 'http://localhost/api/conversations',
        headers: { get: () => '1.2.3.4' },
        json: async () => { throw new SyntaxError('Unexpected token') },
      }

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should handle JSON parse errors in PUT', async () => {
      const request = {
        url: 'http://localhost/api/conversations',
        headers: { get: () => '1.2.3.4' },
        json: async () => { throw new SyntaxError('Unexpected token') },
      }

      const response = await PUT(request as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })
})
