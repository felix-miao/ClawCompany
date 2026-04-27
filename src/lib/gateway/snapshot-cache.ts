import { buildOpenClawSnapshot, type OpenClawSnapshot } from './openclaw-snapshot'
import { SessionSyncService } from './session-sync'

const SNAPSHOT_TTL_MS = 5_000

interface CachedSnapshot {
  snapshot: OpenClawSnapshot
  fetchedAt: number
}

declare global {
  var __openClawFullSnapshot: CachedSnapshot | null | undefined
  var __openClawFullSnapshotInFlight: Promise<OpenClawSnapshot> | null | undefined
}

function getCachedSnapshot(now: number): OpenClawSnapshot | null {
  const cached = globalThis.__openClawFullSnapshot
  if (!cached) return null
  if (now - cached.fetchedAt > SNAPSHOT_TTL_MS) return null
  return cached.snapshot
}

export async function getCachedOpenClawSnapshot(sync: SessionSyncService = new SessionSyncService()): Promise<OpenClawSnapshot> {
  const now = Date.now()
  const cached = getCachedSnapshot(now)
  if (cached) return cached

  if (globalThis.__openClawFullSnapshotInFlight) {
    return globalThis.__openClawFullSnapshotInFlight
  }

  const request = buildOpenClawSnapshot(sync).then((snapshot) => {
    globalThis.__openClawFullSnapshot = {
      snapshot,
      fetchedAt: Date.now(),
    }
    return snapshot
  }).finally(() => {
    globalThis.__openClawFullSnapshotInFlight = null
  })

  globalThis.__openClawFullSnapshotInFlight = request
  return request
}

export function resetCachedOpenClawSnapshot(): void {
  globalThis.__openClawFullSnapshot = null
  globalThis.__openClawFullSnapshotInFlight = null
}
