import { sendMessage, getChatHistory } from '../client'

describe('API Client', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    globalThis.fetch = jest.fn() as any
    fetchSpy = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('sendMessage', () => {
    it('should send message and return response on success', async () => {
      const mockResponse = {
        success: true,
        message: 'Hello from AI',
        tasks: [],
        chatHistory: [],
      }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await sendMessage('Hello')

      expect(fetchSpy).toHaveBeenCalledWith('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      })
      expect(result.success).toBe(true)
      expect(result.message).toBe('Hello from AI')
    })

    it('should return error on non-ok response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const result = await sendMessage('Hello')

      expect(result.success).toBe(false)
      expect(result.error).toBe('API error: 500')
      consoleSpy.mockRestore()
    })

    it('should return error on 400 response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({}),
      } as Response)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const result = await sendMessage('')

      expect(result.success).toBe(false)
      // 空字符串在输入验证阶段就被拦截，不会到达 API
      expect(result.error).toBe('Message must be a non-empty string')
      consoleSpy.mockRestore()
    })

    it('should return error on 429 rate limit response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({}),
      } as Response)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const result = await sendMessage('test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('API error: 429')
      consoleSpy.mockRestore()
    })

    it('should handle network error', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const result = await sendMessage('Hello')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to fetch')
      consoleSpy.mockRestore()
    })

    it('should handle non-Error thrown values', async () => {
      fetchSpy.mockRejectedValueOnce('string error')

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const result = await sendMessage('Hello')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
      consoleSpy.mockRestore()
    })

    it('should include tasks and chatHistory in response', async () => {
      const mockResponse = {
        success: true,
        message: 'Done',
        tasks: [{
          id: '1',
          title: 'Task 1',
          description: 'Test task',
          status: 'pending',
          assignedTo: 'dev' as const,
          dependencies: [],
          files: [],
        }],
        chatHistory: [{
          id: '1',
          agent: 'user' as const,
          content: 'Hello',
          type: 'text' as const,
          timestamp: new Date().toISOString(),
        }],
      }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await sendMessage('Hello')
      expect(result.tasks).toHaveLength(1)
      expect(result.chatHistory).toHaveLength(1)
    })

    it('should use NEXT_PUBLIC_API_URL when set', async () => {
      jest.resetModules()
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'

      const { sendMessage: sendMessageWithUrl } = await import('../client')

      const localFetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
      globalThis.fetch = localFetchSpy

      await sendMessageWithUrl('Hello')

      expect(localFetchSpy).toHaveBeenCalledWith('https://api.example.com/api/chat', expect.any(Object))

      delete process.env.NEXT_PUBLIC_API_URL
      jest.resetModules()
    })
  })

  describe('getChatHistory', () => {
    it('should fetch and return chat history on success', async () => {
      const mockResponse = {
        tasks: [{
          id: '1',
          title: 'Task 1',
          description: 'Test task',
          status: 'pending',
          assignedTo: 'dev' as const,
          dependencies: [],
          files: [],
        }],
        chatHistory: [{
          id: '1',
          agent: 'user' as const,
          content: 'Hello',
          type: 'text' as const,
          timestamp: new Date().toISOString(),
        }],
        agents: [{ id: 'pm', name: 'PM', role: 'pm', description: 'PM Agent' }],
      }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await getChatHistory()

      expect(fetchSpy).toHaveBeenCalledWith('/api/chat', { method: 'GET' })
      expect(result.tasks).toHaveLength(1)
      expect(result.chatHistory).toHaveLength(1)
      expect(result.agents).toHaveLength(1)
    })

    it('should return empty arrays on non-ok response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const result = await getChatHistory()

      expect(result.tasks).toEqual([])
      expect(result.chatHistory).toEqual([])
      expect(result.agents).toEqual([])
      consoleSpy.mockRestore()
    })

    it('should return empty arrays on network error', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network down'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const result = await getChatHistory()

      expect(result.tasks).toEqual([])
      expect(result.chatHistory).toEqual([])
      expect(result.agents).toEqual([])
      consoleSpy.mockRestore()
    })

    it('should use NEXT_PUBLIC_API_URL when set', async () => {
      jest.resetModules()
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'

      const { getChatHistory: getChatHistoryWithUrl } = await import('../client')

      const localFetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: [], chatHistory: [], agents: [] }),
      })
      globalThis.fetch = localFetchSpy

      await getChatHistoryWithUrl()

      expect(localFetchSpy).toHaveBeenCalledWith('https://api.example.com/api/chat', { method: 'GET' })

      delete process.env.NEXT_PUBLIC_API_URL
      jest.resetModules()
    })
  })
})
