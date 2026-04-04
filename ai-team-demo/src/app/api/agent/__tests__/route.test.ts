// Mock Next.js server components
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => {
      const response = {
        json: async () => data,
        status: options?.status || 200,
      }
      return response
    },
  },
}))

jest.mock('@/lib/llm/factory', () => {
  let _provider: any = null
  return {
    getLLMProvider: () => _provider,
    setLLMProvider: (p: any) => { _provider = p },
    LLMFactory: { createFromEnv: () => _provider, createProvider: () => _provider },
  }
})
process.env.USE_MOCK_LLM = 'true'
process.env.AGENT_API_KEY = 'test-api-key-12345678901234567890'

// Helper to create mock request
function createMockRequest(options?: any): any {
  const url = options?.url || 'http://localhost/api/agent'
  const headers = {
    'x-api-key': process.env.AGENT_API_KEY,
    ...(options?.headers || {})
  }
  return {
    url,
    method: options?.method || 'GET',
    headers: {
      get: (name: string) => headers[name] || null
    },
    json: () => Promise.resolve(options?.body || {})
  }
}

// Use global to store mock functions
jest.mock('@/lib/storage/manager', () => {
  ;(global as any).__mockStorageManager__ = {
    createConversation: jest.fn(() => ({
      id: 'conv-123',
      title: 'Test',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })),
    loadConversation: jest.fn(),
    saveConversation: jest.fn(),
    addMessageToConversation: jest.fn((conv, msg) => ({
      ...conv,
      messages: [...conv.messages, msg]
    })),
    loadAgent: jest.fn(() => ({
      id: 'pm-agent',
      name: 'PM Claw',
      systemPrompt: 'You are PM Claw',
      runtime: 'subagent'
    })),
    saveAgent: jest.fn(),
    deleteAgent: jest.fn(),
    listAgents: jest.fn(() => [])
  }
  return {
    StorageManager: jest.fn().mockImplementation(() => (global as any).__mockStorageManager__)
  }
})

jest.mock('@/lib/filesystem/manager', () => {
  ;(global as any).__mockFsManager__ = {
    createFile: jest.fn()
  }
  return {
    FileSystemManager: jest.fn().mockImplementation(() => (global as any).__mockFsManager__)
  }
})

jest.mock('@/lib/git/manager', () => {
  ;(global as any).__mockGitManager__ = {
    commit: jest.fn()
  }
  return {
    GitManager: jest.fn().mockImplementation(() => (global as any).__mockGitManager__)
  }
})

jest.mock('@/lib/security/utils', () => ({
  InputValidator: {
    validateAgentId: (id: string) => /^[a-z0-9-]+$/.test(id),
    validateMessage: (message: string) => {
      if (!message || message.trim().length === 0) {
        return { valid: false, error: 'Message cannot be empty' }
      }
      if (message.length > 10000) {
        return { valid: false, error: 'Message too long (max 10000 characters)' }
      }
      return { valid: true }
    },
    validatePath: (path: string) => {
      if (!path) return false
      if (path.includes('..') || path.startsWith('/')) return false
      return true
    }
  },
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60)
  },
  SecurityManager: {
    getFromEnv: jest.fn(() => 'test-api-key-12345678901234567890')
  }
}))

import { POST, GET, PUT, DELETE } from '../route'

import { RateLimiter, SecurityManager } from '@/lib/security/utils'
import { getLLMProvider, setLLMProvider } from '@/lib/llm/factory'

const getMockStorageManager = () => (global as any).__mockStorageManager__
const getMockFsManager = () => (global as any).__mockFsManager__

