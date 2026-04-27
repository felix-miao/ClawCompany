import { buildOpenClawSnapshot, type OpenClawSnapshot } from './openclaw-snapshot'
import { SessionSyncService } from './session-sync'

const SNAPSHOT_TTL_MS = 5_000

interface CachedOpenClawSnapshot {
  snapshot: OpenClawSnapshot
  cachedAt: number
}

declare global {
  var __openClawRouteSnapshot: CachedOpenClawSnapshot | null | undefined
  var __openClawRouteSnapshotInFlight: Promise<OpenClawSnapshot> | null | undefined
}

function cloneSnapshot(snapshot: OpenClawSnapshot): OpenClawSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as OpenClawSnapshot
}

function getCachedSnapshot(now: number): OpenClawSnapshot | null {
  const cached = globalThis.__openClawRouteSnapshot
  if (!cached) return null
  if (now - cached.cachedAt > SNAPSHOT_TTL_MS) return null
  return cached.snapshot
}

export async function getCachedOpenClawSnapshot(sync: SessionSyncService = new SessionSyncService()): Promise<OpenClawSnapshot> {
  const cached = getCachedSnapshot(Date.now())
  if (cached) return cached

  if (globalThis.__openClawRouteSnapshotInFlight) {
    return globalThis.__openClawRouteSnapshotInFlight
  }

  const request = (async () => {
    try {
      const snapshot = cloneSnapshot(await buildOpenClawSnapshot(sync))
      globalThis.__openClawRouteSnapshot = {
        snapshot,
        cachedAt: Date.now(),
      }
      return snapshot
    } finally {
      globalThis.__openClawRouteSnapshotInFlight = null
    }
  })()

  globalThis.__openClawRouteSnapshotInFlight = request
  return request
}

export function resetOpenClawSnapshotCache(): void {
  globalThis.__openClawRouteSnapshot = null
  globalThis.__openClawRouteSnapshotInFlight = null
}
