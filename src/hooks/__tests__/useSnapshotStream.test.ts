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

  beforeEach(() => {
    jest.useFakeTimers()
    MockEventSource.reset()
    globalThis.EventSource = MockEventSource as never
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
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

  it('cleans up the event source and reconnect timer on unmount', async () => {
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