describe('Authentication', () => {
  it('POST should return 401 without API key', async () => {
    const request = {
      url: 'http://localhost/api/agent',
      method: 'POST',
      headers: { get: () => null },
      json: async () => ({ agentId: 'pm-agent', userMessage: 'Hello' }),
    }
    const response = await POST(request as any)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('GET should return 401 without API key', async () => {
    const request = {
      url: 'http://localhost/api/agent',
      method: 'GET',
      headers: { get: () => null },
      json: async () => ({}),
    }
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })
})

describe('/api/agent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset rate limiter
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
    ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(60)
    
    // Reset security manager
    ;(SecurityManager.getFromEnv as jest.Mock).mockReturnValue('test-api-key-12345678901234567890')
    
    // Reset storage manager
    const storage = getMockStorageManager()
    storage.createConversation.mockReset()
    storage.loadConversation.mockReset()
    storage.saveConversation.mockReset()
    storage.addMessageToConversation.mockReset()
    storage.loadAgent.mockReset()
    storage.saveAgent.mockReset()
    storage.deleteAgent.mockReset()
    storage.listAgents.mockReset()
    
    // Set default implementations
    storage.createConversation.mockImplementation(() => ({
      id: 'conv-123',
      title: 'Test',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    storage.addMessageToConversation.mockImplementation((conv: any, msg: any) => ({
      ...conv,
      messages: [...conv.messages, msg]
    }))
    storage.loadAgent.mockResolvedValue({
      id: 'pm-agent',
      name: 'PM Claw',
      role: 'pm',
      emoji: '🤖',
      color: '#6B7280',
      systemPrompt: 'You are PM Claw',
      runtime: 'subagent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    storage.listAgents.mockResolvedValue([])
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

      const response = await POST(request as any)
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

      const response = await POST(request as any)
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

      const response = await POST(request as any)
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

      const response = await POST(request as any)
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

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('Rate limit')
    })

    it('should handle missing API key (use mock mode)', async () => {
      ;(SecurityManager.getFromEnv as jest.Mock).mockReturnValue(null)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'Hello'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      // Should still work in mock mode
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Restore API key
      ;(SecurityManager.getFromEnv as jest.Mock).mockReturnValue('test-api-key-12345678901234567890')
    })
  })

  describe('GET', () => {
    it('should list agents successfully', async () => {
      const storage = getMockStorageManager()
      storage.listAgents.mockResolvedValue([
        { id: 'pm-agent', name: 'PM Claw' },
        { id: 'dev-agent', name: 'Dev Claw' }
      ])

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/agent'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.agents).toBeDefined()
      expect(Array.isArray(data.agents)).toBe(true)
    })

    it('should get specific agent', async () => {
      const storage = getMockStorageManager()
      storage.loadAgent.mockResolvedValue({
        id: 'pm-agent',
        name: 'PM Claw',
        systemPrompt: 'You are PM Claw',
        runtime: 'subagent'
      })

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/agent?agentId=pm-agent'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.agent).toBeDefined()
      expect(data.agent.id).toBe('pm-agent')
    })

    it('should return 404 for non-existent agent', async () => {
      const storage = getMockStorageManager()
      storage.loadAgent.mockResolvedValue(null)

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/agent?agentId=non-existent'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })
  })

  describe('PUT', () => {
    it('should update agent successfully', async () => {
      const storage = getMockStorageManager()
      storage.loadAgent.mockResolvedValue({
        id: 'pm-agent',
        name: 'PM Claw',
        role: 'pm',
        emoji: '🤖',
        color: '#6B7280',
        systemPrompt: 'You are PM Claw',
        runtime: 'subagent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      storage.saveAgent.mockResolvedValue(undefined)

      const request = createMockRequest({
        method: 'PUT',
        body: {
          agentId: 'pm-agent',
          name: 'Updated PM Claw',
          systemPrompt: 'Updated prompt'
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
        }
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })
  })

  describe('DELETE', () => {
    it('should delete agent successfully', async () => {
      const storage = getMockStorageManager()
      storage.deleteAgent.mockResolvedValue(undefined)

      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/agent?agentId=pm-agent'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid agent ID', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/agent?agentId=invalid!'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should reject missing agent ID', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/agent'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })
  })

  describe('POST - conversation handling', () => {
    it('should load existing conversation when conversationId provided', async () => {
      const storage = getMockStorageManager()
      const existingConv = {
        id: 'existing-conv-456',
        title: 'Existing',
        messages: [{ agentId: 'user', agentName: 'You', content: 'Previous msg' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      storage.loadConversation.mockResolvedValue(existingConv)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'Follow up',
          conversationId: 'existing-conv-456'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(storage.loadConversation).toHaveBeenCalledWith('existing-conv-456')
    })

    it('should create new conversation when conversationId provided but not found', async () => {
      const storage = getMockStorageManager()
      storage.loadConversation.mockResolvedValue(null)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'Hello',
          conversationId: 'nonexistent-conv'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(storage.loadConversation).toHaveBeenCalledWith('nonexistent-conv')
      expect(storage.createConversation).toHaveBeenCalled()
    })

    it('should create default agent when agent not in storage', async () => {
      const storage = getMockStorageManager()
      storage.loadAgent.mockResolvedValue(null)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'dev-agent',
          userMessage: 'Build login'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(storage.saveAgent).toHaveBeenCalled()
      expect(data.agentId).toBe('dev-agent')
    })

    it('should return 404 for unknown agent not in defaults', async () => {
      const storage = getMockStorageManager()
      storage.loadAgent.mockResolvedValue(null)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'unknown-agent',
          userMessage: 'Hello'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toContain('not found')
    })
  })

  describe('POST - dev-agent code blocks', () => {
    it('should parse code blocks and create files for dev-agent', async () => {
      const storage = getMockStorageManager()
      const fs = getMockFsManager()
      const git = (global as any).__mockGitManager__

      storage.loadAgent.mockResolvedValue(null)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'dev-agent',
          userMessage: 'Create a component'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toContain('```')

      const mockResponse = data.message as string
      if (mockResponse.includes('// file:')) {
        expect(fs.createFile).toHaveBeenCalled()
        expect(git.commit).toHaveBeenCalled()
      }
    })

    it('should handle review-agent mock response', async () => {
      const storage = getMockStorageManager()
      storage.loadAgent.mockResolvedValue(null)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'review-agent',
          userMessage: 'Review this code'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.agentId).toBe('review-agent')
      expect(data.agentName).toBe('Reviewer Claw')
    })

    it('should return default response for unknown agent id with valid pattern', async () => {
      const storage = getMockStorageManager()
      storage.loadAgent.mockResolvedValue({
        id: 'custom-agent',
        name: 'Custom Agent',
        role: 'custom',
        emoji: '🤖',
        color: '#6B7280',
        systemPrompt: 'You are custom',
        runtime: 'subagent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'custom-agent',
          userMessage: 'Hello custom'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.agentId).toBe('custom-agent')
    })
  })

  describe('POST - LLM provider paths', () => {
    it('should use LLM provider when USE_MOCK_LLM is not true', async () => {
      const originalMock = process.env.USE_MOCK_LLM
      delete process.env.USE_MOCK_LLM

      setLLMProvider({
        chat: jest.fn().mockResolvedValue('LLM generated response'),
        stream: jest.fn(),
      } as any)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'Hello from LLM'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('LLM generated response')

      setLLMProvider(null)
      process.env.USE_MOCK_LLM = originalMock
    })

    it('should fallback to mock when LLM provider returns null', async () => {
      const originalMock = process.env.USE_MOCK_LLM
      delete process.env.USE_MOCK_LLM
      setLLMProvider(null)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'Hello fallback'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      process.env.USE_MOCK_LLM = originalMock
    })
  })

  describe('POST - file creation from code blocks', () => {
    it('should create files and commit when dev-agent response has file annotations', async () => {
      const originalMock = process.env.USE_MOCK_LLM
      delete process.env.USE_MOCK_LLM

      setLLMProvider({
        chat: jest.fn().mockResolvedValue(`## Implementation\n\n\`\`\`tsx\n// file: src/components/Test.tsx\nexport function Test() { return <div>test</div> }\n\`\`\`\n`),
        stream: jest.fn(),
      } as any)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'dev-agent',
          userMessage: 'Create a test component'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      const fs = getMockFsManager()
      const git = (global as any).__mockGitManager__
      expect(fs.createFile).toHaveBeenCalledWith('src/components/Test.tsx', expect.any(String))
      expect(git.commit).toHaveBeenCalled()

      setLLMProvider(null)
      process.env.USE_MOCK_LLM = originalMock
    })

    it('should skip files with invalid paths', async () => {
      const originalMock = process.env.USE_MOCK_LLM
      delete process.env.USE_MOCK_LLM

      setLLMProvider({
        chat: jest.fn().mockResolvedValue(`## Implementation\n\n\`\`\`tsx\n// file: ../etc/passwd\nmalicious code\n\`\`\`\n`),
        stream: jest.fn(),
      } as any)

      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'dev-agent',
          userMessage: 'Create something'
        }
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      const fs = getMockFsManager()
      expect(fs.createFile).not.toHaveBeenCalled()

      setLLMProvider(null)
      process.env.USE_MOCK_LLM = originalMock
    })
  })

  describe('PUT - agent not found', () => {
    it('should return 404 when updating non-existent agent', async () => {
      const storage = getMockStorageManager()
      storage.loadAgent.mockResolvedValue(null)

      const request = createMockRequest({
        method: 'PUT',
        body: {
          agentId: 'non-existent-agent',
          name: 'Updated Name'
        }
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })
  })

  describe('Error Handling', () => {
    it('should handle JSON parse errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const request = {
        url: 'http://localhost/api/agent',
        method: 'POST',
        headers: { get: () => null },
        json: async () => { throw new SyntaxError('Unexpected token') }
      }

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()

      consoleErrorSpy.mockRestore()
    })

    it('should handle agent not found error', async () => {
      const storage = getMockStorageManager()
      storage.loadAgent.mockResolvedValue(null)

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/agent?agentId=non-existent'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })
  })
})
