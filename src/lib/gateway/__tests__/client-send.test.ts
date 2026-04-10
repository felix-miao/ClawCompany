import { OpenClawGatewayClient, SendOptions, SendResult } from '../client'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static throwOnSend: boolean = false

  readyState: number = WebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  private sentMessages: any[] = []

  constructor(url: string) {
    MockWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.onopen?.({ type: 'open' } as Event)
    }, 0)
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

  getSentMessages() {
    return this.sentMessages
  }

  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1]
  }
}

describe('OpenClawGatewayClient.sessions_send', () => {
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
    client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
  })

  afterEach(async () => {
    await client.disconnect()
  })

  it('should call sessions.send via RPC', async () => {
    await client.connect()
    const ws = MockWebSocket.instances[0]

    const sendPromise = client.sessions_send('agent:main:subagent:abc', 'Hello agent')

    setTimeout(() => {
      ws.simulateMessage({
        id: 1,
        result: { status: 'sent', messageId: 'msg-123' }
      })
    }, 10)

    const result = await sendPromise

    expect(result).toEqual<SendResult>({
      status: 'sent',
      messageId: 'msg-123',
    })

    const lastMessage = ws.getLastMessage()
    expect(lastMessage.method).toBe('sessions.send')
    expect(lastMessage.params).toMatchObject({
      sessionKey: 'agent:main:subagent:abc',
      message: 'Hello agent',
    })
  })

  it('should support SendOptions', async () => {
    await client.connect()
    const ws = MockWebSocket.instances[0]

    const options: SendOptions = { role: 'user' }
    const sendPromise = client.sessions_send('agent:main:subagent:abc', 'Test message', options)

    setTimeout(() => {
      ws.simulateMessage({
        id: 1,
        result: { status: 'sent' }
      })
    }, 10)

    await sendPromise

    const lastMessage = ws.getLastMessage()
    expect(lastMessage.params.role).toBe('user')
  })

  it('should throw when not connected', async () => {
    await expect(
      client.sessions_send('agent:main:subagent:abc', 'Hello')
    ).rejects.toThrow('Not connected to Gateway')
  })

  it('should handle RPC timeout', async () => {
    const shortTimeoutClient = new OpenClawGatewayClient('ws://127.0.0.1:18789', { timeout: 50 })
    await shortTimeoutClient.connect()

    await expect(
      shortTimeoutClient.sessions_send('agent:main:subagent:abc', 'Hello')
    ).rejects.toThrow('RPC call timeout: sessions.send')

    await shortTimeoutClient.disconnect()
  }, 10000)

  it('should handle error result from gateway', async () => {
    await client.connect()
    const ws = MockWebSocket.instances[0]

    const sendPromise = client.sessions_send('agent:main:subagent:abc', 'Hello')

    setTimeout(() => {
      ws.simulateMessage({
        id: 1,
        error: { code: -32000, message: 'Session not found' }
      })
    }, 10)

    await expect(sendPromise).rejects.toThrow('Session not found')
  })
})
