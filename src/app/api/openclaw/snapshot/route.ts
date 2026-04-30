import { NextRequest } from 'next/server'

import { withAuth, successResponse } from '@/lib/api/route-utils'
import { getCachedOpenClawSnapshot } from '@/lib/gateway/snapshot-cache'
import { type OpenClawSnapshot } from '@/lib/gateway/openclaw-snapshot'
import { SessionSyncService, getDefaultAgents } from '@/lib/gateway/session-sync'

const createFallbackSnapshot = (error: unknown): OpenClawSnapshot => ({
  agents: getDefaultAgents(),
  sessions: [],
  tasks: [],
  metrics: {
    agents: { total: 0, active: 0, idle: 0, byRole: {} },
    sessions: { total: 0, active: 0, completed: 0, failed: 0 },
    tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    source: 'fallback',
    fetchedAt: new Date().toISOString(),
  },
  connected: false,
  fetchedAt: new Date().toISOString(),
  error: error instanceof Error ? error.message : 'Gateway unreachable',
} as OpenClawSnapshot)

export const GET = withAuth(async (request: NextRequest) => {
  const sync = new SessionSyncService()
  const bypassSlowInFlight = request.nextUrl.searchParams.has('fresh')

  try {
    const snapshot = await getCachedOpenClawSnapshot(sync, {
      reuseInFlight: !bypassSlowInFlight,
      buildOptions: bypassSlowInFlight ? { includeHistory: false } : undefined,
    })
    return successResponse(snapshot)
  } catch (error) {
    return successResponse(createFallbackSnapshot(error))
  }
}, 'OpenClaw Snapshot API')
