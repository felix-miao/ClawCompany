import { renderHook, act } from '@testing-library/react'

const refresh = jest.fn()

jest.mock('../useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: jest.fn(),
}))

import { useOpenClawSnapshot } from '../useOpenClawSnapshot'
import { useOpenClawMetrics } from '../useOpenClawMetrics'

describe('useOpenClawMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useOpenClawSnapshot as jest.Mock).mockReturnValue({
      metrics: {
        agents: { total: 2, active: 1, idle: 1, byRole: { pm: 1, dev: 1 } },
        sessions: { total: 4, active: 2, completed: 1, failed: 1 },
        tokens: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        source: 'gateway',
        fetchedAt: '2026-04-22T00:00:00Z',
      },
      loading: false,
      error: null,
      refresh,
    })
  })

  it('adapts metrics from the snapshot hook without fetching legacy endpoints', () => {
    const { result } = renderHook(() => useOpenClawMetrics())

    expect(useOpenClawSnapshot).toHaveBeenCalledTimes(1)
    expect(result.current.metrics).toMatchObject({
      agents: { total: 2, active: 1, idle: 1 },
      sessions: { total: 4, active: 2, completed: 1, failed: 1 },
      tokens: { totalTokens: 150 },
      source: 'gateway',
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.source).toBe('gateway')
  })

  it('falls back to zero metrics when the snapshot has no metrics', () => {
    ;(useOpenClawSnapshot as jest.Mock).mockReturnValueOnce({
      metrics: null,
      loading: false,
      error: 'snapshot unavailable',
      refresh,
    })

    const { result } = renderHook(() => useOpenClawMetrics())

    expect(result.current.metrics).toMatchObject({
      agents: { total: 0, active: 0, idle: 0, byRole: {} },
      sessions: { total: 0, active: 0, completed: 0, failed: 0 },
      tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      source: 'fallback',
    })
    expect(result.current.source).toBe('fallback')
    expect(result.current.error).toBe('snapshot unavailable')
  })

  it('delegates refresh to the snapshot hook', async () => {
    const { result } = renderHook(() => useOpenClawMetrics())

    await act(async () => {
      result.current.refresh()
    })

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
