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

    it('所有响应应该是有效的 JSON', async () => {
      const keywords = ['登录', '计算器', '表单', '普通消息']
      for (const keyword of keywords) {
        const response = await mockProvider.chat([{ role: 'user', content: keyword }])
        expect(() => JSON.parse(response)).not.toThrow()
        const parsed = JSON.parse(response)
        expect(parsed).toHaveProperty('analysis')
        expect(parsed).toHaveProperty('tasks')
        expect(parsed).toHaveProperty('message')
      }
    })

    it('每个任务的 tasks 数组中的对象应包含必要字段', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '登录页面' }])
      const parsed = JSON.parse(response)

      expect(Array.isArray(parsed.tasks)).toBe(true)
      for (const task of parsed.tasks) {
        expect(task).toHaveProperty('title')
        expect(task).toHaveProperty('description')
        expect(task).toHaveProperty('assignedTo')
        expect(task).toHaveProperty('dependencies')
        expect(Array.isArray(task.dependencies)).toBe(true)
      }
    })
  })

  describe('关键词匹配 - 登录', () => {
    it('应该对包含"登录"的消息返回登录相关响应', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '帮我做一个登录页面' }])
      const parsed = JSON.parse(response)

      expect(parsed.analysis).toContain('登录')
      expect(parsed.tasks.length).toBeGreaterThanOrEqual(3)
      expect(parsed.message).toContain('登录')
    })

    it('应该对包含"login"的消息返回登录相关响应', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: 'create a login page' }])
      const parsed = JSON.parse(response)

      expect(parsed.analysis).toContain('登录')
      expect(parsed.tasks.some((t: any) => t.title.includes('登录'))).toBe(true)
    })

    it('登录响应应包含表单创建、验证和 API 任务', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '登录功能' }])
      const parsed = JSON.parse(response)
      const titles = parsed.tasks.map((t: any) => t.title)

      expect(titles.some((t: string) => t.includes('表单') || t.includes('登录'))).toBe(true)
      expect(titles.some((t: string) => t.includes('验证'))).toBe(true)
      expect(titles.some((t: string) => t.includes('审查'))).toBe(true)
    })
  })

  describe('关键词匹配 - 计算器', () => {
    it('应该对包含"计算器"的消息返回计算器相关响应', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '做一个计算器' }])
      const parsed = JSON.parse(response)

      expect(parsed.analysis).toContain('计算器')
      expect(parsed.tasks.length).toBeGreaterThanOrEqual(2)
      expect(parsed.message).toContain('计算器')
    })

    it('应该对包含"calculator"的消息返回计算器相关响应', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: 'I need a calculator' }])
      const parsed = JSON.parse(response)

      expect(parsed.analysis).toContain('计算器')
    })

    it('计算器响应应包含 UI 和逻辑任务', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '计算器app' }])
      const parsed = JSON.parse(response)
      const titles = parsed.tasks.map((t: any) => t.title)

      expect(titles.some((t: string) => t.includes('UI') || t.includes('界面'))).toBe(true)
      expect(titles.some((t: string) => t.includes('逻辑') || t.includes('计算'))).toBe(true)
    })
  })

  describe('关键词匹配 - 表单', () => {
    it('应该对包含"表单"的消息返回表单相关响应', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '创建一个表单' }])
      const parsed = JSON.parse(response)

      expect(parsed.analysis).toContain('表单')
      expect(parsed.tasks.length).toBeGreaterThanOrEqual(2)
      expect(parsed.message).toContain('表单')
    })

    it('应该对包含"form"的消息返回表单相关响应', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: 'build a form component' }])
      const parsed = JSON.parse(response)

      expect(parsed.analysis).toContain('表单')
    })

    it('表单响应应包含组件创建和验证任务', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '表单组件' }])
      const parsed = JSON.parse(response)
      const titles = parsed.tasks.map((t: any) => t.title)

      expect(titles.some((t: string) => t.includes('表单') || t.includes('组件'))).toBe(true)
      expect(titles.some((t: string) => t.includes('验证'))).toBe(true)
    })
  })

  describe('默认响应', () => {
    it('应该对不匹配任何关键词的消息返回默认响应', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '随便写点什么' }])
      const parsed = JSON.parse(response)

      expect(parsed.analysis).toContain('随便写点什么')
      expect(parsed.tasks.length).toBeGreaterThanOrEqual(1)
      expect(parsed.message).toContain('随便写点什么')
    })

    it('默认响应应包含核心功能和审查任务', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '搭建项目' }])
      const parsed = JSON.parse(response)
      const titles = parsed.tasks.map((t: any) => t.title)

      expect(titles.some((t: string) => t.includes('核心功能'))).toBe(true)
      expect(titles.some((t: string) => t.includes('审查'))).toBe(true)
    })
  })

  describe('关键词优先级', () => {
    it('应该按顺序匹配第一个匹配的关键词', async () => {
      const response = await mockProvider.chat([{ role: 'user', content: '登录页面需要一个计算器' }])
      const parsed = JSON.parse(response)

      expect(parsed.analysis).toContain('登录')
    })
  })

  describe('stream() 方法', () => {
    it('应该逐字符 yield 响应内容', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: '测试stream' }]
      const chunks: string[] = []

      for await (const chunk of mockProvider.stream(messages)) {
        chunks.push(chunk)
      }

      const fullResponse = chunks.join('')
      expect(fullResponse.length).toBeGreaterThan(0)
      expect(() => JSON.parse(fullResponse)).not.toThrow()
    })

    it('stream 的完整内容应与 chat 返回一致', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: '计算器功能' }]

      const chatResponse = await mockProvider.chat(messages)

      const streamChunks: string[] = []
      for await (const chunk of mockProvider.stream(messages)) {
        streamChunks.push(chunk)
      }
      const streamResponse = streamChunks.join('')

      expect(streamResponse).toBe(chatResponse)
    }, 10000)

    it('应该 yield 多个 chunk', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: '登录' }]
      const chunks: string[] = []

      for await (const chunk of mockProvider.stream(messages)) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(10)
    }, 10000)

    it('应该为登录关键词 stream 正确的 JSON 响应', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: '创建登录' }]
      const chunks: string[] = []

      for await (const chunk of mockProvider.stream(messages)) {
        chunks.push(chunk)
      }

      const parsed = JSON.parse(chunks.join(''))
      expect(parsed.analysis).toContain('登录')
    }, 10000)

    it('应该为默认消息 stream 正确的 JSON 响应', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hello world' }]
      const chunks: string[] = []

      for await (const chunk of mockProvider.stream(messages)) {
        chunks.push(chunk)
      }

      const parsed = JSON.parse(chunks.join(''))
      expect(parsed).toHaveProperty('analysis')
      expect(parsed).toHaveProperty('tasks')
    }, 10000)
  })

  describe('错误处理', () => {
    it('应该处理空消息列表', async () => {
      const messages: ChatMessage[] = []

      const response = await mockProvider.chat(messages)
      expect(response).toBeDefined()
      expect(() => JSON.parse(response)).not.toThrow()
    })

    it('应该处理特殊字符', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '特殊字符：<script>alert("xss")</script>' }
      ]

      const response = await mockProvider.chat(messages)
      expect(response).toBeDefined()
    })

    it('应该处理只有 system 消息的情况', async () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个助手' }
      ]

      const response = await mockProvider.chat(messages)
      expect(response).toBeDefined()
      const parsed = JSON.parse(response)
      expect(parsed).toHaveProperty('analysis')
    })

    it('应该处理空 user content', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '' }
      ]

      const response = await mockProvider.chat(messages)
      expect(response).toBeDefined()
      expect(() => JSON.parse(response)).not.toThrow()
    })

    it('应该处理超长消息', async () => {
      const longContent = '很长的消息'.repeat(1000)
      const messages: ChatMessage[] = [
        { role: 'user', content: longContent }
      ]

      const response = await mockProvider.chat(messages)
      expect(response).toBeDefined()
      const parsed = JSON.parse(response)
      expect(parsed.analysis).toContain(longContent)
    })
  })

  describe('性能', () => {
    it('应该在合理时间内响应', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '性能测试' }
      ]

      const startTime = Date.now()
      await mockProvider.chat(messages)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('stream 应该在合理时间内完成', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: '测试' }]

      const startTime = Date.now()
      const chunks: string[] = []
      for await (const chunk of mockProvider.stream(messages)) {
        chunks.push(chunk)
      }
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(2000)
    })
  })
})
