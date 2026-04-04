import {
  GameEvent,
  GameEventType,
  GameEventHandler,
  EventTypeMap,
} from '../types/GameEvents';

export interface EventBusConfig {
  maxHistorySize?: number;
}

type TypedHandler = GameEventHandler<GameEvent>;

export class EventBus {
  protected handlers = new Map<string, Set<TypedHandler>>();
  protected wildcardHandlers = new Set<TypedHandler>();
  protected history: GameEvent[] = [];
  protected readonly maxHistorySize: number;
  private historyHead = 0;
  private historyCount = 0;

  constructor(config?: EventBusConfig) {
    this.maxHistorySize = config?.maxHistorySize ?? 100;
  }

  on<K extends GameEventType>(
    eventType: K,
    handler: GameEventHandler<EventTypeMap[K]>
  ): void;
  on(eventType: '*', handler: TypedHandler): void;
  on(eventType: GameEventType | '*', handler: TypedHandler): void {
    if (eventType === '*') {
      this.wildcardHandlers.add(handler);
      return;
    }

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off<K extends GameEventType>(
    eventType: K,
    handler: GameEventHandler<EventTypeMap[K]>
  ): void;
  off(eventType: '*', handler: TypedHandler): void;
  off(eventType: GameEventType | '*', handler: TypedHandler): void {
    if (eventType === '*') {
      this.wildcardHandlers.delete(handler);
      return;
    }

    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  once<K extends GameEventType>(
    eventType: K,
    handler: GameEventHandler<EventTypeMap[K]>
  ): void {
    const wrapper: TypedHandler = (event) => {
      this.off(eventType, wrapper as GameEventHandler<EventTypeMap[K]>);
      handler(event as EventTypeMap[K]);
    };
    this.on(eventType, wrapper as GameEventHandler<EventTypeMap[K]>);
  }

  emit(event: GameEvent): void {
    this.addToHistory(event);

    const specificHandlers = this.handlers.get(event.type);
    if (specificHandlers) {
      for (const handler of specificHandlers) {
        try {
          handler(event);
        } catch {
          // continue to next handler
        }
      }
    }

    for (const handler of this.wildcardHandlers) {
      try {
        handler(event);
      } catch {
        // continue to next handler
      }
    }
  }

  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  listenerCount(eventType: GameEventType): number {
    const specific = this.handlers.get(eventType)?.size ?? 0;
    return specific + this.wildcardHandlers.size;
  }

  getEventTypes(): GameEventType[] {
    return Array.from(this.handlers.keys()) as GameEventType[];
  }

  getHistory(): GameEvent[] {
    if (this.historyCount === 0) return [];
    const result: GameEvent[] = [];
    for (let i = 0; i < this.historyCount; i++) {
      const idx = (this.historyHead - this.historyCount + i + this.maxHistorySize) % this.maxHistorySize;
      result.push(this.history[idx]);
    }
    return result;
  }

  clearHistory(): void {
    this.historyHead = 0;
    this.historyCount = 0;
    this.history = [];
  }

  protected addToHistory(event: GameEvent): void {
    if (this.history.length < this.maxHistorySize) {
      this.history.push(event);
    } else {
      this.history[this.historyHead] = event;
    }
    this.historyHead = (this.historyHead + 1) % this.maxHistorySize;
    if (this.historyCount < this.maxHistorySize) {
      this.historyCount++;
    }
  }
}
