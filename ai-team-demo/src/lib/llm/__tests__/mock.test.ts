// Mock LLM Provider 测试

import { MockProvider } from '../mock'
import { ChatMessage } from '../types'

describe('MockProvider', () => {
  let mockProvider: MockProvider

  beforeEach(() => {
    mockProvider = new MockProvider()
  })

  describe('基本功能', () => {
    it('应该正确初始化', () => {
      expect(mockProvider).toBeDefined()
    })

    it('应该能调用 chat 并返回响应', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '测试消息' }
      ]

      const response = await mockProvider.chat(messages)

      expect(response).toBeDefined()
      expect(response.length).toBeGreaterThan(0)
    })

    it('应该支持 system prompt', async () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个助手' },
        { role: 'user', content: '你好' }
      ]

      const response = await mockProvider.chat(messages)

      expect(response).toBeDefined()
    })

    it('应该支持多轮对话', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '第一轮' },
        { role: 'assistant', content: '回复1' },
        { role: 'user', content: '第二轮' }
      ]

      const response = await mockProvider.chat(messages)

      expect(response).toBeDefined()
    })
  })

  describe('响应格式', () => {
    it('应该返回字符串格式', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      const response = await mockProvider.chat(messages)

      expect(typeof response).toBe('string')
    })

    it('应该支持 JSON 格式响应', async () => {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: '请用 JSON 格式回复'
        },
        { role: 'user', content: '生成一个 JSON 对象' }
      ]

      const response = await mockProvider.chat(messages)

      // Mock 应该返回有效的响应
      expect(response).toBeDefined()
    })
  })

  describe('错误处理', () => {
    it('应该处理空消息列表', async () => {
      const messages: ChatMessage[] = []

      // 应该不会抛出错误
      const response = await mockProvider.chat(messages)
      expect(response).toBeDefined()
    })

    it('应该处理特殊字符', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '特殊字符：<script>alert("xss")</script>' }
      ]

      const response = await mockProvider.chat(messages)
      expect(response).toBeDefined()
    })
  })

  describe('性能', () => {
    it('应该在合理时间内响应', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: '性能测试' }
      ]

      const startTime = Date.now()
      await mockProvider.chat(messages)
      const endTime = Date.now()

      // Mock 应该在 1 秒内响应
      expect(endTime - startTime).toBeLessThan(1000)
    })
  })
})
