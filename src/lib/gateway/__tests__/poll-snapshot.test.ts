import { getOpenClawSnapshot, resetOpenClawSnapshotCache } from '../poll-snapshot'

describe('getOpenClawSnapshot', () => {
  beforeEach(() => {
    resetOpenClawSnapshotCache()
  })

  it('should disconnect after a successful snapshot fetch', async () => {
    const sync = {
      fetchAgents: jest.fn().mockResolvedValue([{ id: 'dev-claw' }]),
      fetchSessions: jest.fn().mockResolvedValue([{ key: 's1' }]),
      client: {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
      },
    }

    const snapshot = await getOpenClawSnapshot(sync as any)

    expect(snapshot.agents).toEqual([{ id: 'dev-claw' }])
    expect(snapshot.sessions).toEqual([{ key: 's1' }])
    expect(sync.client.connect).toHaveBeenCalledTimes(1)
    expect(sync.client.disconnect).toHaveBeenCalledTimes(1)
  })

  it('should reuse an in-flight snapshot request', async () => {
    let releaseAgents: (() => void) | null = null
    const sync = {
      fetchAgents: jest.fn().mockImplementation(() => new Promise(resolve => {
        releaseAgents = () => resolve([{ id: 'dev-claw' }])
      })),
      fetchSessions: jest.fn().mockResolvedValue([{ key: 's1' }]),
      client: {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
      },
    }

    const first = getOpenClawSnapshot(sync as any)
    await Promise.resolve()
    const second = getOpenClawSnapshot(sync as any)
    releaseAgents?.()

    const [a, b] = await Promise.all([first, second])

    expect(a).toEqual(b)
    expect(sync.client.connect).toHaveBeenCalledTimes(1)
    expect(sync.fetchAgents).toHaveBeenCalledTimes(1)
    expect(sync.fetchSessions).toHaveBeenCalledTimes(1)
    expect(sync.client.disconnect).toHaveBeenCalledTimes(1)
  })
})
