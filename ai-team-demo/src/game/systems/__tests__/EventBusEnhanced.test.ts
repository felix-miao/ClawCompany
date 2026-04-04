import { EventBusEnhanced } from '../EventBusEnhanced';
import { GameEvent, GameEventType } from '../../types/GameEvents';

describe('EventBusEnhanced', () => {
  let eventBus: EventBusEnhanced;

  beforeEach(() => {
    eventBus = new EventBusEnhanced({
      enableErrorLogging: true,
      enableEventValidation: true,
      maxErrorHandlerRetries: 2
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Event Validation', () => {
    it('should validate required fields for agent:status-change events', () => {
      const invalidEvent = {
        type: 'agent:status-change' as GameEventType,
        timestamp: Date.now(),
      } as GameEvent;

      const handler = jest.fn();
      eventBus.on('agent:status-change', handler);

      eventBus.emit(invalidEvent);

      expect(handler).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        '[EventBus] Error processing event agent:status-change:',
        expect.objectContaining({
          error: expect.stringContaining('Event validation failed'),
          context: expect.objectContaining({
            eventType: 'agent:status-change'
          })
        })
      );
    });

    it('should auto-correct timestamp if invalid', () => {
      const eventWithInvalidTimestamp = {
        type: 'agent:status-change' as GameEventType,
        timestamp: -1,
        agentId: 'test-agent',
        status: 'busy' as const,
      } as GameEvent;

      const handler = jest.fn();
      eventBus.on('agent:status-change', handler);

      eventBus.emit(eventWithInvalidTimestamp);

      expect(handler).toHaveBeenCalled();
      const calledEvent = handler.mock.calls[0][0];
      expect(calledEvent.timestamp).toBeGreaterThan(0);
    });

    it('should validate required fields for agent:task-assigned events', () => {
      const invalidEvent = {
        type: 'agent:task-assigned' as GameEventType,
        timestamp: Date.now(),
        agentId: 'test-agent',
      } as GameEvent;

      const handler = jest.fn();
      eventBus.on('agent:task-assigned', handler);

      eventBus.emit(invalidEvent);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Enhanced Error Handling', () => {
    it('should retry failed handlers up to configured max times', () => {
      const handler = jest.fn(() => {
        throw new Error('Test error');
      });

      eventBus.on('agent:status-change', handler);

      const event: GameEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'test-agent',
        status: 'busy',
      };

      eventBus.emit(event);

      // Handler should be called maxErrorHandlerRetries + 1 times (1 initial + 2 retries)
      expect(handler).toHaveBeenCalledTimes(3);
      expect(console.warn).toHaveBeenCalledTimes(2); // 2 warnings for retries
    });

    it('should succeed after retry and log success', () => {
      let callCount = 0;
      const handler = jest.fn(() => {
        callCount++;
        if (callCount <= 1) {
          throw new Error('First call fails');
        }
      });

      eventBus.on('agent:status-change', handler);

      const event: GameEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'test-agent',
        status: 'busy',
      };

      eventBus.emit(event);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Handler succeeded after 1 retries for agent:status-change')
      );
    });

    it('should capture error statistics', () => {
      const handler = jest.fn(() => {
        throw new Error('Persistent error');
      });

      eventBus.on('agent:status-change', handler);

      const event: GameEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'test-agent',
        status: 'busy',
      };

      // Emit multiple events to build up error stats
      for (let i = 0; i < 3; i++) {
        eventBus.emit(event);
      }

      const stats = eventBus.getErrorStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType.has('agent:status-change:Error')).toBe(true);
      expect(stats.errorsByType.get('agent:status-change:Error')).toBe(3);
      expect(stats.lastError).toBeTruthy();
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', () => {
      const handler = jest.fn();
      eventBus.on('agent:status-change', handler);
      eventBus.on('*', handler);

      const metrics = eventBus.getPerformanceMetrics();
      
      expect(metrics.handlerCounts['agent:status-change']).toBe(1);
      expect(metrics.wildcardHandlerCount).toBe(1);
      expect(metrics.historySize).toBe(0);
    });

    it('should calculate error rate', () => {
      // First event succeeds
      const successHandler = jest.fn();
      eventBus.on('agent:status-change', successHandler);
      
      const event: GameEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'test-agent',
        status: 'busy',
      };
      eventBus.emit(event);

      // Second event fails
      const failHandler = jest.fn(() => {
        throw new Error('Test error');
      });
      eventBus.on('agent:status-change', failHandler);
      eventBus.emit(event);

      const metrics = eventBus.getPerformanceMetrics();
      // Error rate should be 33.33% (1 error out of 3 events)
      expect(metrics.errorRate).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeLessThan(50);
    });
  });

  describe('Event History and Management', () => {
    it('should limit history size', () => {
      eventBus = new EventBusEnhanced({ maxHistorySize: 3 });
      
      const handler = jest.fn();
      eventBus.on('agent:status-change', handler);

      for (let i = 0; i < 5; i++) {
        const event: GameEvent = {
        type: 'agent:status-change',
        timestamp: Date.now() + i,
        agentId: `agent-${i}`,
        status: 'busy',
      };

      eventBus.emit(event);
    }

    const history = eventBus.getHistory();
    expect(history.length).toBe(3);
    expect(history[0].agentId).toBe('agent-2');
  });

  it('should reset error stats independently', () => {
    const handler = jest.fn(() => {
      throw new Error('Test error');
    });

    eventBus.on('agent:status-change', handler);
    
    const event: GameEvent = {
      type: 'agent:status-change',
      timestamp: Date.now(),
      agentId: 'test-agent',
      status: 'busy',
    };
      eventBus.emit(event);

      let stats = eventBus.getErrorStats();
      expect(stats.totalErrors).toBe(1);

      eventBus.resetErrorStats();
      stats = eventBus.getErrorStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.errorsByType.size).toBe(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain same basic API as original EventBus', () => {
      expect(() => {
        eventBus.on('agent:status-change', () => {});
        eventBus.off('agent:status-change', () => {});
        eventBus.once('agent:status-change', () => {});
        eventBus.emit({
          type: 'agent:status-change',
          timestamp: Date.now(),
          agentId: 'test-agent',
          status: 'busy',
        });
        eventBus.clear();
        eventBus.listenerCount('agent:status-change');
        eventBus.getEventTypes();
        eventBus.getHistory();
        eventBus.clearHistory();
      }).not.toThrow();
    });
  });
});