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

const DEFAULT_MAX_HISTORY = 1000

export class AgentEventBus {
  private historyBuffer: (AgentEvent | undefined)[];
  private historyHead = 0;
  private historyCount = 0;
  private readonly maxHistory: number;
  private handlers: Set<EventHandler> = new Set()

  constructor(maxHistory = DEFAULT_MAX_HISTORY) {
    this.maxHistory = maxHistory
    this.historyBuffer = new Array(maxHistory);
  }

  emit(event: Omit<AgentEvent, 'timestamp'>): void {
    const fullEvent: AgentEvent = {
      ...event,
      timestamp: new Date(),
    }
    this.historyBuffer[this.historyHead] = fullEvent;
    this.historyHead = (this.historyHead + 1) % this.maxHistory;
    if (this.historyCount < this.maxHistory) {
      this.historyCount++;
    }

    for (const handler of this.handlers) {
      try {
        handler(fullEvent)
      } catch (error) {
        // Log error but continue execution - improved error handling
        console.error('[AgentEventBus] Handler error:', error instanceof Error ? error.message : String(error));
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
    if (this.historyCount === 0) return [];
    const result: AgentEvent[] = [];
    for (let i = 0; i < this.historyCount; i++) {
      const idx = (this.historyHead - this.historyCount + i + this.maxHistory) % this.maxHistory;
      const item = this.historyBuffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  getHistoryByType(type: AgentEventType): AgentEvent[] {
    return this.getHistory().filter((e) => e.type === type)
  }

  getHistoryByAgent(role: string): AgentEvent[] {
    return this.getHistory().filter((e) => e.agentRole === role)
  }

  getLatestByAgent(role: string): AgentEvent | undefined {
    const events = this.getHistoryByAgent(role);
    return events.length > 0 ? events[events.length - 1] : undefined;
  }

  clear(): void {
    this.historyHead = 0;
    this.historyCount = 0;
    this.historyBuffer = new Array(this.maxHistory);
  }

  listenerCount(): number {
    return this.handlers.size
  }
}
