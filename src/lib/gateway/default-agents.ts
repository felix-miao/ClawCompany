import type { AgentInfo } from '@/game/data/DashboardStore'

export const DEFAULT_AGENT_DEFINITIONS = [
  { id: 'sidekick-claw', name: 'PM', role: 'PM' },
  { id: 'dev-claw', name: 'Dev', role: 'Developer' },
  { id: 'reviewer-claw', name: 'Reviewer', role: 'Reviewer' },
  { id: 'tester-claw', name: 'Tester', role: 'Tester' },
] as const

export function createDefaultAgents(): AgentInfo[] {
  return DEFAULT_AGENT_DEFINITIONS.map(agent => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    status: 'idle',
    emotion: 'neutral',
    currentTask: null,
    latestResultSummary: null,
  }))
}
