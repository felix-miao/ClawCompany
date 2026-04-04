import { GameEventStore, getGameEventStore, resetGameEventStore } from '../GameEventStore';
import { GameEventType } from '../../types/GameEvents';

function createMockEvent(type: GameEventType, agentId: string = 'agent1'): any {
  return {
    type,
    agentId,
    timestamp: Date.now(),
    data: {},
  };
}

describe('GameEventStore', () => {
  let store: GameEventStore;

  beforeEach(() => {
    store = new GameEventStore(5);
  });

  describe('push', () => {
    it('should add events', () => {
      store.push(createMockEvent('task-assigned'));
      store.push(createMockEvent('task-completed'));
      expect(store.getEvents()).toHaveLength(2);
    });

    it('should enforce maxEvents limit', () => {
      for (let i = 0; i < 8; i++) {
        store.push(createMockEvent('task-assigned'));
      }
      expect(store.getEvents()).toHaveLength(5);
    });

    it('should notify subscribers on push', () => {
      const cb = jest.fn();
      store.subscribe(cb);
      const event = createMockEvent('task-assigned');
      store.push(event);
      expect(cb).toHaveBeenCalledWith(event);
    });

    it('should notify multiple subscribers', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      store.subscribe(cb1);
      store.subscribe(cb2);
      store.push(createMockEvent('task-assigned'));
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('should continue if subscriber throws', () => {
      const badCb = jest.fn(() => { throw new Error('oops'); });
      const goodCb = jest.fn();
      store.subscribe(badCb);
      store.subscribe(goodCb);
      store.push(createMockEvent('task-assigned'));
      expect(badCb).toHaveBeenCalledTimes(1);
      expect(goodCb).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe', () => {
    it('should return an unsubscribe function', () => {
      const cb = jest.fn();
      const unsub = store.subscribe(cb);
      store.push(createMockEvent('task-assigned'));
      expect(cb).toHaveBeenCalledTimes(1);

      unsub();
      store.push(createMockEvent('task-completed'));
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('getEvents', () => {
    it('should return copy of events', () => {
      store.push(createMockEvent('task-assigned'));
      const events = store.getEvents();
      expect(events).toHaveLength(1);
      events.pop();
      expect(store.getEvents()).toHaveLength(1);
    });

    it('should filter by since timestamp', () => {
      const e1 = createMockEvent('task-assigned');
      e1.timestamp = 100;
      const e2 = createMockEvent('task-completed');
      e2.timestamp = 200;
      store.push(e1);
      store.push(e2);

      expect(store.getEvents(150)).toHaveLength(1);
      expect(store.getEvents(150)[0].type).toBe('task-completed');
    });

    it('should return all events when since is undefined', () => {
      store.push(createMockEvent('task-assigned'));
      store.push(createMockEvent('task-completed'));
      expect(store.getEvents()).toHaveLength(2);
    });
  });

  describe('getEventsByType', () => {
    it('should filter events by type', () => {
      store.push(createMockEvent('task-assigned'));
      store.push(createMockEvent('task-completed'));
      store.push(createMockEvent('task-assigned'));

      expect(store.getEventsByType('task-assigned')).toHaveLength(2);
      expect(store.getEventsByType('task-completed')).toHaveLength(1);
    });

    it('should return empty for no matches', () => {
      store.push(createMockEvent('task-assigned'));
      expect(store.getEventsByType('agent-idle')).toHaveLength(0);
    });
  });

  describe('getEventsByAgent', () => {
    it('should filter events by agent', () => {
      store.push(createMockEvent('task-assigned', 'a1'));
      store.push(createMockEvent('task-assigned', 'a2'));
      store.push(createMockEvent('task-completed', 'a1'));

      expect(store.getEventsByAgent('a1')).toHaveLength(2);
      expect(store.getEventsByAgent('a2')).toHaveLength(1);
    });
  });

  describe('getLatestEvent', () => {
    it('should return the last event', () => {
      store.push(createMockEvent('task-assigned'));
      store.push(createMockEvent('task-completed'));
      expect(store.getLatestEvent()?.type).toBe('task-completed');
    });

    it('should return undefined when empty', () => {
      expect(store.getLatestEvent()).toBeUndefined();
    });
  });

  describe('getSubscriberCount', () => {
    it('should count subscribers', () => {
      expect(store.getSubscriberCount()).toBe(0);
      const unsub1 = store.subscribe(jest.fn());
      expect(store.getSubscriberCount()).toBe(1);
      const unsub2 = store.subscribe(jest.fn());
      expect(store.getSubscriberCount()).toBe(2);
      unsub1();
      expect(store.getSubscriberCount()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all events', () => {
      store.push(createMockEvent('task-assigned'));
      store.push(createMockEvent('task-completed'));
      store.clear();
      expect(store.getEvents()).toHaveLength(0);
    });
  });
});

describe('Singleton functions', () => {
  afterEach(() => {
    resetGameEventStore();
  });

  it('getGameEventStore should return a store', () => {
    const store = getGameEventStore();
    expect(store).toBeInstanceOf(GameEventStore);
  });

  it('should return the same instance', () => {
    const s1 = getGameEventStore();
    const s2 = getGameEventStore();
    expect(s1).toBe(s2);
  });

  it('resetGameEventStore should reset the singleton', () => {
    const s1 = getGameEventStore();
    resetGameEventStore();
    const s2 = getGameEventStore();
    expect(s1).not.toBe(s2);
  });
});
