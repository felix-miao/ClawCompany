import { NextRequest } from 'next/server'

import { withAuth, successResponse, errorResponse } from '@/lib/api/route-utils'
import { SessionSyncService } from '@/lib/gateway/session-sync'

export interface OpenClawMetrics {
  agents: {
    total: number
    active: number
    idle: number
    byRole: Record<string, number>
  }
  sessions: {
    total: number
    active: number
    completed: number
    failed: number
  }
  tokens: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  source: 'gateway' | 'fallback'
  fetchedAt: string
}

function buildMetrics(
  agents: Array<{ id: string; role: string; status: string }>,
  sessions: Array<{
    key: string
    status: string
    endedAt: string | null
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  }>,
): OpenClawMetrics {
  const activeAgents = agents.filter(a => a.status !== 'idle' && a.status !== 'offline').length
  const byRole: Record<string, number> = {}
  for (const agent of agents) {
    byRole[agent.role] = (byRole[agent.role] || 0) + 1
  }

  const activeSessions = sessions.filter(
    s => s.endedAt === null || s.status?.includes('running'),
  ).length
  const completedSessions = sessions.filter(
    s => s.endedAt !== null && s.status === 'completed',
  ).length
  const failedSessions = sessions.filter(
    s => s.endedAt !== null && s.status === 'failed',
  ).length

  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0
  for (const s of sessions) {
    if (s.usage) {
      promptTokens += s.usage.promptTokens ?? 0
      completionTokens += s.usage.completionTokens ?? 0
      totalTokens += s.usage.totalTokens ?? 0
    }
  }

  return {
    agents: {
      total: agents.length,
      active: activeAgents,
      idle: agents.length - activeAgents,
      byRole,
    },
    sessions: {
      total: sessions.length,
      active: activeSessions,
      completed: completedSessions,
      failed: failedSessions,
    },
    tokens: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    source: 'gateway',
    fetchedAt: new Date().toISOString(),
  }
}

export const GET = withAuth(async (_request: NextRequest) => {
  const sync = new SessionSyncService()

  try {
    await sync['client'].connect()

    const [agents, sessions] = await Promise.all([
      sync.fetchAgents(),
      sync.fetchSessions(),
    ])

    const mappedAgents = sync.mapToAgentInfo(agents, sessions)
    const metrics = buildMetrics(
      mappedAgents.map(a => ({ id: a.id, role: a.role, status: a.status })),
      sessions,
    )

    await sync['client'].disconnect()

    return successResponse({ metrics })
  } catch (error) {
    const fallbackMetrics: OpenClawMetrics = {
      agents: { total: 0, active: 0, idle: 0, byRole: {} },
      sessions: { total: 0, active: 0, completed: 0, failed: 0 },
      tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      source: 'fallback',
      fetchedAt: new Date().toISOString(),
    }

    return successResponse({
      metrics: fallbackMetrics,
      error: error instanceof Error ? error.message : 'Gateway unreachable',
    })
  }
}, 'OpenClaw Metrics API')
