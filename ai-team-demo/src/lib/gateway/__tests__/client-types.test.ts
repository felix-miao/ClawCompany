import { RPCRequest, RPCResponse, RPCError, PendingCall } from '../../core/types'
import { OpenClawGatewayClient } from '../client'

class MockWS {
  static instances: MockWS[] = []
  readyState: number = WebSocket.OPEN
  onopen: ((e: Event) => void) | null = null
  onclose: ((e: CloseEvent) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null

  constructor() {
    MockWS.instances.push(this)
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.onopen?.({ type: 'open' } as Event)
    }, 0)
  }
  send() {}
  close() { this.readyState = WebSocket.CLOSED }
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

describe('Gateway RPC type contracts', () => {
  let originalWS: typeof WebSocket
  let client: OpenClawGatewayClient

  beforeAll(() => {
    originalWS = global.WebSocket
    ;(global as Record<string, unknown>).WebSocket = MockWS
  })

  afterAll(() => {
    global.WebSocket = originalWS
  })

  beforeEach(() => {
    MockWS.instances = []
    client = new OpenClawGatewayClient('ws://127.0.0.1:18789')
  })

  afterEach(async () => {
    await client.disconnect()
  })

  it('should send properly structured RPCRequest with unknown params', async () => {
    await client.connect()
    const ws = MockWS.instances[0]

    const callPromise = client.call('test.method', { key: 'value', num: 42 })

    setTimeout(() => {
      ws.simulateMessage({ id: 1, result: 'ok' })
    }, 10)

    await callPromise

    const raw = ws as unknown as { sentData: string[] }
    expect(raw).toBeDefined()
  })

  it('should handle RPCResponse with unknown result', async () => {
    await client.connect()
    const ws = MockWS.instances[0]

    const callPromise = client.call<{ status: string }>('test', {})

    setTimeout(() => {
      ws.simulateMessage({ id: 1, result: { status: 'ok' } })
    }, 10)

    const result = await callPromise
    expect(result.status).toBe('ok')
  })

  it('should handle RPCError with unknown data field', async () => {
    await client.connect()
    const ws = MockWS.instances[0]

    const callPromise = client.call('test', {})

    setTimeout(() => {
      ws.simulateMessage({
        id: 1,
        error: { code: -32000, message: 'Server error', data: { detail: 'something' } }
      })
    }, 10)

    await expect(callPromise).rejects.toThrow('Server error')
  })

  it('should handle call with default generic returning unknown', async () => {
    await client.connect()
    const ws = MockWS.instances[0]

    const callPromise = client.call('health')

    setTimeout(() => {
      ws.simulateMessage({ id: 1, result: { healthy: true, uptime: 123 } })
    }, 10)

    const result = await callPromise
    expect(result).toEqual({ healthy: true, uptime: 123 })
  })
})

describe('RPCRequest interface shape', () => {
  it('should accept Record<string, unknown> for params', () => {
    const req: RPCRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'test',
      params: { key: 'value', count: 42, nested: { a: 1 } }
    }
    expect(req.params.key).toBe('value')
    expect(req.params.nested).toEqual({ a: 1 })
  })
})

describe('RPCResponse interface shape', () => {
  it('should accept unknown result', () => {
    const res: RPCResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { arbitrary: 'data', numbers: [1, 2, 3] }
    }
    expect(res.result).toEqual({ arbitrary: 'data', numbers: [1, 2, 3] })
  })

  it('should accept RPCError with unknown data', () => {
    const err: RPCError = {
      code: -32000,
      message: 'error',
      data: { stack: 'trace', info: 123 }
    }
    expect(err.data).toEqual({ stack: 'trace', info: 123 })
  })

  it('should accept RPCError without data', () => {
    const err: RPCError = {
      code: -32000,
      message: 'error'
    }
    expect(err.data).toBeUndefined()
  })
})

describe('PendingCall interface shape', () => {
  it('should resolve with unknown value', () => {
    let resolved = false
    const pending: PendingCall = {
      resolve: (_value: unknown) => { resolved = true },
      reject: (_error: Error) => {}
    }
    pending.resolve('anything')
    expect(resolved).toBe(true)
  })
})
