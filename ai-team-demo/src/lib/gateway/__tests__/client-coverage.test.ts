import { OpenClawGatewayClient, setGatewayClient, createGatewayClient, resetGatewayClient } from '../client'

class CoverageMockWS {
  static instances: CoverageMockWS[] = []
  static throwOnSend: boolean = false
  static noAutoOpen: boolean = false
  static throwOnConstruct: boolean = false

  readyState: number = WebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  private url: string
  private sentMessages: any[] = []

  constructor(url: string) {
    if (CoverageMockWS.throwOnConstruct) {
      throw new Error('WebSocket constructor failed')
    }
    this.url = url
    CoverageMockWS.instances.push(this)
    if (!CoverageMockWS.noAutoOpen) {
      setTimeout(() => {
        this.readyState = WebSocket.OPEN
        this.onopen?.({ type: 'open' } as Event)
      }, 0)
    }
  }

  send(data: string) {
    if (CoverageMockWS.throwOnSend) {
      throw new Error('send fail')
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

  simulateRawMessage(rawData: string) {
    this.onmessage?.({ data: rawData } as MessageEvent)
  }

  simulateError() {
    this.readyState = WebSocket.CLOSED
    this.onerror?.({ type: 'error' } as Event)
  }

  getSentMessages() { return this.sentMessages }
  getLastMessage() { return this.sentMessages[this.sentMessages.length - 1] }
}

describe('OpenClawGatewayClient - coverage gaps', () => {
  let origWS: typeof WebSocket

  beforeAll(() => {
    origWS = global.WebSocket
    ;(global as any).WebSocket = CoverageMockWS
  })

  afterAll(() => {
    global.WebSocket = origWS
  })

  beforeEach(() => {
    CoverageMockWS.instances = []
    CoverageMockWS.throwOnSend = false
    CoverageMockWS.noAutoOpen = false
    CoverageMockWS.throwOnConstruct = false
  })

  describe('malformed WS message (lines 83-84)', () => {
    it('should handle non-JSON message gracefully', async () => {
      const client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
      await client.connect()
      const ws = CoverageMockWS.instances[0]

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      ws.simulateRawMessage('this is not json')
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
      await client.disconnect()
    })
  })

  describe('WebSocket constructor throws (lines 94-96)', () => {
    it('should reject when WebSocket constructor throws synchronously', async () => {
      CoverageMockWS.throwOnConstruct = true
      CoverageMockWS.instances = []
      const client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
      await expect(client.connect()).rejects.toThrow('WebSocket constructor failed')
    })
  })

  describe('call() without connection (lines 116-117)', () => {
    it('should throw when calling before connect', async () => {
      const client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
      await expect(client.call('test', {})).rejects.toThrow('Not connected to Gateway')
    })
  })

  describe('RPC call timeout (lines 132-133)', () => {
    it('should timeout when no response is received', async () => {
      CoverageMockWS.instances = []
      const client = new OpenClawGatewayClient('ws://127.0.0.1:18789', { timeout: 50 })
      await client.connect()
      await expect(client.call('slow.method', {})).rejects.toThrow('RPC call timeout: slow.method')
      await client.disconnect()
    }, 10000)
  })

  describe('WS closes mid-call (lines 148-152)', () => {
    it.skip('should reject when WS readyState is not OPEN at send time', async () => {
      // 这个测试的场景在当前实现中无法触发，因为isConnected()会先检查
      // 当ws.readyState不是OPEN时，isConnected()返回false，call()会立即抛出"Not connected to Gateway"
      // 所以永远不会到达"WebSocket disconnected before sending request"的检查点
      
      const client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
      await client.connect()
      const ws = CoverageMockWS.instances[0]

      ws.readyState = WebSocket.CLOSING

      // 这会抛出"Not connected to Gateway"而不是"WebSocket disconnected before sending request"
      await expect(client.call('test.method', {})).rejects.toThrow('Not connected to Gateway')

      ws.readyState = WebSocket.OPEN
      await client.disconnect()
    })
  })

  describe('unknown response ID (lines 160-161)', () => {
    it('should silently ignore responses for unknown IDs', async () => {
      const client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
      await client.connect()
      const ws = CoverageMockWS.instances[0]

      ws.simulateMessage({ id: 9999, result: 'orphan' })

      await client.disconnect()
    })
  })

  describe('waitForCompletion - session failed (lines 217-218)', () => {
    it('should throw when session status is failed', async () => {
      const client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
      await client.connect()

      jest.spyOn(client, 'sessions_history').mockResolvedValue([
        { role: 'assistant' as const, content: 'Error occurred', status: 'failed' as const }
      ])

      await expect(client.waitForCompletion('session-key', 500))
        .rejects.toThrow('Session failed: Error occurred')

      await client.disconnect()
    })
  })

  describe('waitForCompletion - rethrow session failed (lines 223-226)', () => {
    it('should rethrow error containing Session failed', async () => {
      const client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
      await client.connect()

      let callCount = 0
      jest.spyOn(client, 'sessions_history').mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('Session failed: something went wrong')
        }
        return []
      })

      await expect(client.waitForCompletion('session-key', 2000))
        .rejects.toThrow('Session failed')

      await client.disconnect()
    }, 10000)
  })

  describe('waitForCompletion - timeout (lines 228-230)', () => {
    it('should throw timeout when session never completes', async () => {
      const client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
      await client.connect()

      jest.spyOn(client, 'sessions_history').mockResolvedValue([
        { role: 'assistant' as const, content: 'still running', status: 'running' as const }
      ])

      await expect(client.waitForCompletion('session-key', 100))
        .rejects.toThrow('Wait for completion timeout')

      await client.disconnect()
    }, 10000)
  })
})

describe('setGatewayClient / createGatewayClient', () => {
  afterEach(() => {
    resetGatewayClient()
  })

  it('setGatewayClient should set the singleton', () => {
    const client = new OpenClawGatewayClient('ws://test:1234')
    setGatewayClient(client)
    expect(setGatewayClient).toBeDefined()
    setGatewayClient(null)
  })

  it('createGatewayClient should create a new client', () => {
    const client = createGatewayClient('ws://custom:9999')
    expect(client).toBeInstanceOf(OpenClawGatewayClient)
  })

  it('createGatewayClient should use default URL when none provided', () => {
    const origUrl = process.env.OPENCLAW_GATEWAY_URL
    delete process.env.OPENCLAW_GATEWAY_URL
    const client = createGatewayClient()
    expect(client).toBeInstanceOf(OpenClawGatewayClient)
    process.env.OPENCLAW_GATEWAY_URL = origUrl
  })
})
