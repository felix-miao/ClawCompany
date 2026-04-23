import { ReadableStream as NodeReadableStream } from 'node:stream/web'

jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(url: string) {}
  },
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/api/route-utils', () => ({
  getClientId: () => 'mock-ip',
  withAuth: jest.fn((handler) => handler),
  withRateLimit: jest.fn((handler) => handler),
  successResponse: jest.fn(),
}))

jest.mock('@/lib/gateway/session-poller', () => ({
  getSessionPoller: jest.fn(() => ({
    isRunning: () => false,
    start: jest.fn(),
    stop: jest.fn(),
  })),
}))

import { GET } from '../route'
import { GameEventStore, resetGameEventStore, setGameEventStore } from '@/game/data/GameEventStore'
import { createMockNextRequest } from '@/test-utils/next-request-mock'

function decodeSseBody(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return Promise.resolve('')

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let output = ''

  const readChunk = (): Promise<string> =>
    reader.read().then(({ done, value }) => {
      if (done) return output
      output += decoder.decode(value, { stream: true })
      return readChunk()
    })

  return readChunk().finally(() => reader.releaseLock())
}

describe('Game events SSE replay', () => {
  beforeAll(() => {
    ;(globalThis as any).ReadableStream = NodeReadableStream
    ;(globalThis as any).Response = class Response {
      body: unknown

      constructor(body?: unknown, _init?: { headers?: unknown; status?: number }) {
        this.body = body
      }
    }
  })

  beforeEach(() => {
    GameEventStore.clearAllSubscribers()
    resetGameEventStore()
    setGameEventStore(new GameEventStore())
  })

  afterEach(() => {
    GameEventStore.clearAllSubscribers()
    resetGameEventStore()
  })

  it('replays missed events after the open event when Last-Event-ID is provided', async () => {
    const store = new GameEventStore()
    setGameEventStore(store)

    const missedEvent = {
      type: 'agent:status-change' as const,
      agentId: 'dev1',
      status: 'busy' as const,
      timestamp: 200,
    }
    store.push({
      type: 'agent:status-change',
      agentId: 'dev0',
      status: 'idle',
      timestamp: 100,
    })
    store.push(missedEvent)

    const controller = new AbortController()
    const request = createMockNextRequest({
      method: 'GET',
      headers: { 'Last-Event-ID': '150' },
      url: 'http://localhost:3000/api/game-events',
    }) as any
    request.signal = controller.signal

    const response = await GET(request)
    controller.abort()
    const body = await decodeSseBody(response.body)

    const openIndex = body.indexOf('event: connection')
    const replayIndex = body.indexOf('event: agent:status-change')

    expect(openIndex).toBeGreaterThanOrEqual(0)
    expect(replayIndex).toBeGreaterThan(openIndex)
    expect(body).toContain('id: 200')
    expect(body).toContain('"agentId":"dev1"')
  })
})
