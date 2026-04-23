import { AgentInfo, TaskHistory } from '@/game/data/DashboardStore'

const TASK_AGENT_ID_ALIAS_MAP: Record<string, string> = {
  'pm-agent': 'sidekick-claw',
  'dev-agent': 'dev-claw',
  'review-agent': 'reviewer-claw',
  'test-agent': 'tester-claw',
}

export type TaskAgentSnapshot = Pick<AgentInfo, 'id' | 'name' | 'status' | 'emotion' | 'currentTask' | 'latestResultSummary'>

export function getCanonicalTaskAgentId(agentId: string): string {
  return TASK_AGENT_ID_ALIAS_MAP[agentId] ?? agentId
}

export function selectTaskAgentSnapshot(task: Pick<TaskHistory, 'currentAgentId' | 'agentSnapshots'>): TaskAgentSnapshot | null {
  const agentId = task.currentAgentId
  if (!agentId) return null

  const snapshot = task.agentSnapshots?.[agentId] ?? task.agentSnapshots?.[getCanonicalTaskAgentId(agentId)] ?? null
  return snapshot ? { ...snapshot } : null
}

export function createTaskAgentSnapshot(
  agent: AgentInfo | undefined,
  agentId: string,
  currentTask: string | null,
  latestResultSummary: string | null,
): Record<string, AgentInfo> {
  const canonicalAgentId = getCanonicalTaskAgentId(agentId)
  const base = agent ?? {
    id: canonicalAgentId,
    name: agentId,
    role: 'dev',
    status: 'idle',
    emotion: 'neutral',
    currentTask: null,
    latestResultSummary: null,
  }

  return {
    [canonicalAgentId]: {
      ...base,
      id: canonicalAgentId,
      currentTask,
      latestResultSummary,
    },
  }
}
