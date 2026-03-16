import { POST, GET, PUT, DELETE } from '../route'
import { NextRequest } from 'next/server'
import { StorageManager } from '@/lib/storage/manager'
import { RateLimiter } from '@/lib/security/utils'

// Mock dependencies
jest.mock('@/lib/storage/manager')
jest.mock('@/lib/security/utils')
jest.mock('@/lib/filesystem/manager')
jest.mock('@/lib/git/manager')
jest.mock('node-fetch')

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
      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'pm-agent',
          userMessage: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBeDefined()
    })

    it('should reject invalid agent ID', async () => {
      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'invalid agent!',
          userMessage: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid agent ID')
    })

    it('should reject empty message', async () => {
      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'pm-agent',
          userMessage: ''
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('empty')
    })

    it('should reject too long message', async () => {
      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'pm-agent',
          userMessage: 'a'.repeat(10001)
        })
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

      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'pm-agent',
          userMessage: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Rate limit')
    })

    it('should handle missing API key', async () => {
      delete process.env.GLM_API_KEY

      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'pm-agent',
          userMessage: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('API key')
    })

    it('should handle non-existent agent', async () => {
      const storageManager = new StorageManager()
      ;(storageManager.loadAgent as jest.Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'non-existent',
          userMessage: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toContain('not found')
    })

    it('should save conversation', async () => {
      const storageManager = new StorageManager()
      const saveSpy = jest.fn()
      ;(storageManager.saveConversation as jest.Mock).mockImplementation(saveSpy)

      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'pm-agent',
          userMessage: 'Hello'
        })
      })

      await POST(request)

      expect(saveSpy).toHaveBeenCalled()
    })

    it('should handle conversation ID', async () => {
      const storageManager = new StorageManager()
      const loadSpy = jest.fn().mockResolvedValue({
        id: 'existing-conv',
        title: 'Existing',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      ;(storageManager.loadConversation as jest.Mock).mockImplementation(loadSpy)

      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'pm-agent',
          userMessage: 'Hello',
          conversationId: 'existing-conv'
        })
      })

      await POST(request)

      expect(loadSpy).toHaveBeenCalledWith('existing-conv')
    })

    it('should return remaining rate limit', async () => {
      ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(59)

      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'pm-agent',
          userMessage: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.remaining).toBe(59)
    })
  })

  describe('GET', () => {
    it('should list all agents', async () => {
      const request = new NextRequest('http://localhost/api/agent', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.agents).toBeDefined()
    })

    it('should get single agent', async () => {
      const request = new NextRequest('http://localhost/api/agent?agentId=pm-agent', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.agent).toBeDefined()
    })

    it('should return 404 for non-existent agent', async () => {
      const storageManager = new StorageManager()
      ;(storageManager.loadAgent as jest.Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/agent?agentId=non-existent', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  describe('PUT', () => {
    it('should update agent config', async () => {
      const request = new NextRequest('http://localhost/api/agent', {
        method: 'PUT',
        body: JSON.stringify({
          agentId: 'pm-agent',
          name: 'Updated PM Agent'
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid agent ID', async () => {
      const request = new NextRequest('http://localhost/api/agent', {
        method: 'PUT',
        body: JSON.stringify({
          agentId: 'invalid agent!'
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should return 404 for non-existent agent', async () => {
      const storageManager = new StorageManager()
      ;(storageManager.loadAgent as jest.Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/agent', {
        method: 'PUT',
        body: JSON.stringify({
          agentId: 'non-existent'
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  describe('DELETE', () => {
    it('should delete agent', async () => {
      const request = new NextRequest('http://localhost/api/agent?agentId=pm-agent', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid agent ID', async () => {
      const request = new NextRequest('http://localhost/api/agent?agentId=invalid!', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should reject missing agent ID', async () => {
      const request = new NextRequest('http://localhost/api/agent', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle JSON parse errors', async () => {
      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })

    it('should handle storage errors', async () => {
      const storageManager = new StorageManager()
      ;(storageManager.loadAgent as jest.Mock).mockRejectedValue(new Error('Storage error'))

      const request = new NextRequest('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'pm-agent',
          userMessage: 'Hello'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })
  })
})
