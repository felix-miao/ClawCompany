import { act, renderHook, waitFor } from '@testing-library/react'

import { useSnapshotStream } from '../useSnapshotStream'

global.fetch = jest.fn()

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

  beforeEach(() => {
    jest.useFakeTimers()
    ;(global.fetch as jest.Mock).mockReset()
    MockEventSource.reset()
    globalThis.EventSource = MockEventSource as never
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
    expect(result.current.connected).toBe(true)
    expect(result.current.agents).toEqual(baseSnapshot.agents)
    expect(result.current.metrics).toEqual(baseSnapshot.metrics)
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

  it('reconnects with exponential backoff after errors', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Fallback unavailable'))
    const { result } = renderHook(() => useSnapshotStream())
    const first = MockEventSource.instances[0]

    act(() => {
      first.open()
      first.error()
    })

    expect(result.current.connected).toBe(false)
    expect(first.readyState).toBe(MockEventSource.CLOSED)
    expect(MockEventSource.instances).toHaveLength(1)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000)
    })

    expect(MockEventSource.instances).toHaveLength(2)
  })

  it('falls back to /api/openclaw/snapshot when the stream errors before data arrives', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, ...baseSnapshot }),
    })

    const { result } = renderHook(() => useSnapshotStream())
    const source = MockEventSource.instances[0]

    act(() => {
      source.error()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/openclaw/snapshot', {
      headers: { 'x-api-key': 'dashboard' },
    })
    expect(result.current.agents).toEqual(baseSnapshot.agents)
    expect(result.current.tasks).toEqual(baseSnapshot.tasks)
    expect(result.current.metrics).toEqual(baseSnapshot.metrics)
    expect(result.current.connected).toBe(false)
  })

  it('continues using stream snapshots after a fallback snapshot was loaded', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, ...baseSnapshot, connected: false }),
    })

    const streamSnapshot = {
      ...baseSnapshot,
      agents: [{ ...baseSnapshot.agents[0], status: 'working', currentTask: 'Recovered stream' }],
      connected: true,
    }

    const { result } = renderHook(() => useSnapshotStream())
    const first = MockEventSource.instances[0]

    act(() => {
      first.error()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000)
    })

    const second = MockEventSource.instances[1]
    act(() => {
      second.open()
      second.emit('snapshot-full', streamSnapshot)
    })

    await waitFor(() => expect(result.current.agents[0].currentTask).toBe('Recovered stream'))
    expect(result.current.connected).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('cleans up the event source and reconnect timer on unmount', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Fallback unavailable'))
    const { unmount } = renderHook(() => useSnapshotStream())
    const first = MockEventSource.instances[0]

    act(() => {
      first.error()
    })

    unmount()
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000)
    })

    expect(first.readyState).toBe(MockEventSource.CLOSED)
    expect(MockEventSource.instances).toHaveLength(1)
  })
})
