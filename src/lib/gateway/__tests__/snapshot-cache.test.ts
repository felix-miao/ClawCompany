jest.mock('../openclaw-snapshot', () => ({
  buildOpenClawSnapshot: jest.fn(),
}))

import { buildOpenClawSnapshot } from '../openclaw-snapshot'
import { getCachedOpenClawSnapshot, resetOpenClawSnapshotCache } from '../snapshot-cache'

const mockBuildOpenClawSnapshot = buildOpenClawSnapshot as jest.Mock

function createSnapshot(id: string, fetchedAt = new Date().toISOString()) {
  return {
    agents: [{ id, name: id, role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null }],
    sessions: [],
    tasks: [],
    metrics: {
      agents: { total: 1, active: 0, idle: 1, byRole: { dev: 1 } },
      sessions: { total: 0, active: 0, completed: 0, failed: 0 },
      tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      source: 'gateway',
      fetchedAt,
    },
    connected: true,
    fetchedAt,
  }
}

describe('getCachedOpenClawSnapshot', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-04-27T12:00:00Z'))
    resetOpenClawSnapshotCache()
    mockBuildOpenClawSnapshot.mockReset()
  })

  afterEach(() => {
    resetOpenClawSnapshotCache()
    jest.useRealTimers()
  })

  it('returns a cached snapshot within the TTL', async () => {
    const sync = {}
    const snapshot = createSnapshot('dev-claw')
    mockBuildOpenClawSnapshot.mockResolvedValue(snapshot)

    const first = await getCachedOpenClawSnapshot(sync as any)
    const second = await getCachedOpenClawSnapshot(sync as any)

    expect(first).toEqual(snapshot)
    expect(second).toBe(first)
    expect(mockBuildOpenClawSnapshot).toHaveBeenCalledTimes(1)
  })

  it('refreshes after the TTL expires', async () => {
    const sync = {}
    mockBuildOpenClawSnapshot
      .mockResolvedValueOnce(createSnapshot('first'))
      .mockResolvedValueOnce(createSnapshot('second'))

    const first = await getCachedOpenClawSnapshot(sync as any)
    jest.advanceTimersByTime(5_001)
    const second = await getCachedOpenClawSnapshot(sync as any)

    expect(first.agents[0].id).toBe('first')
    expect(second.agents[0].id).toBe('second')
    expect(mockBuildOpenClawSnapshot).toHaveBeenCalledTimes(2)
  })

  it('reuses an in-flight snapshot request', async () => {
    let release: (() => void) | null = null
    const sync = {}
    const snapshot = createSnapshot('shared')
    mockBuildOpenClawSnapshot.mockImplementation(() => new Promise(resolve => {
      release = () => resolve(snapshot)
    }))

    const first = getCachedOpenClawSnapshot(sync as any)
    const second = getCachedOpenClawSnapshot(sync as any)
    release?.()

    const [a, b] = await Promise.all([first, second])

    expect(a).toEqual(snapshot)
    expect(b).toBe(a)
    expect(mockBuildOpenClawSnapshot).toHaveBeenCalledTimes(1)
  })
})
