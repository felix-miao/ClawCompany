import { EventBus } from '../EventBus';
import {
  AgentStatusEvent,
  TaskAssignedEvent,
  GameEvent,
} from '../../types/GameEvents';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on', () => {
    it('should subscribe to an event type', () => {
      const handler = jest.fn();
      eventBus.on('agent:status-change', handler);

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support multiple handlers for the same event type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('agent:status-change', handler1);
      eventBus.on('agent:status-change', handler2);

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should support wildcard handler with "*"', () => {
      const wildcardHandler = jest.fn();
      eventBus.on('*', wildcardHandler);

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      expect(wildcardHandler).toHaveBeenCalledWith(event);
    });
  });

  describe('off', () => {
    it('should unsubscribe a specific handler', () => {
      const handler = jest.fn();
      eventBus.on('agent:status-change', handler);
      eventBus.off('agent:status-change', handler);

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not affect other handlers when unsubscribing', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('agent:status-change', handler1);
      eventBus.on('agent:status-change', handler2);
      eventBus.off('agent:status-change', handler1);

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should handle unsubscribing wildcard handler', () => {
      const handler = jest.fn();
      eventBus.on('*', handler);
      eventBus.off('*', handler);

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle off for non-existent event type', () => {
      const handler = jest.fn();
      expect(() => eventBus.off('agent:status-change', handler)).not.toThrow();
    });
  });

  describe('once', () => {
    it('should fire handler only once', () => {
      const handler = jest.fn();
      eventBus.once('agent:status-change', handler);

      const event1: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };
      const event2: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev2',
        status: 'idle',
      };

      eventBus.emit(event1);
      eventBus.emit(event2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });
  });

  describe('emit', () => {
    it('should not throw when emitting with no listeners', () => {
      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      expect(() => eventBus.emit(event)).not.toThrow();
    });

    it('should deliver events to both specific and wildcard handlers', () => {
      const specificHandler = jest.fn();
      const wildcardHandler = jest.fn();

      eventBus.on('agent:status-change', specificHandler);
      eventBus.on('*', wildcardHandler);

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      expect(specificHandler).toHaveBeenCalledWith(event);
      expect(wildcardHandler).toHaveBeenCalledWith(event);
    });

    it('should only deliver to matching event type handlers', () => {
      const statusHandler = jest.fn();
      const taskHandler = jest.fn();

      eventBus.on('agent:status-change', statusHandler);
      eventBus.on('agent:task-assigned', taskHandler);

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      expect(statusHandler).toHaveBeenCalledWith(event);
      expect(taskHandler).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('agent:status-change', handler1);
      eventBus.on('agent:task-assigned', handler2);
      eventBus.clear();

      const event1: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };
      const event2: TaskAssignedEvent = {
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'dev1',
        taskId: 'task-1',
        taskType: 'coding',
        description: 'Write tests',
      };

      eventBus.emit(event1);
      eventBus.emit(event2);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should also clear wildcard handlers', () => {
      const handler = jest.fn();
      eventBus.on('*', handler);
      eventBus.clear();

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return 0 for event type with no listeners', () => {
      expect(eventBus.listenerCount('agent:status-change')).toBe(0);
    });

    it('should return correct count for event type', () => {
      eventBus.on('agent:status-change', jest.fn());
      eventBus.on('agent:status-change', jest.fn());
      expect(eventBus.listenerCount('agent:status-change')).toBe(2);
    });

    it('should include wildcard handlers in count', () => {
      eventBus.on('*', jest.fn());
      eventBus.on('agent:status-change', jest.fn());
      expect(eventBus.listenerCount('agent:status-change')).toBe(2);
    });

    it('should update count after unsubscribe', () => {
      const handler = jest.fn();
      eventBus.on('agent:status-change', handler);
      expect(eventBus.listenerCount('agent:status-change')).toBe(1);

      eventBus.off('agent:status-change', handler);
      expect(eventBus.listenerCount('agent:status-change')).toBe(0);
    });
  });

  describe('getEventTypes', () => {
    it('should return empty array initially', () => {
      expect(eventBus.getEventTypes()).toEqual([]);
    });

    it('should return registered event types', () => {
      eventBus.on('agent:status-change', jest.fn());
      eventBus.on('agent:task-assigned', jest.fn());

      const types = eventBus.getEventTypes();
      expect(types).toContain('agent:status-change');
      expect(types).toContain('agent:task-assigned');
    });
  });

  describe('error handling', () => {
    it('should not break other handlers when one throws', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = jest.fn();

      eventBus.on('agent:status-change', errorHandler);
      eventBus.on('agent:status-change', normalHandler);

      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      expect(() => eventBus.emit(event)).not.toThrow();
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
    });
  });

  describe('event history', () => {
    it('should track emitted events', () => {
      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      const history = eventBus.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(event);
    });

    it('should limit history to maxHistorySize', () => {
      const bus = new EventBus({ maxHistorySize: 3 });

      for (let i = 0; i < 5; i++) {
        const event: AgentStatusEvent = {
          type: 'agent:status-change',
          timestamp: Date.now(),
          agentId: `dev${i}`,
          status: 'busy',
        };
        bus.emit(event);
      }

      expect(bus.getHistory()).toHaveLength(3);
    });

    it('should clear history', () => {
      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      };

      eventBus.emit(event);
      eventBus.clearHistory();
      expect(eventBus.getHistory()).toHaveLength(0);
    });
  });
});
