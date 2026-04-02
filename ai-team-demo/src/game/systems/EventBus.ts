import { GameEvent, GameEventType, GameEventHandler } from '../types/GameEvents';

export interface EventBusConfig {
  maxHistorySize?: number;
}

type TypedHandler = GameEventHandler<GameEvent>;

export class EventBus {
  private handlers = new Map<string, Set<TypedHandler>>();
  private wildcardHandlers = new Set<TypedHandler>();
  private history: GameEvent[] = [];
  private readonly maxHistorySize: number;

  constructor(config?: EventBusConfig) {
    this.maxHistorySize = config?.maxHistorySize ?? 100;
  }

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

  once(eventType: GameEventType, handler: TypedHandler): void {
    const wrapper: TypedHandler = (event) => {
      this.off(eventType, wrapper);
      handler(event);
    };
    this.on(eventType, wrapper);
  }

  emit(event: GameEvent): void {
    this.addToHistory(event);

    const specificHandlers = this.handlers.get(event.type);
    const allHandlers = [
      ...(specificHandlers ?? []),
      ...this.wildcardHandlers,
    ];

    for (const handler of allHandlers) {
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
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  private addToHistory(event: GameEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }
}
