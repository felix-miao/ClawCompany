import { OpenAIProvider } from '../openai'
import { ChatMessage } from '../types'

global.fetch = jest.fn()

describe('OpenAIProvider', () => {
  let openaiProvider: OpenAIProvider
  const mockApiKey = 'test-api-key'

  beforeEach(() => {
    openaiProvider = new OpenAIProvider({
      provider: 'openai',
      apiKey: mockApiKey,
    })
    jest.clearAllMocks()
  })

  describe('初始化', () => {
    it('应该正确初始化', () => {
      expect(openaiProvider).toBeDefined()
    })

    it('应该在缺少 API key 时抛出错误', () => {
      expect(() => {
        new OpenAIProvider({ provider: 'openai', apiKey: '' })
      }).toThrow('API key is required')
    })
  })

  describe('chat 方法', () => {
    it('应该成功调用 OpenAI API', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello response' } }],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
      const response = await openaiProvider.chat(messages)

      expect(response).toBe('Hello response')
      expect(global.fetch).toHaveBeenCalled()
    })

    it('应该发送正确的请求体', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const messages: ChatMessage[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
      ]

      await openaiProvider.chat(messages)

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody).toMatchObject({
        model: 'gpt-4o-mini',
        messages: messages,
      })
    })

    it('应该处理 API 错误', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid API key' } }),
      })

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }]
      await expect(openaiProvider.chat(messages)).rejects.toThrow('OpenAI API error')
    })

    it('应该处理空响应', async () => {
      const mockResponse = { choices: [] }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }]
      const response = await openaiProvider.chat(messages)
      expect(response).toBe('')
    })
  })

  describe('超时处理', () => {
    it('chat 应该为 fetch 传递 AbortSignal', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await openaiProvider.chat([{ role: 'user', content: 'test' }])

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      expect(callArgs[1].signal).toBeDefined()
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal)
    })

    it('chat 应该在网络超时时抛出超时错误', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const error = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
            setTimeout(() => reject(error), 10)
          }),
      )

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }]
      await expect(openaiProvider.chat(messages)).rejects.toThrow()
    }, 5000)

    it('stream 应该为 fetch 传递 AbortSignal', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      })

      const chunks: string[] = []
      for await (const chunk of openaiProvider.stream([{ role: 'user', content: 'test' }])) {
        chunks.push(chunk)
      }

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      expect(callArgs[1].signal).toBeDefined()
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal)
    })

    it('stream 应该在网络超时时抛出超时错误', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const error = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
            setTimeout(() => reject(error), 10)
          }),
      )

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }]
      const gen = openaiProvider.stream(messages)
      await expect(gen.next()).rejects.toThrow()
    }, 5000)

    it('超时错误消息应包含 "timeout"', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(() => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      })

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }]
      try {
        await openaiProvider.chat(messages)
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message.toLowerCase()).toContain('timeout')
      }
    })
  })

  describe('stream 方法', () => {
    it('应该成功流式返回数据', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      })

      const chunks: string[] = []
      for await (const chunk of openaiProvider.stream([{ role: 'user', content: 'test' }])) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['Hello', ' world'])
    })

    it('应该处理流式 API 错误', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid key' } }),
      })

      const gen = openaiProvider.stream([{ role: 'user', content: 'test' }])
      await expect(gen.next()).rejects.toThrow('OpenAI API error')
    })
  })
})
