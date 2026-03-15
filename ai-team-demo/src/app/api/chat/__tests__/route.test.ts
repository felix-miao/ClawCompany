// Chat API 完整测试

import { NextRequest } from 'next/server'
import { POST, GET } from '../route'

describe('Chat API', () => {
  beforeEach(() => {
    // 重置状态
  })

  describe('POST /api/chat', () => {
    it('应该返回正确的消息格式', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '测试消息' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.chatHistory).toBeDefined()
      expect(Array.isArray(data.chatHistory)).toBe(true)
    })

    it('消息应该包含 timestamp 字段', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '测试' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.chatHistory[0]).toHaveProperty('timestamp')
      expect(data.chatHistory[0].timestamp).toBeDefined()
    })

    it('timestamp 应该是有效的日期字符串', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '测试' }),
      })

      const response = await POST(request)
      const data = await response.json()

      const timestamp = data.chatHistory[0].timestamp
      const date = new Date(timestamp)
      expect(date instanceof Date).toBe(true)
      expect(isNaN(date.getTime())).toBe(false)
    })

    it('所有消息都应该有 timestamp', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '创建登录页面' }),
      })

      const response = await POST(request)
      const data = await response.json()

      data.chatHistory.forEach((msg: any) => {
        expect(msg).toHaveProperty('timestamp')
        expect(msg.timestamp).toBeDefined()
        const date = new Date(msg.timestamp)
        expect(isNaN(date.getTime())).toBe(false)
      })
    })

    it('消息应该包含正确的 agent 字段', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '测试' }),
      })

      const response = await POST(request)
      const data = await response.json()

      data.chatHistory.forEach((msg: any) => {
        expect(['user', 'pm', 'dev', 'review']).toContain(msg.agent)
      })
    })

    it('消息应该包含 content 字段', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '测试' }),
      })

      const response = await POST(request)
      const data = await response.json()

      data.chatHistory.forEach((msg: any) => {
        expect(msg).toHaveProperty('content')
        expect(typeof msg.content).toBe('string')
      })
    })

    it('应该返回任务列表', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '创建登录页面' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.tasks).toBeDefined()
      expect(Array.isArray(data.tasks)).toBe(true)
    })

    it('任务应该包含必要的字段', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '创建登录页面' }),
      })

      const response = await POST(request)
      const data = await response.json()

      data.tasks.forEach((task: any) => {
        expect(task).toHaveProperty('id')
        expect(task).toHaveProperty('title')
        expect(task).toHaveProperty('status')
        expect(task).toHaveProperty('assignedTo')
      })
    })

    it('空消息应该返回错误', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/chat', () => {
    it('应该返回当前状态', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tasks).toBeDefined()
      expect(data.chatHistory).toBeDefined()
    })
  })
})
