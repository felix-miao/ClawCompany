import { useOpenClawSnapshot } from '../useOpenClawSnapshot'
import { useSnapshotStream } from '../useSnapshotStream'

jest.mock('../useSnapshotStream', () => ({
  useSnapshotStream: jest.fn(),
}))

describe('useOpenClawSnapshot', () => {
  it('delegates to the single snapshot stream entrypoint instead of owning a polling loop', () => {
    const snapshotState = {
      agents: [],
      sessions: [],
      tasks: [],
      metrics: null,
      connected: false,
      loading: true,
      error: null,
      refresh: jest.fn(),
    }
    ;(useSnapshotStream as jest.Mock).mockReturnValue(snapshotState)

    expect(useOpenClawSnapshot()).toBe(snapshotState)
    expect(useSnapshotStream).toHaveBeenCalledTimes(1)
  })
})
