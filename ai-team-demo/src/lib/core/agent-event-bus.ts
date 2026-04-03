export type AgentEventType =
  | 'agent:started'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:retrying'
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'task:skipped'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'error:tracked'

export interface AgentEvent {
  type: AgentEventType
  agentRole?: string
  taskId?: string
  data?: Record<string, unknown>
  timestamp: Date
}

type EventHandler = (event: AgentEvent) => void

export class AgentEventBus {
  private history: AgentEvent[] = []
  private handlers: Set<EventHandler> = new Set()

  emit(event: Omit<AgentEvent, 'timestamp'>): void {
    const fullEvent: AgentEvent = {
      ...event,
      timestamp: new Date(),
    }
    this.history.push(fullEvent)

    for (const handler of this.handlers) {
      try {
        handler(fullEvent)
      } catch {
        // continue calling remaining handlers
      }
    }
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  getHistory(): AgentEvent[] {
    return [...this.history]
  }

  getHistoryByType(type: AgentEventType): AgentEvent[] {
    return this.history.filter((e) => e.type === type)
  }

  getHistoryByAgent(role: string): AgentEvent[] {
    return this.history.filter((e) => e.agentRole === role)
  }

  getLatestByAgent(role: string): AgentEvent | undefined {
    const events = this.history.filter((e) => e.agentRole === role)
    return events.length > 0 ? events[events.length - 1] : undefined
  }

  clear(): void {
    this.history = []
  }

  listenerCount(): number {
    return this.handlers.size
  }
}
