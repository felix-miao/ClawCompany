import { computeOpenClawSnapshotDiff } from '../snapshot-diff'
import type { OpenClawSnapshot } from '../openclaw-snapshot'

const baseSnapshot = (): OpenClawSnapshot => ({
  agents: [
    { id: 'agent-1', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
  ],
  sessions: [
    {
      sessionKey: 'session-1',
      agentId: 'agent-1',
      agentName: 'PM Claw',
      role: 'pm',
      label: 'Plan work',
      status: 'running',
      startedAt: '2026-04-28T00:00:00Z',
      endedAt: null,
      currentWork: 'Planning',
      latestThought: 'Thinking',
      latestResultSummary: null,
      finalResultSummary: null,
      model: 'gpt-5.5',
      latestMessage: 'Planning',
      latestMessageRole: 'assistant',
      latestMessageStatus: 'running',
      history: [],
      artifacts: [],
      finalDeliveryArtifacts: [],
      category: 'running',
      eventFeed: { events: [], totalCount: 0, byType: {} as never },
    },
  ],
  tasks: [
    {
      taskId: 'session-1',
      description: 'Plan work',
      phases: [],
      currentPhase: 'pm_analysis',
      currentAgentId: 'agent-1',
      currentAgentName: 'PM Claw',
      createdAt: 100,
      updatedAt: 100,
      status: 'in_progress',
    },
  ],
  metrics: {
    agents: { total: 1, active: 0, idle: 1, byRole: { pm: 1 } },
    sessions: { total: 1, active: 1, completed: 0, failed: 0 },
    tokens: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    source: 'gateway',
    fetchedAt: '2026-04-28T00:00:00Z',
  },
  connected: true,
  fetchedAt: '2026-04-28T00:00:00Z',
})

describe('computeOpenClawSnapshotDiff', () => {
  it('returns no diff when snapshots are identical except fetchedAt timestamps', () => {
    const previous = baseSnapshot()
    const next = {
      ...baseSnapshot(),
      fetchedAt: '2026-04-28T00:00:05Z',
      metrics: { ...baseSnapshot().metrics, fetchedAt: '2026-04-28T00:00:05Z' },
    }

    expect(computeOpenClawSnapshotDiff(previous, next)).toBeNull()
  })

  it('detects agent additions, removals, and changes', () => {
    const previous = baseSnapshot()
    const next = {
      ...baseSnapshot(),
      agents: [
        { ...previous.agents[0], status: 'working' as const, currentTask: 'New task' },
        { id: 'agent-2', name: 'Dev Claw', role: 'developer', status: 'idle' as const, emotion: 'neutral' as const, currentTask: null },
      ],
    }

    const changed = computeOpenClawSnapshotDiff(previous, next)
    expect(changed).toEqual({
      agents: {
        changed: next.agents,
        removed: [],
      },
    })

    const removed = computeOpenClawSnapshotDiff(next, { ...next, agents: [next.agents[1]] })
    expect(removed?.agents?.removed).toEqual(['agent-1'])
  })

  it('detects session changes', () => {
    const previous = baseSnapshot()
    const nextSession = { ...previous.sessions[0], status: 'completed', endedAt: '2026-04-28T00:01:00Z' }
    const diff = computeOpenClawSnapshotDiff(previous, { ...previous, sessions: [nextSession] })

    expect(diff).toEqual({
      sessions: {
        changed: [nextSession],
        removed: [],
      },
    })
  })

  it('detects task changes', () => {
    const previous = baseSnapshot()
    const nextTask = { ...previous.tasks[0], status: 'completed' as const, updatedAt: 200 }
    const diff = computeOpenClawSnapshotDiff(previous, { ...previous, tasks: [nextTask] })

    expect(diff).toEqual({
      tasks: {
        changed: [nextTask],
        removed: [],
      },
    })
  })

  it('detects metrics changes', () => {
    const previous = baseSnapshot()
    const metrics = {
      ...previous.metrics,
      agents: { ...previous.metrics.agents, active: 1, idle: 0 },
    }

    expect(computeOpenClawSnapshotDiff(previous, { ...previous, metrics })).toEqual({ metrics })
  })
})
