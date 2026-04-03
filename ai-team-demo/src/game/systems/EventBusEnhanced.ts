import { GameEvent, GameEventType, GameEventHandler } from '../types/GameEvents';

export interface EventBusConfig {
  maxHistorySize?: number;
  enableErrorLogging?: boolean;
  enableEventValidation?: boolean;
  maxErrorHandlerRetries?: number;
}

export interface ErrorEvent {
  type: 'eventbus:error';
  timestamp: number;
  error: Error;
  context: {
    eventType: string;
    handlerCount: number;
    isWildcard: boolean;
    retryCount?: number;
  };
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Map<string, number>;
  lastError: ErrorEvent | null;
  recentErrors: ErrorEvent[];
}

interface ValidatedEvent extends GameEvent {
  _validated: boolean;
}

export class EventBusEnhanced {
  private handlers = new Map<string, Set<GameEventHandler<GameEvent>>>();
  private wildcardHandlers = new Set<GameEventHandler<GameEvent>>();
  private history: GameEvent[] = [];
  private errorStats: ErrorStats = {
    totalErrors: 0,
    errorsByType: new Map(),
    lastError: null,
    recentErrors: []
  };
  private readonly maxHistorySize: number;
  private readonly enableErrorLogging: boolean;
  private readonly enableEventValidation: boolean;
  private readonly maxErrorHandlerRetries: number;
  private readonly maxErrorHistory = 100;

  constructor(config: EventBusConfig = {}) {
    this.maxHistorySize = config.maxHistorySize ?? 100;
    this.enableErrorLogging = config.enableErrorLogging ?? true;
    this.enableEventValidation = config.enableEventValidation ?? true;
    this.maxErrorHandlerRetries = config.maxErrorHandlerRetries ?? 3;
  }

