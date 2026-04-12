import { SessionSyncService } from './session-sync'

export interface OpenClawSnapshot {
  agents: Awaited<ReturnType<SessionSyncService['fetchAgents']>>
  sessions: Awaited<ReturnType<SessionSyncService['fetchSessions']>>
  fetchedAt: number
}

const SNAPSHOT_TTL_MS = 5_000

declare global {
  // eslint-disable-next-line no-var
  var __openClawSnapshot: OpenClawSnapshot | null | undefined
  // eslint-disable-next-line no-var
  var __openClawSnapshotInFlight: Promise<OpenClawSnapshot> | null | undefined
}

function getCachedSnapshot(now: number): OpenClawSnapshot | null {
  const snapshot = globalThis.__openClawSnapshot
  if (!snapshot) return null
  if (now - snapshot.fetchedAt > SNAPSHOT_TTL_MS) return null
  return snapshot
}

export async function getOpenClawSnapshot(sync: SessionSyncService = new SessionSyncService()): Promise<OpenClawSnapshot> {
  const now = Date.now()
  const cached = getCachedSnapshot(now)
  if (cached) return cached

  if (globalThis.__openClawSnapshotInFlight) {
    return globalThis.__openClawSnapshotInFlight
  }

  const request = (async () => {
    await sync['client'].connect()
    try {
      const [agents, sessions] = await Promise.all([
        sync.fetchAgents(),
        sync.fetchSessions(),
      ])

      const snapshot: OpenClawSnapshot = {
        agents,
        sessions,
        fetchedAt: Date.now(),
      }

      globalThis.__openClawSnapshot = snapshot
      return snapshot
    } finally {
      await sync['client'].disconnect().catch(() => {})
      globalThis.__openClawSnapshotInFlight = null
    }
  })()

  globalThis.__openClawSnapshotInFlight = request
  return request
}

export function resetOpenClawSnapshotCache(): void {
  globalThis.__openClawSnapshot = null
  globalThis.__openClawSnapshotInFlight = null
}
