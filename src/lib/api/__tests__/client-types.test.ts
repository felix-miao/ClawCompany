import { sendMessage, getChatHistory, ChatResponse, ChatHistoryResponse } from '../client'

describe('API Client - typed response handling', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    globalThis.fetch = jest.fn() as any
    fetchSpy = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('sendMessage - typed JSON response', () => {
    it('should correctly type response with all ChatResponse fields', async () => {
      const mockResponse: ChatResponse = {
        success: true,
        message: 'AI response',
        tasks: [],
        chatHistory: [],
      }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await sendMessage('Hello')
      expect(result.success).toBe(true)
      expect(result.message).toBe('AI response')
      expect(typeof result.success).toBe('boolean')
    })

    it('should correctly type error response', async () => {
      const mockResponse: ChatResponse = {
        success: false,
        error: 'Something went wrong',
      }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await sendMessage('Hello')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Something went wrong')
    })

    it('should correctly type response with tasks', async () => {
      const mockResponse: ChatResponse = {
        success: true,
        tasks: [
          {
            id: 'task-1',
            title: 'Implement feature',
            description: 'Build the feature',
            status: 'pending',
            assignedTo: 'dev',
            dependencies: [],
            files: ['src/main.ts'],
          },
        ],
      }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await sendMessage('Create task')
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks![0].id).toBe('task-1')
      expect(result.tasks![0].title).toBe('Implement feature')
    })
  })

  describe('getChatHistory - typed JSON response', () => {
    it('should correctly type response with all ChatHistoryResponse fields', async () => {
      const mockResponse: ChatHistoryResponse = {
        tasks: [{ id: '1', title: 'Task', description: 'desc', status: 'pending', assignedTo: 'dev', dependencies: [], files: [] }],
        chatHistory: [{ id: 'm1', agent: 'user', content: 'Hello', type: 'text', timestamp: new Date() }],
        agents: [{ id: 'pm', name: 'PM Agent', role: 'pm', description: 'Product Manager' }],
      }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await getChatHistory()
      expect(Array.isArray(result.tasks)).toBe(true)
      expect(Array.isArray(result.chatHistory)).toBe(true)
      expect(Array.isArray(result.agents)).toBe(true)
      expect(result.agents[0].id).toBe('pm')
    })

    it('should correctly type empty response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const result = await getChatHistory()
      expect(result.tasks).toEqual([])
      expect(result.chatHistory).toEqual([])
      expect(result.agents).toEqual([])
      consoleSpy.mockRestore()
    })
  })
})
