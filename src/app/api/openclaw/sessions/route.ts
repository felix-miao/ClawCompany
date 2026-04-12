import { NextRequest } from 'next/server'

import { withAuth, successResponse } from '@/lib/api/route-utils'
import { SessionSyncService } from '@/lib/gateway/session-sync'
import { getOpenClawSnapshot } from '@/lib/gateway/poll-snapshot'

export const GET = withAuth(async (request: NextRequest) => {
  const sync = new SessionSyncService()

  try {
    const { agents, sessions } = await getOpenClawSnapshot(sync)

    const mappedAgents = sync.mapToAgentInfo(agents, sessions)
    const sessionSummaries = sessions.map(s => ({
      key: s.key,
      agentId: s.agentId,
      label: s.label,
      model: s.model,
      status: s.status,
      endedAt: s.endedAt,
    }))

    return successResponse({
      agents: mappedAgents,
      sessions: sessionSummaries,
      connected: true,
    })
  } catch (error) {
    return successResponse({
      agents: sync.getDefaultAgents(),
      sessions: [],
      connected: false,
      error: error instanceof Error ? error.message : 'Gateway unreachable',
    })
  }
}, 'OpenClaw Sessions API')
