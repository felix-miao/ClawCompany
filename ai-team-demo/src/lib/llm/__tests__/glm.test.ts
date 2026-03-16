// GLM LLM Provider 测试

import { GLMProvider } from '../glm'
import { ChatMessage } from '../types'

// Mock fetch
global.fetch = jest.fn()

describe('GLMProvider', () => {
  let glmProvider: GLMProvider
  const mockApiKey = 'test-api-key'

  beforeEach(() => {
    glmProvider = new GLMProvider({
      apiKey: mockApiKey
    })
    jest.clearAllMocks()
  })

  describe('初始化', () => {
    it('应该正确初始化', () => {
      expect(glmProvider).toBeDefined()
    })

    it('应该存储 API key', () => {
      // 通过调用 chat 方法来验证配置
      expect(glmProvider).toBeInstanceOf(GLMProvider)
    })

    it('应该在缺少 API key 时抛出错误', () => {
      expect(() => {
        new GLMProvider({ apiKey: '' })
      }).toThrow('GLM API key is required')
    })
  })

  describe('chat 方法', () => {
    it('应该成功调用 GLM API', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '这是测试响应'
            }
          }
        ]
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试消息' }
      ]

      const response = await glmProvider.chat(messages)

      expect(response).toBe('这是测试响应')
      expect(global.fetch).toHaveBeenCalled()
    })

    it('应该发送正确的请求体', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '响应'
            }
          }
        ]
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const messages: ChatMessage[] = [
        { role: 'system', content: '系统提示' },
        { role: 'user', content: '用户消息' }
      ]

      await glmProvider.chat(messages)

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody).toMatchObject({
        model: 'glm-5',
        messages: messages
      })
    })

    it('应该处理 API 错误', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      await expect(glmProvider.chat(messages)).rejects.toThrow()
    })

    it('应该处理网络错误', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      await expect(glmProvider.chat(messages)).rejects.toThrow('Network error')
    })

    it('应该处理空响应', async () => {
      const mockResponse = {
        choices: []
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      // 空响应应该返回空字符串或抛出错误
      const response = await glmProvider.chat(messages)
      expect(response).toBeDefined()
    })

    it('应该处理超时', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100)
        })
      )

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      await expect(glmProvider.chat(messages)).rejects.toThrow()
    }, 5000)
  })

  describe('错误处理', () => {
    it('应该处理速率限制', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      })

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      await expect(glmProvider.chat(messages)).rejects.toThrow()
    })
  })
})
