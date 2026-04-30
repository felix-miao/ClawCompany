jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('@/lib/security/utils', () => ({
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
}))

jest.mock('@/lib/gateway/session-sync', () => ({
  SessionSyncService: jest.fn(() => ({})),
}))

jest.mock('@/lib/gateway/snapshot-cache', () => ({
  getCachedOpenClawSnapshot: jest.fn(),
}))

import { ReadableStream } from 'stream/web'

import { GET } from '../route'

import { getCachedOpenClawSnapshot } from '@/lib/gateway/snapshot-cache'
import type { OpenClawSnapshot } from '@/lib/gateway/openclaw-snapshot'

const mockGetCachedOpenClawSnapshot = getCachedOpenClawSnapshot as jest.Mock
const API_KEY = 'test-api-key-12345678901234567890'

globalThis.ReadableStream = ReadableStream as never
globalThis.Response = class MockResponse {
  body: ReadableStream | null
  status: number
  headers: Headers

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this.body = body as ReadableStream | null
    this.status = init?.status ?? 200
    this.headers = new Headers(init?.headers)
  }
} as never

const makeSnapshot = (overrides: Partial<OpenClawSnapshot> = {}): OpenClawSnapshot => ({
  agents: [{ id: 'agent-1', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null }],
  sessions: [],
  tasks: [],
  metrics: {
    agents: { total: 1, active: 0, idle: 1, byRole: { pm: 1 } },
    sessions: { total: 0, active: 0, completed: 0, failed: 0 },
    tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    source: 'gateway',
    fetchedAt: '2026-04-28T00:00:00Z',
  },
  connected: true,
  fetchedAt: '2026-04-28T00:00:00Z',
  ...overrides,
})

function createRequest(options: { noAuth?: boolean; signal?: AbortSignal } = {}) {
  const headers: Record<string, string> = options.noAuth ? {} : { 'x-api-key': API_KEY }
  return {
    url: 'http://localhost/api/openclaw/snapshot/stream',
    signal: options.signal ?? new AbortController().signal,
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
  }
}

async function readChunk(response: Response): Promise<string> {
  const reader = response.body!.getReader()
  const result = await reader.read()
  reader.releaseLock()
  return new TextDecoder().decode(result.value)
}

describe('/api/openclaw/snapshot/stream', () => {
  const originalApiKey = process.env.AGENT_API_KEY

  beforeAll(() => {
    process.env.AGENT_API_KEY = API_KEY
  })

  afterAll(() => {
    if (originalApiKey) process.env.AGENT_API_KEY = originalApiKey
    else delete process.env.AGENT_API_KEY
  })

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('opens an SSE connection and sends the initial full snapshot', async () => {
    mockGetCachedOpenClawSnapshot.mockResolvedValue(makeSnapshot())

    const response = await GET(createRequest() as never)
    const chunk = await readChunk(response)

    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(chunk).toContain('event: snapshot-full')
    expect(chunk).toContain('"agents"')
    expect(chunk).toContain('agent-1')
  })

  it('sends a structured SSE error instead of an empty response when the initial snapshot fails', async () => {
    mockGetCachedOpenClawSnapshot.mockRejectedValue(new Error('Gateway unavailable'))

    const response = await GET(createRequest() as never)
    const chunk = await readChunk(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(chunk).toContain('event: snapshot-error')
    expect(chunk).toContain('Gateway unavailable')
  })

  it('sends subsequent diff events when the snapshot changes', async () => {
    const first = makeSnapshot()
    const second = makeSnapshot({
      agents: [{ ...first.agents[0], status: 'working', currentTask: 'Streaming' }],
    })
    mockGetCachedOpenClawSnapshot.mockResolvedValueOnce(first).mockResolvedValue(second)

    const response = await GET(createRequest() as never)
    const reader = response.body!.getReader()
    await reader.read()

    await jest.advanceTimersByTimeAsync(5000)
    const result = await reader.read()
    const chunk = new TextDecoder().decode(result.value)

    expect(chunk).toContain('event: snapshot-diff')
    expect(chunk).toContain('Streaming')
    reader.releaseLock()
  })

  it('cleans up polling on abort', async () => {
    const abort = new AbortController()
    mockGetCachedOpenClawSnapshot.mockResolvedValue(makeSnapshot())

    await GET(createRequest({ signal: abort.signal }) as never)
    abort.abort()
    await jest.advanceTimersByTimeAsync(15000)

    expect(mockGetCachedOpenClawSnapshot).toHaveBeenCalledTimes(1)
  })

  it('sends keepalive comments every 30 seconds', async () => {
    mockGetCachedOpenClawSnapshot.mockResolvedValue(makeSnapshot())

    const response = await GET(createRequest() as never)
    const reader = response.body!.getReader()
    await reader.read()

    await jest.advanceTimersByTimeAsync(30000)
    const result = await reader.read()
    const chunk = new TextDecoder().decode(result.value)

    expect(chunk).toBe(': keepalive\n\n')
    reader.releaseLock()
  })

  it('sends an SSE error event instead of breaking the response when snapshot fetch fails', async () => {
    mockGetCachedOpenClawSnapshot.mockRejectedValueOnce(new Error('Gateway unreachable'))

    const response = await GET(createRequest() as never)
    const chunk = await readChunk(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(chunk).toContain('event: snapshot-error')
    expect(chunk).toContain('Gateway unreachable')
  })

  it('requires authentication', async () => {
    const response = await GET(createRequest({ noAuth: true }) as never)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ success: false, error: 'Unauthorized' })
  })
})
