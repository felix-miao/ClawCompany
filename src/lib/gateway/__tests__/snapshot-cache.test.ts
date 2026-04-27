import { getCachedOpenClawSnapshot, resetCachedOpenClawSnapshot } from '../snapshot-cache'
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
    resetCachedOpenClawSnapshot()
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
})
