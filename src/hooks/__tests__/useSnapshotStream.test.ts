import { act, renderHook, waitFor } from '@testing-library/react'

import { useSnapshotStream } from '../useSnapshotStream'

const baseSnapshot = {
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
}

const fallbackSnapshot = {
  ...baseSnapshot,
  agents: [
    { id: 'pm-agent', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
    { id: 'dev-agent', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
    { id: 'review-agent', name: 'Reviewer Claw', role: 'review', status: 'idle', emotion: 'neutral', currentTask: null },
    { id: 'test-agent', name: 'Tester Claw', role: 'test', status: 'idle', emotion: 'neutral', currentTask: null },
  ],
  metrics: {
    ...baseSnapshot.metrics,
    agents: { total: 4, active: 0, idle: 4, byRole: { pm: 1, dev: 1, review: 1, test: 1 } },
    source: 'fallback',
  },
  connected: false,
}

class MockEventSource {
  static instances: MockEventSource[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  readyState = 0
  url: string
  private listeners = new Map<string, Array<(event: { data: string }) => void>>()

  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: { data: string }) => void): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED
  }

  emit(type: string, data: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) })
    }
  }

  open(): void {
    this.readyState = MockEventSource.OPEN
    this.onopen?.()
  }

  error(): void {
    this.onerror?.()
  }

  static reset(): void {
    MockEventSource.instances = []
  }
}

describe('useSnapshotStream', () => {
  const originalEventSource = globalThis.EventSource
  const originalFetch = globalThis.fetch
  const mockFetch = jest.fn()

  beforeEach(() => {
    jest.useFakeTimers()
    MockEventSource.reset()
    globalThis.EventSource = MockEventSource as never
    globalThis.fetch = mockFetch as never
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => fallbackSnapshot })
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
    globalThis.fetch = originalFetch
    jest.useRealTimers()
  })

  it('connects and populates state from the initial full snapshot', async () => {
    const { result } = renderHook(() => useSnapshotStream())
    const source = MockEventSource.instances[0]

    act(() => {
      source.open()
      source.emit('snapshot-full', baseSnapshot)
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(source.url).toBe('/api/openclaw/snapshot/stream')
    expect(mockFetch).toHaveBeenCalledWith('/api/openclaw/snapshot', expect.objectContaining({ cache: 'no-store' }))
    expect(result.current.connected).toBe(true)
    expect(result.current.agents).toEqual(baseSnapshot.agents)
    expect(result.current.metrics).toEqual(baseSnapshot.metrics)
  })

  it('bootstraps from the snapshot endpoint while opening the stream', async () => {
    const { result } = renderHook(() => useSnapshotStream())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(MockEventSource.instances[0].url).toBe('/api/openclaw/snapshot/stream')
    expect(mockFetch).toHaveBeenCalledWith('/api/openclaw/snapshot', expect.objectContaining({ cache: 'no-store' }))
    expect(result.current.agents).toHaveLength(4)
  })

  it('merges diff events into current state', async () => {
    const { result } = renderHook(() => useSnapshotStream())
    const source = MockEventSource.instances[0]

    act(() => {
      source.open()
      source.emit('snapshot-full', baseSnapshot)
      source.emit('snapshot-diff', {
        agents: {
          changed: [{ ...baseSnapshot.agents[0], status: 'working', currentTask: 'Streaming' }],
          removed: [],
        },
        metrics: {
          ...baseSnapshot.metrics,
          agents: { total: 1, active: 1, idle: 0, byRole: { pm: 1 } },
        },
      })
    })

    await waitFor(() => expect(result.current.agents[0].currentTask).toBe('Streaming'))
    expect(result.current.metrics?.agents.active).toBe(1)
  })

  it('falls back to the snapshot endpoint after stream errors and slows reconnects', async () => {
    const { result } = renderHook(() => useSnapshotStream())
    const first = MockEventSource.instances[0]

    act(() => {
      first.open()
      first.error()
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.agents).toHaveLength(4)
    expect(mockFetch).toHaveBeenCalledWith('/api/openclaw/snapshot', expect.objectContaining({ cache: 'no-store' }))
    expect(result.current.connected).toBe(false)
    expect(first.readyState).toBe(MockEventSource.CLOSED)
    expect(MockEventSource.instances).toHaveLength(1)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(14999)
    })

    expect(MockEventSource.instances).toHaveLength(1)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1)
    })

    expect(MockEventSource.instances).toHaveLength(2)
  })

  it('falls back when the stream sends a snapshot-error event', async () => {
    const { result } = renderHook(() => useSnapshotStream())
    const source = MockEventSource.instances[0]

    act(() => {
      source.open()
      source.emit('snapshot-error', { error: 'Gateway unreachable' })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.agents).toHaveLength(4)
    expect(mockFetch).toHaveBeenCalledWith('/api/openclaw/snapshot', expect.objectContaining({ cache: 'no-store' }))
    expect(source.readyState).toBe(MockEventSource.CLOSED)
  })

  it('cleans up the event source and reconnect timer on unmount', async () => {
    const { unmount } = renderHook(() => useSnapshotStream())
    const first = MockEventSource.instances[0]

    act(() => {
      first.error()
    })

    unmount()
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000)
    })

    expect(first.readyState).toBe(MockEventSource.CLOSED)
    expect(MockEventSource.instances).toHaveLength(1)
  })
})
