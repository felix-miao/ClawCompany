import { EventBus } from '../EventBus';
import { GameEvent, GameEventType } from '../../types/GameEvents';

describe('EventBus Error Handling', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error handling in handlers', () => {
    it('should catch errors in specific handlers and continue execution', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn(() => {
        throw new Error('Handler error');
      });
      const handler3 = jest.fn();

      eventBus.on('agent:status-change', handler1);
      eventBus.on('agent:status-change', handler2);
      eventBus.on('agent:status-change', handler3);

      const event: GameEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'test-agent',
        status: 'busy',
      };

      expect(() => eventBus.emit(event)).not.toThrow();
      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
      expect(handler3).toHaveBeenCalledWith(event);
    });

    it('should catch errors in wildcard handlers and continue execution', () => {
      const specificHandler = jest.fn();
      const wildcardHandler = jest.fn(() => {
        throw new Error('Wildcard handler error');
      });

      eventBus.on('agent:status-change', specificHandler);
      eventBus.on('*', wildcardHandler);

      const event: GameEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'test-agent',
        status: 'busy',
      };

      expect(() => eventBus.emit(event)).not.toThrow();
      expect(specificHandler).toHaveBeenCalledWith(event);
      expect(wildcardHandler).toHaveBeenCalledWith(event);
    });
  });

  describe('Event validation', () => {
    it('should emit valid events without issues', () => {
      const handler = jest.fn();
      eventBus.on('agent:status-change', handler);

      const validEvent: GameEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'test-agent',
        status: 'busy',
      };

      expect(() => eventBus.emit(validEvent)).not.toThrow();
      expect(handler).toHaveBeenCalledWith(validEvent);
    });

    it('should handle events with optional properties', () => {
      const handler = jest.fn();
      eventBus.on('connection:open', handler);

      const validEvent: GameEvent = {
        type: 'connection:open',
        timestamp: Date.now()
      };

      expect(() => eventBus.emit(validEvent)).not.toThrow();
      expect(handler).toHaveBeenCalledWith(validEvent);
    });
  });
});