  on(eventType: GameEventType | '*', handler: GameEventHandler<GameEvent>): void {
    if (eventType === '*') {
      this.wildcardHandlers.add(handler);
      return;
    }

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: GameEventType | '*', handler: GameEventHandler<GameEvent>): void {
    if (eventType === '*') {
      this.wildcardHandlers.delete(handler);
      return;
    }

    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  once(eventType: GameEventType, handler: GameEventHandler<GameEvent>): void {
    const wrapper: GameEventHandler<GameEvent> = (event) => {
      this.off(eventType, wrapper);
      handler(event);
    };
    this.on(eventType, wrapper);
  }

  emit(event: GameEvent): void {
    const startTime = performance.now();
    
    // Validate event if enabled
    if (this.enableEventValidation && !this.validateEvent(event)) {
      const validationError = new Error(`Event validation failed for type: ${event.type}`);
      this.handleError(validationError, event, false, 0);
      return;
    }

    this.addToHistory(event);

    // Execute specific handlers
    this.executeHandlersWithRetry(
      this.handlers.get(event.type),
      event,
      false,
      startTime
    );

    // Execute wildcard handlers
    this.executeHandlersWithRetry(
      this.wildcardHandlers,
      event,
      true,
      startTime
    );
  }

  private executeHandlersWithRetry(
    handlers: Set<GameEventHandler<GameEvent>> | undefined,
    event: GameEvent,
    isWildcard: boolean,
    startTime: number
  ): void {
    if (!handlers || handlers.size === 0) return;

    handlers.forEach(handler => {
      let retryCount = 0;
      let lastError: Error | null = null;

      while (retryCount <= this.maxErrorHandlerRetries) {
        try {
          const handlerStartTime = performance.now();
          handler(event);
          const handlerDuration = performance.now() - handlerStartTime;
          
          if (this.enableErrorLogging && retryCount > 0) {
            console.log(`[EventBus] Handler succeeded after ${retryCount} retries for ${event.type} (${handlerDuration.toFixed(2)}ms)`);
          }
          
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error as Error;
          retryCount++;
          
          if (retryCount <= this.maxErrorHandlerRetries) {
            console.warn(`[EventBus] Handler failed ${retryCount}/${this.maxErrorHandlerRetries} for ${event.type}:`, error);
            // Small delay before retry
            if (retryCount < this.maxErrorHandlerRetries) {
              setTimeout(() => {}, Math.min(100 * retryCount, 1000));
            }
          }
        }
      }

      // If all retries failed, record the error
      if (retryCount > this.maxErrorHandlerRetries && lastError) {
        this.handleError(lastError, event, isWildcard, retryCount);
      }
    });
  }

  private validateEvent(event: GameEvent): boolean {
    if (!event || typeof event !== 'object') {
      return false;
    }

    if (!event.type || typeof event.type !== 'string') {
      return false;
    }

    if (typeof event.timestamp !== 'number' || event.timestamp <= 0) {
      event.timestamp = Date.now();
    }

    // Type-specific validation
    switch (event.type) {
      case 'agent:status-change':
        if (!event.agentId || typeof event.agentId !== 'string') {
          return false;
        }
        break;
        
      case 'agent:task-assigned':
      case 'agent:task-completed':
        if (!event.agentId || !event.taskId) {
          return false;
        }
        break;
        
      case 'connection:open':
      case 'connection:close':
      case 'connection:error':
        // These events don't require agentId
        break;
    }

    return true;
  }

  private handleError(error: Error, event: GameEvent, isWildcard: boolean, retryCount: number): void {
    const errorEvent: ErrorEvent = {
      type: 'eventbus:error',
      timestamp: Date.now(),
      error,
      context: {
        eventType: event.type,
        handlerCount: this.getHandlerCount(event.type),
        isWildcard,
        retryCount
      }
    };

    // Update error statistics
    this.errorStats.totalErrors++;
    this.errorStats.lastError = errorEvent;
    
    const errorTypeKey = `${event.type}:${error.name}`;
    const currentCount = this.errorStats.errorsByType.get(errorTypeKey) || 0;
    this.errorStats.errorsByType.set(errorTypeKey, currentCount + 1);

    // Keep recent errors for debugging
    this.errorStats.recentErrors.push(errorEvent);
    if (this.errorStats.recentErrors.length > this.maxErrorHistory) {
      this.errorStats.recentErrors.shift();
    }

    // Log the error if enabled
    if (this.enableErrorLogging) {
      console.error(`[EventBus] Error processing event ${event.type}:`, {
        error: error.message,
        stack: error.stack,
        context: errorEvent.context,
        event: this.sanitizeEventForLogging(event)
      });
    }
  }

  private sanitizeEventForLogging(event: GameEvent): Partial<GameEvent> {
    // Create a copy without sensitive data if needed
    const { agentId, taskId, ...safeEvent } = event;
    return {
      ...safeEvent,
      agentId: agentId ? '[REDACTED]' : undefined,
      taskId: taskId ? '[REDACTED]' : undefined
    };
  }

  private addToHistory(event: GameEvent): void {
    this.history.push(event);
    while (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  private getHandlerCount(eventType: GameEventType): number {
    const specific = this.handlers.get(eventType)?.size || 0;
    const wildcard = this.wildcardHandlers.size;
    return specific + wildcard;
  }

  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
    this.history = [];
  }

  listenerCount(eventType: GameEventType): number {
    if (eventType === '*') {
      return this.handlers.size + this.wildcardHandlers.size;
    }
    return this.handlers.get(eventType)?.size || 0;
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
  }

  // Performance monitoring
  getPerformanceMetrics() {
    return {
      historySize: this.history.length,
      maxHistorySize: this.maxHistorySize,
      handlerCounts: Object.fromEntries(
        Array.from(this.handlers.entries()).map(([type, handlers]) => [
          type,
          handlers.size
        ])
      ),
      wildcardHandlerCount: this.wildcardHandlers.size,
      errorRate: this.errorStats.totalErrors > 0 
        ? (this.errorStats.totalErrors / (this.history.length + this.errorStats.totalErrors)) * 100 
        : 0
    };
  }
}