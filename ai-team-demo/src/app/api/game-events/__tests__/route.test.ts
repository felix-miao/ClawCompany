import { GameEventStore } from '@/game/data/GameEventStore';

describe('GameEventStore', () => {
  let store: GameEventStore;

  beforeEach(() => {
    store = new GameEventStore();
  });

  describe('push', () => {
    it('should store an event', () => {
      const event = {
        type: 'agent:status-change' as const,
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy' as const,
      };

      store.push(event);

      expect(store.getEvents()).toHaveLength(1);
      expect(store.getLatestEvent()).toEqual(event);
    });

    it('should notify subscribers when event is pushed', () => {
      const callback = jest.fn();
      store.subscribe(callback);

      const event = {
        type: 'agent:status-change' as const,
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy' as const,
      };

      store.push(event);
      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should limit events to maxEvents', () => {
      const smallStore = new GameEventStore(3);

      for (let i = 0; i < 5; i++) {
        smallStore.push({
          type: 'agent:status-change',
          timestamp: Date.now() + i,
          agentId: `dev${i}`,
          status: 'busy',
        });
      }

      expect(smallStore.getEvents()).toHaveLength(3);
    });

    it('should handle subscriber throwing error', () => {
      const badCallback = jest.fn(() => {
        throw new Error('Subscriber error');
      });
      const goodCallback = jest.fn();

      store.subscribe(badCallback);
      store.subscribe(goodCallback);

      store.push({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      });

      expect(badCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = store.subscribe(callback);

      store.push({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.push({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev2',
        status: 'idle',
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      store.subscribe(cb1);
      store.subscribe(cb2);

      store.push({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      });

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getEvents', () => {
    it('should return all events when no since parameter', () => {
      store.push({ type: 'agent:status-change', timestamp: 100, agentId: 'dev1', status: 'busy' });
      store.push({ type: 'agent:task-assigned', timestamp: 200, agentId: 'dev1', taskId: 't1', taskType: 'coding', description: 'test' });

      expect(store.getEvents()).toHaveLength(2);
    });

    it('should filter events by timestamp', () => {
      store.push({ type: 'agent:status-change', timestamp: 100, agentId: 'dev1', status: 'busy' });
      store.push({ type: 'agent:status-change', timestamp: 200, agentId: 'dev2', status: 'idle' });
      store.push({ type: 'agent:status-change', timestamp: 300, agentId: 'dev1', status: 'busy' });

      const filtered = store.getEvents(150);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('getEventsByType', () => {
    it('should filter events by type', () => {
      store.push({ type: 'agent:status-change', timestamp: 100, agentId: 'dev1', status: 'busy' });
      store.push({ type: 'agent:task-assigned', timestamp: 200, agentId: 'dev1', taskId: 't1', taskType: 'coding', description: 'test' });
      store.push({ type: 'agent:status-change', timestamp: 300, agentId: 'dev2', status: 'idle' });

      const statusEvents = store.getEventsByType('agent:status-change');
      expect(statusEvents).toHaveLength(2);
    });
  });

  describe('getEventsByAgent', () => {
    it('should filter events by agentId', () => {
      store.push({ type: 'agent:status-change', timestamp: 100, agentId: 'dev1', status: 'busy' });
      store.push({ type: 'agent:status-change', timestamp: 200, agentId: 'dev2', status: 'idle' });
      store.push({ type: 'agent:task-assigned', timestamp: 300, agentId: 'dev1', taskId: 't1', taskType: 'coding', description: 'test' });

      const dev1Events = store.getEventsByAgent('dev1');
      expect(dev1Events).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear all events', () => {
      store.push({ type: 'agent:status-change', timestamp: 100, agentId: 'dev1', status: 'busy' });
      store.push({ type: 'agent:status-change', timestamp: 200, agentId: 'dev2', status: 'idle' });

      store.clear();
      expect(store.getEvents()).toHaveLength(0);
    });
  });

  describe('getSubscriberCount', () => {
    it('should return subscriber count', () => {
      expect(store.getSubscriberCount()).toBe(0);

      const unsub1 = store.subscribe(jest.fn());
      store.subscribe(jest.fn());

      expect(store.getSubscriberCount()).toBe(2);

      unsub1();
      expect(store.getSubscriberCount()).toBe(1);
    });
  });
});
