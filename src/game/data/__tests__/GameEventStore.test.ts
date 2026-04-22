import {
  GameEventStore,
  getGameEventStore,
  createGameEventStore,
  resetGameEventStore,
  getGameEventStoreTransportState,
  __initGameEventStoreRedisTransportForTest,
  __resetGameEventStoreRedisTransportForTest,
  __setGameEventStoreRedisLoaderForTest,
} from '../GameEventStore';
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

  beforeEach(async () => {
    delete process.env.REDIS_URL;
    await __resetGameEventStoreRedisTransportForTest();
    resetGameEventStore();
    store = new GameEventStore(5);
  });

  afterEach(async () => {
    store.clear();
    GameEventStore.clearAllSubscribers();
    resetGameEventStore();
    await __resetGameEventStoreRedisTransportForTest();
  });

  describe('push', () => {
    it('should add events', () => {
      store.push(createMockEvent('agent:task-assigned'));
      store.push(createMockEvent('agent:task-completed'));
      expect(store.getEvents()).toHaveLength(2);
    });

    it('should enforce maxEvents limit', () => {
      for (let i = 0; i < 8; i++) {
        store.push(createMockEvent('agent:task-assigned'));
      }
      expect(store.getEvents()).toHaveLength(5);
    });

    it('should notify subscribers on push', () => {
      const cb = jest.fn();
      store.subscribe(cb);
      const event = createMockEvent('agent:task-assigned');
      store.push(event);
      expect(cb).toHaveBeenCalledWith(event);
    });

    it('should notify multiple subscribers', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      store.subscribe(cb1);
      store.subscribe(cb2);
      store.push(createMockEvent('agent:task-assigned'));
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('should continue if subscriber throws', () => {
      const badCb = jest.fn(() => { throw new Error('oops'); });
      const goodCb = jest.fn();
      store.subscribe(badCb);
      store.subscribe(goodCb);
      store.push(createMockEvent('agent:task-assigned'));
      expect(badCb).toHaveBeenCalledTimes(1);
      expect(goodCb).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe', () => {
    it('should return an unsubscribe function', () => {
      const cb = jest.fn();
      const unsub = store.subscribe(cb);
      store.push(createMockEvent('agent:task-assigned'));
      expect(cb).toHaveBeenCalledTimes(1);

      unsub();
      store.push(createMockEvent('agent:task-completed'));
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('getEvents', () => {
    it('should return copy of events', () => {
      store.push(createMockEvent('agent:task-assigned'));
      const events = store.getEvents();
      expect(events).toHaveLength(1);
      events.pop();
      expect(store.getEvents()).toHaveLength(1);
    });

    it('should filter by since timestamp', () => {
      const e1 = createMockEvent('agent:task-assigned');
      e1.timestamp = 100;
      const e2 = createMockEvent('agent:task-completed');
      e2.timestamp = 200;
      store.push(e1);
      store.push(e2);

      expect(store.getEvents(150)).toHaveLength(1);
      expect(store.getEvents(150)[0].type).toBe('agent:task-completed');
    });

    it('should return all events when since is undefined', () => {
      store.push(createMockEvent('agent:task-assigned'));
      store.push(createMockEvent('agent:task-completed'));
      expect(store.getEvents()).toHaveLength(2);
    });
  });

  describe('getEventsByType', () => {
    it('should filter events by type', () => {
      store.push(createMockEvent('agent:task-assigned'));
      store.push(createMockEvent('agent:task-completed'));
      store.push(createMockEvent('agent:task-assigned'));

      expect(store.getEventsByType('agent:task-assigned')).toHaveLength(2);
      expect(store.getEventsByType('agent:task-completed')).toHaveLength(1);
    });

    it('should return empty for no matches', () => {
      store.push(createMockEvent('agent:task-assigned'));
      expect(store.getEventsByType('agent:status-change')).toHaveLength(0);
    });
  });

  describe('getEventsByAgent', () => {
    it('should filter events by agent', () => {
      store.push(createMockEvent('agent:task-assigned', 'a1'));
      store.push(createMockEvent('agent:task-assigned', 'a2'));
      store.push(createMockEvent('agent:task-completed', 'a1'));

      expect(store.getEventsByAgent('a1')).toHaveLength(2);
      expect(store.getEventsByAgent('a2')).toHaveLength(1);
    });
  });

  describe('getLatestEvent', () => {
    it('should return the last event', () => {
      store.push(createMockEvent('agent:task-assigned'));
      store.push(createMockEvent('agent:task-completed'));
      expect(store.getLatestEvent()?.type).toBe('agent:task-completed');
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
      store.push(createMockEvent('agent:task-assigned'));
      store.push(createMockEvent('agent:task-completed'));
      store.clear();
      expect(store.getEvents()).toHaveLength(0);
    });
  });

  describe('transport', () => {
    it('defaults to local transport when REDIS_URL is missing', () => {
      expect(getGameEventStoreTransportState().mode).toBe('local');
      store.push(createMockEvent('agent:task-assigned'));
      expect(store.getEvents()).toHaveLength(1);
    });

    it('falls back to local transport when Redis init fails', async () => {
      process.env.REDIS_URL = 'redis://example.invalid:6379';
      __setGameEventStoreRedisLoaderForTest(async () => {
        throw new Error('redis unavailable');
      });

      await __initGameEventStoreRedisTransportForTest();

      expect(getGameEventStoreTransportState().mode).toBe('local');
      store.push(createMockEvent('agent:task-assigned'));
      expect(store.getEvents()).toHaveLength(1);
    });

    it('does not double-deliver self-published Redis events to the same worker', async () => {
      process.env.REDIS_URL = 'redis://example.test:6379';

      const messageHandlers: Array<(channel: string, message: string) => void> = [];
      const publishCalls: Array<{ channel: string; message: string }> = [];

      class FakeRedis {
        async connect() {}
        async subscribe() { return undefined; }
        on(event: 'message', listener: (channel: string, message: string) => void) {
          if (event === 'message') messageHandlers.push(listener);
          return undefined;
        }
        async publish(channel: string, message: string) {
          publishCalls.push({ channel, message });
          for (const handler of messageHandlers) {
            handler(channel, message);
          }
          return 1;
        }
      }

      __setGameEventStoreRedisLoaderForTest(async () => FakeRedis as never);
      await __initGameEventStoreRedisTransportForTest();

      expect(getGameEventStoreTransportState().mode).toBe('redis-bridge');

      const received: ReturnType<typeof createMockEvent>[] = [];
      store.subscribe(event => received.push(event as ReturnType<typeof createMockEvent>));
      const event = createMockEvent('agent:task-assigned');

      store.push(event);

      expect(publishCalls).toHaveLength(1);
      expect(received).toHaveLength(1);
      expect(received[0]).toBe(event);
    });

    it('stores Redis-delivered remote events for replay on reconnect', async () => {
      process.env.REDIS_URL = 'redis://example.test:6379';

      let redisMessageHandler: ((channel: string, message: string) => void) | undefined;

      class FakeRedis {
        async connect() {}
        async subscribe() { return undefined; }
        on(event: 'message', listener: (channel: string, message: string) => void) {
          if (event === 'message') redisMessageHandler = listener;
          return undefined;
        }
        async publish() {
          return 1;
        }
      }

      __setGameEventStoreRedisLoaderForTest(async () => FakeRedis as never);
      await __initGameEventStoreRedisTransportForTest();
      const singletonStore = getGameEventStore();

      const remoteEvent = createMockEvent('agent:task-completed');
      redisMessageHandler?.(
        'game:event',
        JSON.stringify({ origin: 'remote-worker', event: remoteEvent })
      );

      expect(singletonStore.getEvents()).toContainEqual(remoteEvent);
      expect(singletonStore.getEvents(remoteEvent.timestamp - 1)).toContainEqual(remoteEvent);
    });
  });
});

describe('Singleton functions', () => {
  afterEach(() => {
    GameEventStore.clearAllSubscribers();
    resetGameEventStore();
  });

  it('getGameEventStore should return a store', () => {
    const store = getGameEventStore();
    expect(store).toBeInstanceOf(GameEventStore);
  });

  it('should return same instance (singleton for SSE subscribers)', () => {
    const s1 = getGameEventStore();
    const s2 = getGameEventStore();
    expect(s1).toBe(s2);
  });

  it('getGameEventStore should use default maxEvents', () => {
    const store = getGameEventStore();
    for (let i = 0; i < 205; i++) {
      store.push(createMockEvent('agent:task-assigned'));
    }
    expect(store.getEvents()).toHaveLength(200);
  });
});

describe('Request Isolation - createGameEventStore factory', () => {
  afterEach(() => {
    GameEventStore.clearAllSubscribers();
  });

  it('createGameEventStore should return a new instance each time', () => {
    const store1 = createGameEventStore(10);
    const store2 = createGameEventStore(10);
    expect(store1).not.toBe(store2);
  });

  it('different store instances should have isolated event buffers', () => {
    const store1 = createGameEventStore(10);
    const store2 = createGameEventStore(10);

    store1.push(createMockEvent('agent:task-assigned', 'agent1'));
    store2.push(createMockEvent('agent:task-completed', 'agent2'));

    expect(store1.getEvents()).toHaveLength(1);
    expect(store1.getEvents()[0].agentId).toBe('agent1');
    expect(store2.getEvents()).toHaveLength(1);
    expect(store2.getEvents()[0].agentId).toBe('agent2');
  });

  it('different store instances should share process-level emitter for SSE', (done) => {
    const store1 = createGameEventStore(10);
    const store2 = createGameEventStore(10);

    let receivedFromStore2 = false;
    store2.subscribe((event) => {
      if (event.agentId === 'agent-from-store1') {
        receivedFromStore2 = true;
        expect(event.type).toBe('agent:task-assigned');
        done();
      }
    });

    store1.push(createMockEvent('agent:task-assigned', 'agent-from-store1'));

    setTimeout(() => {
      if (!receivedFromStore2) {
        done(new Error('Event was not propagated to other store instance'));
      }
    }, 100);
  });
});
