import { OpenClawGatewayClient, SpawnOptions, SpawnResult, getGatewayClient, resetGatewayClient, createGatewayClient } from '../client'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static throwOnSend: boolean = false
  static noAutoOpen: boolean = false
  
  readyState: number = WebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  
  private url: string
  private sentMessages: any[] = []
  
  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    
    if (!MockWebSocket.noAutoOpen) {
      setTimeout(() => {
        this.readyState = WebSocket.OPEN
        this.onopen?.({ type: 'open' } as Event)
      }, 0)
    }
  }
  
  send(data: string) {
    if (MockWebSocket.throwOnSend) {
      throw new Error('WebSocket is not open')
    }
    this.sentMessages.push(JSON.parse(data))
  }
  
  close() {
    this.readyState = WebSocket.CLOSED
    this.onclose?.({ type: 'close', code: 1000 } as CloseEvent)
  }
  
  simulateMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
  
  simulateError() {
    this.readyState = WebSocket.CLOSED
    this.onerror?.({ type: 'error' } as Event)
  }
  
  getSentMessages() {
    return this.sentMessages
  }
  
  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1]
  }
}

describe('OpenClawGatewayClient', () => {
  let originalWebSocket: typeof WebSocket
  let client: OpenClawGatewayClient
  
  beforeAll(() => {
    originalWebSocket = global.WebSocket
    ;(global as any).WebSocket = MockWebSocket
  })
  
  afterAll(() => {
    global.WebSocket = originalWebSocket
  })
  
  beforeEach(() => {
    MockWebSocket.instances = []
    MockWebSocket.throwOnSend = false
    MockWebSocket.noAutoOpen = false
    client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
  })
  
  afterEach(async () => {
    await client.disconnect()
  })
  
  describe('connect', () => {
    it('应该连接到 Gateway', async () => {
      await expect(client.connect()).resolves.toBeUndefined()
      expect(MockWebSocket.instances.length).toBe(1)
    })
    
    it('连接失败时应该抛出错误', async () => {
      await client.connect()
      const ws = MockWebSocket.instances[0]
      
      const newClient = new OpenClawGatewayClient('ws://127.0.0.1:18789')
      const connectPromise = newClient.connect()
      MockWebSocket.instances[1].simulateError()
      
      await expect(connectPromise).rejects.toThrow('WebSocket connection failed')
    })
    
    it('连接超时应该抛出错误', async () => {
      const shortTimeoutClient = new OpenClawGatewayClient('ws://127.0.0.1:18789', { timeout: 1 })
      MockWebSocket.instances = []
      
      const MockWSNoAutoOpen = class extends MockWebSocket {
        constructor(url: string) {
          super(url)
        }
      }
      ;(MockWSNoAutoOpen.prototype as any).constructor = function(url: string) {
        MockWebSocket.instances.push(this)
        this.readyState = WebSocket.CONNECTING
        this.url = url
        this.onopen = null
        this.onclose = null
        this.onmessage = null
        this.onerror = null
      }
      
      await expect(shortTimeoutClient.connect()).rejects.toThrow()
      await shortTimeoutClient.disconnect()
    }, 10000)
  })
  
  describe('disconnect', () => {
    it('应该断开连接', async () => {
      await client.connect()
      await client.disconnect()
      expect(client.isConnected()).toBe(false)
    })
  })
  
  describe('isConnected', () => {
    it('连接前应该返回 false', () => {
      expect(client.isConnected()).toBe(false)
    })
    
    it('连接后应该返回 true', async () => {
      await client.connect()
      expect(client.isConnected()).toBe(true)
    })
  })
  
  describe('call', () => {
    it('应该发送 RPC 调用并返回响应', async () => {
      await client.connect()
      const ws = MockWebSocket.instances[0]
      
      const callPromise = client.call('health', {})
      
      setTimeout(() => {
        ws.simulateMessage({
          id: 1,
          result: { ok: true }
        })
      }, 10)
      
      const result = await callPromise
      expect(result).toEqual({ ok: true })
    })
    
    it('应该发送正确格式的 RPC 请求', async () => {
      await client.connect()
      const ws = MockWebSocket.instances[0]
      
      const callPromise = client.call('sessions.spawn', { task: 'test' })
      
      setTimeout(() => {
        ws.simulateMessage({
          id: 1,
          result: { status: 'accepted' }
        })
      }, 10)
      
      await callPromise
      
      const lastMessage = ws.getLastMessage()
      expect(lastMessage).toMatchObject({
        jsonrpc: '2.0',
        method: 'sessions.spawn',
        params: { task: 'test' }
      })
      expect(lastMessage.id).toBeDefined()
    })
    
    it('RPC 错误应该抛出异常', async () => {
      await client.connect()
      const ws = MockWebSocket.instances[0]
      
      const callPromise = client.call('invalid.method', {})
      
      setTimeout(() => {
        ws.simulateMessage({
          id: 1,
          error: { code: -32601, message: 'Method not found' }
        })
      }, 10)
      
      await expect(callPromise).rejects.toThrow('Method not found')
    })
  })
  
  describe('sessions_spawn', () => {
    it('应该调用 sessions.spawn 方法', async () => {
      await client.connect()
      const ws = MockWebSocket.instances[0]
      
      const options: SpawnOptions = {
        task: '创建一个登录表单',
        runtime: 'subagent',
        thinking: 'medium'
      }
      
      const spawnPromise = client.sessions_spawn(options)
      
      setTimeout(() => {
        ws.simulateMessage({
          id: 1,
          result: {
            status: 'accepted',
            runId: 'run-123',
            childSessionKey: 'agent:main:subagent:abc'
          }
        })
      }, 10)
      
      const result = await spawnPromise
      
      expect(result).toEqual<SpawnResult>({
        status: 'accepted',
        runId: 'run-123',
        childSessionKey: 'agent:main:subagent:abc'
      })
      
      const lastMessage = ws.getLastMessage()
      expect(lastMessage.method).toBe('sessions.spawn')
      expect(lastMessage.params).toMatchObject({
        task: '创建一个登录表单',
        runtime: 'subagent',
        thinking: 'medium'
      })
    })
    
    it('应该支持 ACP runtime', async () => {
      await client.connect()
      const ws = MockWebSocket.instances[0]
      
      const options: SpawnOptions = {
        task: '使用 OpenCode 实现',
        runtime: 'acp'
      }
      
      const spawnPromise = client.sessions_spawn(options)
      
      setTimeout(() => {
        ws.simulateMessage({
          id: 1,
          result: {
            status: 'accepted',
            runId: 'run-456',
            childSessionKey: 'agent:main:acp:def'
          }
        })
      }, 10)
      
      const result = await spawnPromise
      
      expect(result.status).toBe('accepted')
      expect(ws.getLastMessage().params.runtime).toBe('acp')
    })
    
    it('应该支持所有可选参数', async () => {
      await client.connect()
      const ws = MockWebSocket.instances[0]
      
      const options: SpawnOptions = {
        task: '复杂任务',
        label: 'PM 分析任务',
        agentId: 'pm-agent',
        model: 'zai/glm-5',
        thinking: 'high',
        cwd: '/Users/test/project',
        runTimeoutSeconds: 300
      }
      
      const spawnPromise = client.sessions_spawn(options)
      
      setTimeout(() => {
        ws.simulateMessage({
          id: 1,
          result: {
            status: 'accepted',
            runId: 'run-789',
            childSessionKey: 'agent:main:subagent:xyz'
          }
        })
      }, 10)
      
      await spawnPromise
      
      const params = ws.getLastMessage().params
      expect(params).toEqual({
        task: '复杂任务',
        label: 'PM 分析任务',
        agentId: 'pm-agent',
        model: 'zai/glm-5',
        thinking: 'high',
        cwd: '/Users/test/project',
        runTimeoutSeconds: 300
      })
    })
  })
  
  describe('sessions_history', () => {
    it('应该获取 session 历史记录', async () => {
      await client.connect()
      const ws = MockWebSocket.instances[0]
      
      const historyPromise = client.sessions_history('agent:main:subagent:abc', 10)
      
      setTimeout(() => {
        ws.simulateMessage({
          id: 1,
          result: [
            { role: 'user', content: '创建登录表单' },
            { role: 'assistant', content: '好的，我来创建...' }
          ]
        })
      }, 10)
      
      const result = await historyPromise
      
      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('user')
      
      const lastMessage = ws.getLastMessage()
      expect(lastMessage.method).toBe('sessions.history')
      expect(lastMessage.params.sessionKey).toBe('agent:main:subagent:abc')
      expect(lastMessage.params.limit).toBe(10)
    })
  })
  
  describe('waitForCompletion', () => {
    it('应该等待 session 完成并返回结果', async () => {
      await client.connect()
      
      const sessionKey = 'agent:main:subagent:abc'
      
      let callCount = 0
      const originalCall = client.call.bind(client)
      const callSpy = jest.spyOn(client, 'call').mockImplementation(async (method: string, params: any) => {
        if (method === 'sessions.list') {
          callCount++
          if (callCount < 3) {
            return {
              sessions: [
                { key: sessionKey, status: 'running', endedAt: null }
              ]
            }
          }
          return {
            sessions: [
              { key: sessionKey, status: 'completed', endedAt: '2026-04-19T10:00:00Z' }
            ]
          }
        }
        if (method === 'sessions.history') {
          return [
            { role: 'assistant', content: 'Done!', status: 'completed' }
          ]
        }
        return originalCall(method, params)
      })
      
      const result = await client.waitForCompletion(sessionKey, 5000)
      
      expect(result).toContain('Done!')
      callSpy.mockRestore()
    }, 15000)
  })

  describe('call() error handling', () => {
    it('should handle WebSocket send exception gracefully', async () => {
      await client.connect()
      MockWebSocket.throwOnSend = true

      await expect(client.call('health', {})).rejects.toThrow('WebSocket is not open')
    })
  })

  describe('connect() concurrency guard', () => {
    it('should reject concurrent connect() calls', async () => {
      MockWebSocket.noAutoOpen = true
      MockWebSocket.instances = []

      const clientA = new OpenClawGatewayClient('ws://127.0.0.1:18789')

      const first = clientA.connect()
      const second = clientA.connect()

      const ws = MockWebSocket.instances[0]
      setTimeout(() => {
        ws.readyState = WebSocket.OPEN
        ws.onopen?.({ type: 'open' } as Event)
      }, 10)

      await expect(second).rejects.toThrow(/already.*connect/i)
      await expect(first).resolves.toBeUndefined()

      await clientA.disconnect()
    })
  })
})

