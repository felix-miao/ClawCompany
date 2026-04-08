import { GameEvent, GameEventHandler } from '../types/GameEvents';
import { EventBus, EventBusConfig } from './EventBus';

export interface EventBusEnhancedConfig extends EventBusConfig {
  enableErrorLogging?: boolean;
  enableEventValidation?: boolean;
}

export interface ErrorEvent {
  type: 'eventbus:error';
  timestamp: number;
  error: Error;
  context: {
    eventType: string;
    handlerCount: number;
    isWildcard: boolean;
  };
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Map<string, number>;
  lastError: ErrorEvent | null;
  recentErrors: ErrorEvent[];
}

export class EventBusEnhanced extends EventBus {
  private errorStats: ErrorStats = {
    totalErrors: 0,
    errorsByType: new Map(),
    lastError: null,
    recentErrors: []
  };
  private readonly enableErrorLogging: boolean;
  private readonly enableEventValidation: boolean;
  private readonly maxErrorHistory = 100;
  private errorHead = 0;
  private errorCount = 0;

  constructor(config: EventBusEnhancedConfig = {}) {
    super({ maxHistorySize: config.maxHistorySize });
    this.enableErrorLogging = config.enableErrorLogging ?? true;
    this.enableEventValidation = config.enableEventValidation ?? true;
  }

  emit(eventTypeOrEvent: string | GameEvent, event?: GameEvent): Error[] {
    let processedEvent: GameEvent;
    if (typeof eventTypeOrEvent === 'string') {
      if (!event) return [];
      processedEvent = event;
    } else {
      processedEvent = eventTypeOrEvent;
    }

    if (this.enableEventValidation) {
      const result = this.validateEvent(processedEvent);
      if (!result.valid) {
        const validationError = new Error(`Event validation failed for type: ${processedEvent.type}`);
        this.handleError(validationError, processedEvent, false);
        return [];
      }
      processedEvent = result.event;
    }

    this.addToHistory(processedEvent);

    const specificHandlers = this.handlers.get(processedEvent.type);
    this.executeHandlers(specificHandlers, processedEvent, false);

    this.executeHandlers(this.wildcardHandlers, processedEvent, true);
    return [];
  }

  private executeHandlers(
    handlers: Array<(event: GameEvent) => void> | undefined,
    event: GameEvent,
    isWildcard: boolean
  ): void {
    if (!handlers || handlers.length === 0) return;

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.handleError(err, event, isWildcard);
      }
    }
  }

  private validateEvent(event: GameEvent): { valid: boolean; event: GameEvent } {
    if (!event || typeof event !== 'object') {
      return { valid: false, event };
    }

    if (!event.type || typeof event.type !== 'string') {
      return { valid: false, event };
    }

    let correctedEvent = event;
    if (typeof event.timestamp !== 'number' || event.timestamp <= 0) {
      correctedEvent = { ...event, timestamp: Date.now() };
    }

    switch (correctedEvent.type) {
      case 'agent:status-change':
        if (!correctedEvent.agentId || typeof correctedEvent.agentId !== 'string') {
          return { valid: false, event };
        }
        break;

      case 'agent:task-assigned':
      case 'agent:task-completed':
        if (!correctedEvent.agentId || !('taskId' in correctedEvent) || !correctedEvent.taskId) {
          return { valid: false, event };
        }
        break;

      case 'connection:open':
      case 'connection:close':
      case 'connection:error':
        break;
    }

    return { valid: true, event: correctedEvent };
  }

  private handleError(error: Error, event: GameEvent, isWildcard: boolean): void {
    const errorEvent: ErrorEvent = {
      type: 'eventbus:error',
      timestamp: Date.now(),
      error,
      context: {
        eventType: event.type,
        handlerCount: this.listenerCount(event.type),
        isWildcard,
      }
    };

    this.errorStats.totalErrors++;
    this.errorStats.lastError = errorEvent;

    const errorTypeKey = `${event.type}:${error.name}`;
    const currentCount = this.errorStats.errorsByType.get(errorTypeKey) || 0;
    this.errorStats.errorsByType.set(errorTypeKey, currentCount + 1);

    if (this.errorStats.recentErrors.length < this.maxErrorHistory) {
      this.errorStats.recentErrors.push(errorEvent);
    } else {
      this.errorStats.recentErrors[this.errorHead] = errorEvent;
    }
    this.errorHead = (this.errorHead + 1) % this.maxErrorHistory;
    if (this.errorCount < this.maxErrorHistory) {
      this.errorCount++;
    }

    if (this.enableErrorLogging) {
      console.error(`[EventBus] Error processing event ${event.type}:`, {
        error: error.message,
        stack: error.stack,
        context: errorEvent.context,
        event: this.sanitizeEventForLogging(event)
      });
    }
  }

  private sanitizeEventForLogging(event: GameEvent): Record<string, unknown> {
    const { timestamp, type, ...rest } = event;
    const safe: Record<string, unknown> = { type, timestamp };
    for (const [key, value] of Object.entries(rest)) {
      safe[key] = typeof value === 'string' ? '[REDACTED]' : value;
    }
    return safe;
  }

  getErrorStats(): ErrorStats {
    return {
      ...this.errorStats,
      errorsByType: new Map(this.errorStats.errorsByType)
    };
  }

  resetErrorStats(): void {
    this.errorStats = {
      totalErrors: 0,
      errorsByType: new Map(),
      lastError: null,
      recentErrors: []
    };
    this.errorHead = 0;
    this.errorCount = 0;
  }

  getPerformanceMetrics() {
    return {
      historySize: this.getHistory().length,
      handlerCounts: Object.fromEntries(
        this.getEventTypes().map(type => [
          type,
          this.handlers.get(type)?.length ?? 0
        ])
      ),
      wildcardHandlerCount: this.wildcardHandlers.length,
      errorRate: this.errorStats.totalErrors > 0
        ? (this.errorStats.totalErrors / (this.getHistory().length + this.errorStats.totalErrors)) * 100
        : 0
    };
  }
}
