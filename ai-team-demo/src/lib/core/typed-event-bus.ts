export interface TypedEventBusConfig {
  maxHistorySize?: number;
}

export class TypedEventBus<TEvent> {
  protected handlers = new Map<string, Set<(event: TEvent) => void>>();
  protected wildcardHandlers = new Set<(event: TEvent) => void>();
  protected historyBuffer: (TEvent | undefined)[];
  protected readonly maxHistorySize: number;
  private historyHead = 0;
  private historyCount = 0;

  constructor(config?: TypedEventBusConfig) {
    this.maxHistorySize = config?.maxHistorySize ?? 100;
    this.historyBuffer = new Array(this.maxHistorySize);
  }

  on(eventType: string, handler: (event: TEvent) => void): void {
    if (eventType === '*') {
      this.wildcardHandlers.add(handler);
      return;
    }

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: (event: TEvent) => void): void {
    if (eventType === '*') {
      this.wildcardHandlers.delete(handler);
      return;
    }

    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  once(eventType: string, handler: (event: TEvent) => void): void {
    const wrapper = (event: TEvent) => {
      this.off(eventType, wrapper);
      handler(event);
    };
    this.on(eventType, wrapper);
  }

  protected emitToHandlers(eventType: string, event: TEvent): void {
    const specificHandlers = this.handlers.get(eventType);
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

  protected addToHistory(event: TEvent): void {
    this.historyBuffer[this.historyHead] = event;
    this.historyHead = (this.historyHead + 1) % this.maxHistorySize;
    if (this.historyCount < this.maxHistorySize) {
      this.historyCount++;
    }
  }

  getHistory(): TEvent[] {
    if (this.historyCount === 0) return [];
    const result: TEvent[] = [];
    for (let i = 0; i < this.historyCount; i++) {
      const idx = (this.historyHead - this.historyCount + i + this.maxHistorySize) % this.maxHistorySize;
      const item = this.historyBuffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  clearHistory(): void {
    this.historyHead = 0;
    this.historyCount = 0;
    this.historyBuffer = new Array(this.maxHistorySize);
  }

  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  listenerCount(eventType: string): number {
    const specific = this.handlers.get(eventType)?.size ?? 0;
    return specific + this.wildcardHandlers.size;
  }

  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  protected resizeHistory(newSize: number): void {
    const oldHistory = this.getHistory();
    this.maxHistorySize = newSize;
    this.historyBuffer = new Array(newSize);
    this.historyHead = 0;
    this.historyCount = 0;

    const start = Math.max(0, oldHistory.length - newSize);
    for (let i = start; i < oldHistory.length; i++) {
      this.historyBuffer[this.historyHead] = oldHistory[i];
      this.historyHead = (this.historyHead + 1) % newSize;
      if (this.historyCount < newSize) {
        this.historyCount++;
      }
    }
  }
}
