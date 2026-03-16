// Mock Next.js server components
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

// Helper to create mock request
function createMockRequest(options?: any): any {
  return {
    url: 'http://localhost/api/agent',
    method: options?.method || 'GET',
    headers: {
      get: (name: string) => options?.headers?.[name] || null
    },
    json: () => Promise.resolve(options?.body || {})
  }
}

import { POST, GET, PUT, DELETE } from '../route'
import { StorageManager } from '@/lib/storage/manager'
import { RateLimiter } from '@/lib/security/utils'

// Mock dependencies
jest.mock('@/lib/storage/manager')
jest.mock('@/lib/security/utils')
jest.mock('@/lib/filesystem/manager')
jest.mock('@/lib/git/manager')

describe('/api/agent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset rate limiter
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
    ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(60)

    // Mock storage
    ;(StorageManager as jest.Mock).mockImplementation(() => ({
      createConversation: jest.fn(() => ({
        id: 'conv-123',
        title: 'Test',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      loadConversation: jest.fn(),
      saveConversation: jest.fn(),
      loadAgent: jest.fn(() => ({
        id: 'pm-agent',
        name: 'PM Agent',
        systemPrompt: 'You are PM Agent',
        runtime: 'subagent'
      })),
      saveAgent: jest.fn(),
      deleteAgent: jest.fn(),
      listAgents: jest.fn(() => [])
    }))

    // Mock API key
    process.env.GLM_API_KEY = 'test-api-key-12345678901234567890'
  })

  describe('POST', () => {
    it('should create agent response successfully', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'Hello'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBeDefined()
    })

    it('should reject invalid agent ID', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'invalid agent!',
          userMessage: 'Hello'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid agent ID')
    })

    it('should reject empty message', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: ''
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('empty')
    })

    it('should reject too long message', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'a'.repeat(10001)
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('too long')
    })

    it('should enforce rate limiting', async () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(false)
      ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(0)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'Hello'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('Rate limit')
    })

    it('should handle missing API key', async () => {
      delete process.env.GLM_API_KEY

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'Hello'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('API key')

      // Restore API key
      process.env.GLM_API_KEY = 'test-api-key-12345678901234567890'
    })
  })

  describe('GET', () => {
    it('should list agents successfully', async () => {
      const request = createMockRequest({
        method: 'GET',
        body: {}
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.agents).toBeDefined()
      expect(Array.isArray(data.agents)).toBe(true)
    })

    it('should get specific agent', async () => {
      const request = createMockRequest({
        method: 'GET',
        body: { agentId: 'pm-agent' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.agent).toBeDefined()
      expect(data.agent.id).toBe('pm-agent')
    })

    it('should return 404 for non-existent agent', async () => {
      ;(StorageManager as jest.Mock).mockImplementation(() => ({
        loadAgent: jest.fn(() => null)
      }))

      const request = createMockRequest({
        method: 'GET',
        body: { agentId: 'non-existent' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })
  })

  describe('PUT', () => {
    it('should update agent successfully', async () => {
      const request = createMockRequest({
        method: 'PUT',
        body: {
          agentId: 'pm-agent',
          config: {
            name: 'Updated PM Agent',
            systemPrompt: 'Updated prompt'
          }
        }
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid agent ID', async () => {
      const request = createMockRequest({
        method: 'PUT',
        body: {
          agentId: 'invalid!',
          config: {}
        }
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should reject empty config', async () => {
      const request = createMockRequest({
        method: 'PUT',
        body: {
          agentId: 'pm-agent',
          config: {}
        }
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('config')
    })
  })

  describe('DELETE', () => {
    it('should delete agent successfully', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        body: { agentId: 'pm-agent' }
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid agent ID', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        body: { agentId: 'invalid!' }
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should reject missing agent ID', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        body: {}
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })
  })

  describe('Error Handling', () => {
    it('should handle JSON parse errors', async () => {
      const request = {
        url: 'http://localhost/api/agent',
        method: 'POST',
        headers: { get: () => null },
        json: async () => { throw new SyntaxError('Unexpected token') }
      }

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should handle storage errors', async () => {
      ;(StorageManager as jest.Mock).mockImplementation(() => ({
        loadAgent: jest.fn(() => {
          throw new Error('Storage error')
        })
      }))

      const request = createMockRequest({
        method: 'GET',
        body: { agentId: 'pm-agent' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })
})
