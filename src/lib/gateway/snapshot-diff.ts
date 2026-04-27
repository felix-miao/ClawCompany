import type { OpenClawSessionDetails, OpenClawSnapshot, OpenClawSnapshotMetrics } from './openclaw-snapshot'

import type { AgentInfo, TaskHistory } from '@/game/data/DashboardStore'

export interface SnapshotCollectionDiff<T> {
  changed: T[]
  removed: string[]
}

export interface OpenClawSnapshotDiff {
  agents?: SnapshotCollectionDiff<AgentInfo>
  sessions?: SnapshotCollectionDiff<OpenClawSessionDetails>
  tasks?: SnapshotCollectionDiff<TaskHistory>
  metrics?: OpenClawSnapshotMetrics
  connected?: boolean
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
  }

  return JSON.stringify(value)
}

function metricsComparable(metrics: OpenClawSnapshotMetrics): Omit<OpenClawSnapshotMetrics, 'fetchedAt'> {
  const { fetchedAt: _fetchedAt, ...rest } = metrics
  return rest
}

function collectionDiff<T>(previous: T[], next: T[], getId: (item: T) => string): SnapshotCollectionDiff<T> | undefined {
  const previousById = new Map(previous.map(item => [getId(item), item]))
  const nextById = new Map(next.map(item => [getId(item), item]))

  const changed = next.filter((item) => {
    const previousItem = previousById.get(getId(item))
    return !previousItem || stableStringify(previousItem) !== stableStringify(item)
  })
  const removed = previous
    .map(getId)
    .filter(id => !nextById.has(id))

  if (changed.length === 0 && removed.length === 0) {
    return undefined
  }

  return { changed, removed }
}

export function computeOpenClawSnapshotDiff(previous: OpenClawSnapshot, next: OpenClawSnapshot): OpenClawSnapshotDiff | null {
  const diff: OpenClawSnapshotDiff = {}

  const agents = collectionDiff(previous.agents, next.agents, agent => agent.id)
  if (agents) diff.agents = agents

  const sessions = collectionDiff(previous.sessions, next.sessions, session => session.sessionKey)
  if (sessions) diff.sessions = sessions

  const tasks = collectionDiff(previous.tasks, next.tasks, task => task.taskId)
  if (tasks) diff.tasks = tasks

  if (stableStringify(metricsComparable(previous.metrics)) !== stableStringify(metricsComparable(next.metrics))) {
    diff.metrics = next.metrics
  }

  if (previous.connected !== next.connected) {
    diff.connected = next.connected
  }

  return Object.keys(diff).length > 0 ? diff : null
}
