import { NextRequest } from 'next/server'

import { withAuth, successResponse } from '@/lib/api/route-utils'
import { buildOpenClawSnapshot } from '@/lib/gateway/openclaw-snapshot'
import { SessionSyncService, getDefaultAgents } from '@/lib/gateway/session-sync'

export const GET = withAuth(async (_request: NextRequest) => {
  const sync = new SessionSyncService()

  try {
    const snapshot = await buildOpenClawSnapshot(sync)
    return successResponse(snapshot)
  } catch (error) {
    return successResponse({
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
      error: error instanceof Error ? error.message : 'Gateway unreachable',
      fetchedAt: new Date().toISOString(),
    })
  }
}, 'OpenClaw Snapshot API')