describe('getGatewayClient / resetGatewayClient singleton', () => {
  beforeEach(() => {
    resetGatewayClient()
  })

  afterEach(() => {
    resetGatewayClient()
  })

  it('getGatewayClient() should return the same instance', () => {
    const a = getGatewayClient()
    const b = getGatewayClient()
    expect(a).toBe(b)
  })

  it('resetGatewayClient() should clear the singleton', () => {
    const a = getGatewayClient()
    resetGatewayClient()
    const b = getGatewayClient()
    expect(a).not.toBe(b)
  })

  it('getGatewayClient() should use OPENCLAW_GATEWAY_URL env', () => {
    const originalUrl = process.env.OPENCLAW_GATEWAY_URL
    process.env.OPENCLAW_GATEWAY_URL = 'ws://custom:9999'

    const c = getGatewayClient()
    expect(c).toBeInstanceOf(OpenClawGatewayClient)

    process.env.OPENCLAW_GATEWAY_URL = originalUrl
  })
})

describe('Request Isolation - createGatewayClient factory', () => {
  it('createGatewayClient should return a new instance each time', () => {
    const client1 = createGatewayClient()
    const client2 = createGatewayClient()
    expect(client1).not.toBe(client2)
  })

  it('different client instances should have independent WebSocket state', () => {
    const client1 = new OpenClawGatewayClient('ws://localhost:1')
    const client2 = new OpenClawGatewayClient('ws://localhost:2')

    expect(client1.isConnected()).toBe(false)
    expect(client2.isConnected()).toBe(false)
  })

  it('createGatewayClient with custom url should use that url', () => {
    const client = createGatewayClient('ws://custom:8888')
    expect(client).toBeInstanceOf(OpenClawGatewayClient)
  })
})
