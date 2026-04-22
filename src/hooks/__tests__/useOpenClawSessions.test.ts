import { renderHook, act } from '@testing-library/react'

const loadAgents = jest.fn()
const refresh = jest.fn()

jest.mock('../useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: jest.fn(),
}))

import { useOpenClawSnapshot } from '../useOpenClawSnapshot'
import { useOpenClawSessions } from '../useOpenClawSessions'
import { DashboardStore } from '@/game/data/DashboardStore'

describe('useOpenClawSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useOpenClawSnapshot as jest.Mock).mockReturnValue({
      agents: [
        { id: 'pm-agent', name: 'PM Claw', role: 'PM', status: 'working', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      ],
      sessions: [],
      tasks: [],
      metrics: null,
      connected: true,
      loading: false,
      error: null,
      refresh,
    })
  })

  it('hydrates the store from snapshot agents without calling legacy sessions endpoint', () => {
    const store = { loadAgents } as unknown as DashboardStore

    const { result } = renderHook(() => useOpenClawSessions(store))

    expect(useOpenClawSnapshot).toHaveBeenCalledTimes(1)
    expect(loadAgents).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'pm-agent',
        name: 'PM Claw',
        role: 'PM',
        status: 'working',
      }),
    ])
    expect(result.current.connected).toBe(true)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('tracks snapshot connection errors and delegates refresh', async () => {
    ;(useOpenClawSnapshot as jest.Mock).mockReturnValueOnce({
      agents: [],
      sessions: [],
      tasks: [],
      metrics: null,
      connected: false,
      loading: false,
      error: 'snapshot unavailable',
      refresh,
    })

    const store = { loadAgents } as unknown as DashboardStore
    const { result } = renderHook(() => useOpenClawSessions(store))

    expect(result.current.connected).toBe(false)
    expect(result.current.error).toBe('snapshot unavailable')

    await act(async () => {
      result.current.refresh()
    })

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
