/**
 * bridge.ts — AgentEventBus → GameEventStore bridge
 *
 * Subscribes to the Orchestrator's internal AgentEventBus and forwards
 * relevant events into the GameEventStore so the SSE endpoint can stream
 * them to the browser in real-time.
 *
 * Returns an unsubscribe function to clean up when the session ends.
 */

import { AgentEventBus } from '@/lib/core/agent-event-bus'
import { GameEventStore } from '@/game/data/GameEventStore'

export function bridgeEventBusToStore(
  bus: AgentEventBus,
  store: GameEventStore,
  sessionId: string,
): () => void {
  return bus.subscribe((event) => {
    const base = { timestamp: Date.now(), sessionId }

    switch (event.type) {
      case 'agent:started':
        store.push({
          ...base,
          type: 'workflow:agent-started',
          agent: event.agentRole ?? 'unknown',
          taskId: event.taskId ?? '',
          taskTitle: (event.data?.taskTitle as string | undefined) ?? '',
        })
        break

      case 'agent:completed':
        store.push({
          ...base,
          type: 'workflow:agent-completed',
          agent: event.agentRole ?? 'unknown',
          taskId: event.taskId ?? '',
          result: (event.data?.result as string | undefined) ?? '',
          durationMs: (event.data?.durationMs as number | undefined) ?? 0,
        })
        break

      case 'agent:failed':
        store.push({
          ...base,
          type: 'workflow:agent-failed',
          agent: event.agentRole ?? 'unknown',
          taskId: event.taskId ?? '',
          error: (event.data?.error as string | undefined) ?? 'Unknown error',
          retryCount: (event.data?.retryCount as number | undefined) ?? 0,
        })
        break

      // workflow:started / workflow:completed / workflow:failed are emitted
      // directly by route.ts (wrapping the orchestrator call), so we skip
      // the AgentEventBus equivalents here to avoid duplicates.
      default:
        break
    }
  })
}
