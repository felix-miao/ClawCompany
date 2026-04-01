import { GatewayProvider } from '../gateway'
import { ChatMessage } from '../types'
import * as gatewayClient from '@/lib/gateway/client'

jest.mock('@/lib/gateway/client', () => ({
  OpenClawGatewayClient: jest.fn(),
  getGatewayClient: jest.fn()
}))

describe('GatewayProvider', () => {
  let gatewayProvider: GatewayProvider
  let mockClient: any

  const mockSpawnResult = {
    status: 'accepted' as const,
    runId: 'test-run-id',
    childSessionKey: 'test-session-key'
  }

  const mockHistory = [
    {
      role: 'assistant' as const,
      content: '这是测试响应',
      status: 'completed' as const
    }
  ]

  beforeEach(() => {
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      sessions_spawn: jest.fn().mockResolvedValue(mockSpawnResult),
      sessions_history: jest.fn().mockResolvedValue(mockHistory),
      waitForCompletion: jest.fn().mockResolvedValue('这是测试响应')
    }

    ;(gatewayClient.getGatewayClient as jest.Mock).mockReturnValue(mockClient)
    ;(gatewayClient.OpenClawGatewayClient as jest.Mock).mockImplementation(() => mockClient)

    gatewayProvider = new GatewayProvider(mockClient)
    jest.clearAllMocks()
  })

  describe('初始化', () => {
    it('应该正确初始化', () => {
      expect(gatewayProvider).toBeDefined()
    })

    it('应该使用提供的 client', () => {
      expect(gatewayProvider).toBeInstanceOf(GatewayProvider)
    })

    it('应该在没有 client 时创建默认 client', () => {
      const provider = new GatewayProvider()
      expect(provider).toBeDefined()
    })
  })

  describe('chat 方法', () => {
    it('应该成功调用 Gateway API', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '测试消息' }
      ]

      const response = await gatewayProvider.chat(messages)

      expect(response).toBe('这是测试响应')
      expect(mockClient.connect).toHaveBeenCalled()
      expect(mockClient.sessions_spawn).toHaveBeenCalled()
    })

    it('应该发送正确的任务描述', async () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个助手' },
        { role: 'user', content: '用户消息' }
      ]

      await gatewayProvider.chat(messages)

      const spawnCall = mockClient.sessions_spawn.mock.calls[0][0]
      expect(spawnCall.task).toContain('用户消息')
      expect(spawnCall.runtime).toBe('subagent')
    })

    it('应该处理 Gateway 错误', async () => {
      mockClient.sessions_spawn.mockResolvedValueOnce({
        status: 'error',
        error: 'Spawn failed'
      })

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      await expect(gatewayProvider.chat(messages)).rejects.toThrow('Spawn failed')
    })

    it('应该处理连接错误', async () => {
      const errorMockClient = {
        connect: jest.fn()
          .mockRejectedValueOnce(new Error('Connection failed'))
          .mockRejectedValueOnce(new Error('Connection failed'))
          .mockRejectedValueOnce(new Error('Connection failed')),
        disconnect: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(false),
        sessions_spawn: jest.fn().mockResolvedValue(mockSpawnResult),
        sessions_history: jest.fn().mockResolvedValue(mockHistory),
        waitForCompletion: jest.fn().mockResolvedValue('这是测试响应')
      }

      const errorProvider = new GatewayProvider({ 
        client: errorMockClient as any,
        maxRetries: 3,
        retryDelay: 10
      })

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      await expect(errorProvider.chat(messages)).rejects.toThrow('Connection failed')
    })

    it('应该处理超时', async () => {
      mockClient.waitForCompletion.mockRejectedValueOnce(new Error('Timeout'))

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      await expect(gatewayProvider.chat(messages)).rejects.toThrow('Timeout')
    })

    it('应该处理多轮对话', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '第一轮' },
        { role: 'assistant', content: '回复1' },
        { role: 'user', content: '第二轮' }
      ]

      const response = await gatewayProvider.chat(messages)

      expect(response).toBeDefined()
      expect(mockClient.sessions_spawn).toHaveBeenCalled()
    })
  })

  describe('连接管理', () => {
    it('应该在第一次调用时连接', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      await gatewayProvider.chat(messages)

      expect(mockClient.connect).toHaveBeenCalledTimes(1)
    })

    it('应该复用现有连接', async () => {
      const messages1: ChatMessage[] = [
        { role: 'user', content: '测试1' }
      ]
      const messages2: ChatMessage[] = [
        { role: 'user', content: '测试2' }
      ]

      await gatewayProvider.chat(messages1)
      await gatewayProvider.chat(messages2)

      expect(mockClient.connect).toHaveBeenCalledTimes(1)
    })
  })

  describe('错误处理和重试', () => {
    it('应该在连接失败时重试', async () => {
      mockClient.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(undefined)

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      const response = await gatewayProvider.chat(messages)

      expect(response).toBeDefined()
      expect(mockClient.connect).toHaveBeenCalledTimes(2)
    })

    it('应该在重试失败后抛出错误', async () => {
      mockClient.connect
        .mockRejectedValueOnce(new Error('Connection failed 1'))
        .mockRejectedValueOnce(new Error('Connection failed 2'))
        .mockRejectedValueOnce(new Error('Connection failed 3'))

      const messages: ChatMessage[] = [
        { role: 'user', content: '测试' }
      ]

      await expect(gatewayProvider.chat(messages)).rejects.toThrow()
    }, 10000)
  })

  describe('性能', () => {
    it('应该在合理时间内响应', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '性能测试' }
      ]

      const startTime = Date.now()
      await gatewayProvider.chat(messages)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000)
    })
  })
})
