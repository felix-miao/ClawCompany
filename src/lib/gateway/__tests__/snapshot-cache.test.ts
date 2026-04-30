import {
  getCachedOpenClawSnapshot,
  getOpenClawSnapshotCacheState,
  resetCachedOpenClawSnapshot,
  setOpenClawSnapshotCacheTtlForTest,
} from '../snapshot-cache'
import { buildOpenClawSnapshot } from '../openclaw-snapshot'

jest.mock('../openclaw-snapshot', () => ({
  buildOpenClawSnapshot: jest.fn(),
}))

const mockBuildOpenClawSnapshot = buildOpenClawSnapshot as jest.Mock

const createSnapshot = (id: string) => ({
  agents: [{ id }],
  sessions: [],
  tasks: [],
  metrics: {
    agents: { total: 1, active: 0, idle: 1, byRole: {} },
    sessions: { total: 0, active: 0, completed: 0, failed: 0 },
    tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    source: 'gateway',
    fetchedAt: new Date().toISOString(),
  },
  connected: true,
  fetchedAt: new Date().toISOString(),
})

describe('getCachedOpenClawSnapshot', () => {
  let now = 1_000

  beforeEach(() => {
    resetCachedOpenClawSnapshot()
    jest.clearAllMocks()
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    setOpenClawSnapshotCacheTtlForTest(null)
    resetCachedOpenClawSnapshot()
  })

  it('uses a short configurable TTL for route-level snapshot reuse', async () => {
    setOpenClawSnapshotCacheTtlForTest(250)
    const firstSnapshot = createSnapshot('dev-claw')
    const secondSnapshot = createSnapshot('pm-claw')
    mockBuildOpenClawSnapshot
      .mockResolvedValueOnce(firstSnapshot)
      .mockResolvedValueOnce(secondSnapshot)

    const first = await getCachedOpenClawSnapshot({} as any)
    now += 249
    const cached = await getCachedOpenClawSnapshot({} as any)
    now += 2
    const refreshed = await getCachedOpenClawSnapshot({} as any)

    expect(first).toBe(firstSnapshot)
    expect(cached).toBe(firstSnapshot)
    expect(refreshed).toBe(secondSnapshot)
    expect(mockBuildOpenClawSnapshot).toHaveBeenCalledTimes(2)
  })

  it('should reuse a snapshot within the TTL', async () => {
    const snapshot = createSnapshot('dev-claw')
    mockBuildOpenClawSnapshot.mockResolvedValue(snapshot)

    const first = await getCachedOpenClawSnapshot({} as any)
    now += 4_999
    const second = await getCachedOpenClawSnapshot({} as any)

    expect(first).toBe(snapshot)
    expect(second).toBe(snapshot)
    expect(mockBuildOpenClawSnapshot).toHaveBeenCalledTimes(1)
  })

  it('should refresh a snapshot after the TTL expires', async () => {
    const firstSnapshot = createSnapshot('dev-claw')
    const secondSnapshot = createSnapshot('pm-claw')
    mockBuildOpenClawSnapshot
      .mockResolvedValueOnce(firstSnapshot)
      .mockResolvedValueOnce(secondSnapshot)

    const first = await getCachedOpenClawSnapshot({} as any)
    now += 5_001
    const second = await getCachedOpenClawSnapshot({} as any)

    expect(first).toBe(firstSnapshot)
    expect(second).toBe(secondSnapshot)
    expect(mockBuildOpenClawSnapshot).toHaveBeenCalledTimes(2)
  })

  it('should reuse an in-flight snapshot request', async () => {
    let resolveSnapshot: ((value: ReturnType<typeof createSnapshot>) => void) | null = null
    mockBuildOpenClawSnapshot.mockImplementation(() => new Promise((resolve) => {
      resolveSnapshot = resolve
    }))

    const first = getCachedOpenClawSnapshot({} as any)
    const second = getCachedOpenClawSnapshot({} as any)
    const snapshot = createSnapshot('review-claw')
    resolveSnapshot?.(snapshot)

    await expect(Promise.all([first, second])).resolves.toEqual([snapshot, snapshot])
    expect(mockBuildOpenClawSnapshot).toHaveBeenCalledTimes(1)
  })

  it('can bypass a slow in-flight snapshot for cold-start bootstrap reads', async () => {
    let resolveSlowSnapshot: ((value: ReturnType<typeof createSnapshot>) => void) | null = null
    const fastSnapshot = createSnapshot('fast-bootstrap-claw')
    mockBuildOpenClawSnapshot
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSlowSnapshot = resolve
      }))
      .mockResolvedValueOnce(fastSnapshot)

    const slowRequest = getCachedOpenClawSnapshot({} as any)
    const bootstrapRequest = getCachedOpenClawSnapshot({} as any, { reuseInFlight: false })

    await expect(bootstrapRequest).resolves.toBe(fastSnapshot)
    expect(getOpenClawSnapshotCacheState()).toMatchObject({ hasSnapshot: true, inFlight: true })
    expect(mockBuildOpenClawSnapshot).toHaveBeenCalledTimes(2)
    expect(mockBuildOpenClawSnapshot).toHaveBeenLastCalledWith(expect.anything(), undefined)

    resolveSlowSnapshot?.(createSnapshot('slow-stream-claw'))
    await slowRequest
  })

  it('passes lightweight build options to bootstrap snapshot reads', async () => {
    const fastSnapshot = createSnapshot('fast-bootstrap-claw')
    mockBuildOpenClawSnapshot.mockResolvedValue(fastSnapshot)

    await getCachedOpenClawSnapshot({} as any, { reuseInFlight: false, buildOptions: { includeHistory: false } })

    expect(mockBuildOpenClawSnapshot).toHaveBeenCalledWith(expect.anything(), { includeHistory: false })
  })

  it('exposes cache state for diagnostics without logging large snapshots', async () => {
    let resolveSnapshot: ((value: ReturnType<typeof createSnapshot>) => void) | null = null
    mockBuildOpenClawSnapshot.mockImplementation(() => new Promise((resolve) => {
      resolveSnapshot = resolve
    }))

    const pending = getCachedOpenClawSnapshot({} as any)

    expect(getOpenClawSnapshotCacheState()).toMatchObject({
      hasSnapshot: false,
      inFlight: true,
      ttlMs: 5000,
    })
    expect(getOpenClawSnapshotCacheState()).not.toHaveProperty('snapshot')

    const snapshot = createSnapshot('tester-claw')
    resolveSnapshot?.(snapshot)
    await pending

    expect(getOpenClawSnapshotCacheState()).toMatchObject({
      hasSnapshot: true,
      inFlight: false,
      ageMs: 0,
      expiresInMs: 5000,
    })
  })
})
