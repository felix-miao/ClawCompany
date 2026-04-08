/**
 * 类型安全的 NextRequest mock 测试
 * 验证 mock 函数的正确性
 */

import { createMockRequest } from '@/test-utils/next-request-mock'

// Jest环境检查，避免导入NextRequest导致的错误
const isJest = typeof jest !== 'undefined'

describe('NextRequest Mock', () => {
  describe('Basic functionality', () => {
    it('should create a valid mock request', () => {
      const request = createMockRequest({
        url: 'http://localhost/api/agent',
        method: 'POST'
      })

      expect(request).toBeDefined()
      expect(request.url).toBe('http://localhost/api/agent')
      expect(request.method).toBe('POST')
    })

    it('should handle JSON body', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          agentId: 'pm-agent',
          userMessage: 'Hello'
        }
      })

      const body = await request.json()
      expect(body).toEqual({
        agentId: 'pm-agent',
        userMessage: 'Hello'
      })
    })

    it('should handle string body', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: 'Hello World'
      })

      const body = await request.json()
      expect(body).toBe('Hello World')
    })
  })

  describe('Headers', () => {
    it('should get headers correctly', () => {
      const request = createMockRequest({
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'test-value'
        }
      })

      expect(request.headers.get('content-type')).toBe('application/json')
      expect(request.headers.get('x-custom-header')).toBe('test-value')
      expect(request.headers.get('non-existent')).toBeNull()
    })
  })

  describe('Cookies', () => {
    it('should have cookies property', () => {
      const request = createMockRequest()
      
      expect(request.cookies).toBeDefined()
      expect(typeof request.cookies.get).toBe('function')
      expect(typeof request.cookies.has).toBe('function')
    })
  })

  describe('NextUrl', () => {
    it('should have nextUrl property', () => {
      const request = createMockRequest({
        url: 'http://localhost/api/agent?test=123'
      })
      
      expect(request.nextUrl).toBeDefined()
      expect(request.nextUrl.pathname).toBe('/api/agent')
      expect(request.nextUrl.searchParams.get('test')).toBe('123')
    })
  })

  describe('Deprecated properties', () => {
    it('should have deprecated page property', () => {
      const request = createMockRequest()

      // page 属性已实现用于向后兼容
      expect(request).toHaveProperty('page')
      expect(request.page).toBeDefined()
    })

    it('should have deprecated ua property', () => {
      const request = createMockRequest()

      // ua 属性已实现用于向后兼容
      expect(request).toHaveProperty('ua')
      expect(request.ua).toBeDefined()
    })
  })

  describe('Authentication', () => {
    it('should include API key by default', () => {
      // 设置测试环境变量
      const originalApiKey = process.env.AGENT_API_KEY
      process.env.AGENT_API_KEY = 'test-api-key'

      const request = createMockRequest()

      expect(request.headers.get('x-api-key')).toBeDefined()
      expect(request.headers.get('x-api-key')).not.toBeNull()
      expect(request.headers.get('x-api-key')).toBe('test-api-key')

      // 清理环境变量
      process.env.AGENT_API_KEY = originalApiKey
    })

    it('should skip API key when noAuth is true', () => {
      const request = createMockRequest({
        noAuth: true
      })
      
      expect(request.headers.get('x-api-key')).toBeNull()
    })
  })

  describe('Error handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const request = createMockRequest({
        body: 'invalid json {'
      })

      // Should not throw, should return the raw string
      const body = await request.json()
      expect(body).toBe('invalid json {')
    })

    it('should handle empty body', async () => {
      const request = createMockRequest({
        method: 'POST'
        // No body provided
      })

      const body = await request.json()
      expect(body).toEqual({})
    })
  })
})