import { BaseLLMProvider } from '../base'
import { ChatMessage, LLMConfig } from '../types'

global.fetch = jest.fn()

class TestProvider extends BaseLLMProvider {
  constructor(config: LLMConfig) {
    super(config, 'test-model-v1')
  }

  protected get apiUrl(): string {
    return 'https://test.api.com/v1/chat/completions'
  }

  protected get providerName(): string {
    return 'Test'
  }

  protected get defaultModel(): string {
    return 'test-model-v1'
  }
}

describe('BaseLLMProvider', () => {
  let provider: TestProvider

  beforeEach(() => {
    provider = new TestProvider({
      provider: 'openai',
      apiKey: 'test-key',
    })
    jest.clearAllMocks()
  })

  describe('构造函数', () => {
    it('应该正确初始化默认值', () => {
      expect(provider).toBeDefined()
    })

    it('应该在缺少 API key 时抛出错误', () => {
      expect(() => {
        new TestProvider({ provider: 'openai', apiKey: '' })
      }).toThrow('API key is required')
    })

    it('应该使用默认模型', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      await provider.chat([{ role: 'user', content: 'test' }])

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(body.model).toBe('test-model-v1')
    })

    it('应该允许自定义模型', async () => {
      const custom = new TestProvider({
        provider: 'openai',
        apiKey: 'key',
        model: 'custom-model',
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      await custom.chat([{ role: 'user', content: 'test' }])

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(body.model).toBe('custom-model')
    })

    it('应该正确设置 temperature 默认值', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      await provider.chat([{ role: 'user', content: 'test' }])

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(body.temperature).toBe(0.7)
    })

    it('应该正确设置 max_tokens 默认值', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      await provider.chat([{ role: 'user', content: 'test' }])

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(body.max_tokens).toBe(2000)
    })
  })

  describe('chat 方法', () => {
    it('应该调用正确的 API URL', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      await provider.chat([{ role: 'user', content: 'test' }])

      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
        'https://test.api.com/v1/chat/completions',
      )
    })

    it('应该发送正确的 Authorization header', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      await provider.chat([{ role: 'user', content: 'test' }])

      const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers
      expect(headers['Authorization']).toBe('Bearer test-key')
    })

    it('应该映射所有消息 role 和 content', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      const messages: ChatMessage[] = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
        { role: 'assistant', content: 'asst' },
      ]

      await provider.chat(messages)

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(body.messages).toEqual([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
        { role: 'assistant', content: 'asst' },
      ])
    })

    it('应该返回 API 响应内容', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello world' } }],
        }),
      })

      const result = await provider.chat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('Hello world')
    })

    it('应该在空 choices 时返回空字符串', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      })

      const result = await provider.chat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('')
    })

    it('应该在 API 错误时抛出含 provider 名称的错误', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => '{"error":{"message":"Bad key"}}',
      })

      await expect(
        provider.chat([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow('Test API error: Bad key')
    })

    it('应该在 API 错误无 message 时使用 statusText', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => '{}',
      })

      await expect(
        provider.chat([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow('Test API error: Internal Server Error')
    })

    it('应该在 API 返回非 JSON 错误体时安全处理', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => '<html>Gateway Timeout</html>',
      })

      await expect(
        provider.chat([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow('Test API error: <html>Gateway Timeout</html>')
    })

    it('应该在 API 错误体为空时使用 statusText', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => '',
      })

      await expect(
        provider.chat([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow('Test API error: Too Many Requests')
    })

    it('应该在成功响应 JSON 解析失败时抛出错误', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new SyntaxError('Unexpected token') },
      })

      await expect(
        provider.chat([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow('Test API error: Failed to parse response')
    })

    it('应该为 fetch 传递 AbortSignal', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      await provider.chat([{ role: 'user', content: 'test' }])

      const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal
      expect(signal).toBeDefined()
      expect(signal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('stream 方法', () => {
    it('应该流式返回所有内容块', async () => {
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
      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['Hello', ' world'])
    })

    it('应该在请求体中包含 stream: true', async () => {
      const mockReader = {
        read: jest.fn().mockResolvedValueOnce({ done: true, value: undefined }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      })

      const gen = provider.stream([{ role: 'user', content: 'test' }])
      await gen.next()

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(body.stream).toBe(true)
    })

    it('应该跳过 [DONE] 标记', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\ndata: [DONE]\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      })

      const chunks: string[] = []
      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['hi'])
    })

    it('应该在流式 API 错误时抛出含 provider 名称的错误', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => '{"error":{"message":"Invalid key"}}',
      })

      const gen = provider.stream([{ role: 'user', content: 'test' }])
      await expect(gen.next()).rejects.toThrow('Test API error: Invalid key')
    })

    it('应该在流式 API 返回非 JSON 错误体时安全处理', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => 'Service Unavailable',
      })

      const gen = provider.stream([{ role: 'user', content: 'test' }])
      await expect(gen.next()).rejects.toThrow('Test API error: Service Unavailable')
    })

    it('应该在 response body 为 null 时抛出错误', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: null,
      })

      const gen = provider.stream([{ role: 'user', content: 'test' }])
      await expect(gen.next()).rejects.toThrow('Response body is null')
    })

    it('应该忽略无效 JSON 的 SSE 数据', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: invalid json\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      })

      const chunks: string[] = []
      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['ok'])
    })

    it('应该为 fetch 传递 AbortSignal', async () => {
      const mockReader = {
        read: jest.fn().mockResolvedValueOnce({ done: true, value: undefined }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      })

      const gen = provider.stream([{ role: 'user', content: 'test' }])
      await gen.next()

      const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal
      expect(signal).toBeDefined()
      expect(signal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('超时处理', () => {
    it('chat 应该在网络超时时抛出错误', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const error = new DOMException(
              'The operation was aborted due to timeout',
              'TimeoutError',
            )
            setTimeout(() => reject(error), 10)
          }),
      )

      await expect(
        provider.chat([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow()
    }, 5000)

    it('stream 应该在网络超时时抛出错误', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const error = new DOMException(
              'The operation was aborted due to timeout',
              'TimeoutError',
            )
            setTimeout(() => reject(error), 10)
          }),
      )

      const gen = provider.stream([{ role: 'user', content: 'test' }])
      await expect(gen.next()).rejects.toThrow()
    }, 5000)
  })

  describe('子类继承验证', () => {
    it('不同子类应使用各自的 providerName', async () => {
      class ProviderA extends BaseLLMProvider {
        constructor(config: LLMConfig) { super(config, 'model-a') }
        protected get apiUrl(): string { return 'https://a.com/v1' }
        protected get providerName(): string { return 'ProviderA' }
        protected get defaultModel(): string { return 'model-a' }
      }

      class ProviderB extends BaseLLMProvider {
        constructor(config: LLMConfig) { super(config, 'model-b') }
        protected get apiUrl(): string { return 'https://b.com/v1' }
        protected get providerName(): string { return 'ProviderB' }
        protected get defaultModel(): string { return 'model-b' }
      }

      const a = new ProviderA({ provider: 'openai', apiKey: 'key' })
      const b = new ProviderB({ provider: 'openai', apiKey: 'key' })

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Error',
        text: async () => '{}',
      })

      await expect(a.chat([{ role: 'user', content: '' }])).rejects.toThrow('ProviderA API error')
      await expect(b.chat([{ role: 'user', content: '' }])).rejects.toThrow('ProviderB API error')
    })

    it('不同子类应使用各自的 defaultModel', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      class ModelX extends BaseLLMProvider {
        constructor(config: LLMConfig) { super(config, 'x-model-1') }
        protected get apiUrl(): string { return 'https://x.com/v1' }
        protected get providerName(): string { return 'X' }
        protected get defaultModel(): string { return 'x-model-1' }
      }

      const x = new ModelX({ provider: 'openai', apiKey: 'key' })
      await x.chat([{ role: 'user', content: 'test' }])

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(body.model).toBe('x-model-1')
    })

    it('不同子类应调用各自的 apiUrl', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      })

      class ApiA extends BaseLLMProvider {
        constructor(config: LLMConfig) { super(config, 'a') }
        protected get apiUrl(): string { return 'https://api-a.com/v1/chat' }
        protected get providerName(): string { return 'A' }
        protected get defaultModel(): string { return 'a' }
      }

      class ApiB extends BaseLLMProvider {
        constructor(config: LLMConfig) { super(config, 'b') }
        protected get apiUrl(): string { return 'https://api-b.com/v2/chat' }
        protected get providerName(): string { return 'B' }
        protected get defaultModel(): string { return 'b' }
      }

      const a = new ApiA({ provider: 'openai', apiKey: 'key' })
      const b = new ApiB({ provider: 'openai', apiKey: 'key' })

      await a.chat([{ role: 'user', content: 'test' }])
      await b.chat([{ role: 'user', content: 'test' }])

      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://api-a.com/v1/chat')
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('https://api-b.com/v2/chat')
    })
  })
})
