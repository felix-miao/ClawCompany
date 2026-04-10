import { OpenClawGatewayClient, createGatewayClient } from './client'
import { AgentInfo } from '@/game/data/DashboardStore'

const DEFAULT_AGENTS: AgentInfo[] = [
  { id: 'pm-agent', name: 'PM', role: 'PM', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'dev-agent', name: 'Dev', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'review-agent', name: 'Reviewer', role: 'Reviewer', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'test-agent', name: 'Tester', role: 'Tester', status: 'idle', emotion: 'neutral', currentTask: null },
]

export interface GatewayAgent {
  id: string
  name: string
  identity: {
    name: string
    avatarUrl?: string
  }
}

export interface GatewaySession {
  key: string
  agentId: string
  label: string
  model: string
  status: string
  endedAt: string | null
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface SessionSummary {
  key: string
  agentId: string
  label: string
  model: string
  status: string
  endedAt: string | null
}

const AGENT_ID_ROLE_MAP: Record<string, string> = {
  'sidekick-claw': 'pm',
  'dev-claw': 'dev',
  'reviewer-claw': 'review',
  'tester-claw': 'tester',
}

function mapAgentIdToRole(agentId: string): string {
  return AGENT_ID_ROLE_MAP[agentId] || 'dev'
}

function isActiveSession(session: GatewaySession): boolean {
  if (session.endedAt === null) return true
  if (session.status?.includes('running')) return true
  return false
}

export class SessionSyncService {
  private client: OpenClawGatewayClient

  constructor(client?: OpenClawGatewayClient) {
    this.client = client || createGatewayClient()
  }

  async fetchAgents(): Promise<GatewayAgent[]> {
    const result = await this.client.call<{ agents: GatewayAgent[]; defaultId: string }>('agents.list')
    return result.agents || []
  }

  async fetchSessions(): Promise<GatewaySession[]> {
    const result = await this.client.call<{ sessions: GatewaySession[]; defaults: Record<string, unknown> }>('sessions.list')
    return result.sessions || []
  }

  mapToAgentInfo(agents: GatewayAgent[], sessions: GatewaySession[]): AgentInfo[] {
    const activeSessionAgentIds = new Set<string>()
    for (const session of sessions) {
      if (isActiveSession(session)) {
        activeSessionAgentIds.add(session.agentId)
      }
    }

    return agents.map(agent => ({
      id: agent.id,
      name: agent.identity?.name || agent.name || agent.id,
      role: mapAgentIdToRole(agent.id),
      status: activeSessionAgentIds.has(agent.id) ? 'busy' as const : 'idle' as const,
      emotion: 'neutral',
      currentTask: null,
    }))
  }

  getDefaultAgents(): AgentInfo[] {
    return DEFAULT_AGENTS.map(a => ({ ...a }))
  }
}

export function getDefaultAgents(): AgentInfo[] {
  return DEFAULT_AGENTS.map(a => ({ ...a }))
}
