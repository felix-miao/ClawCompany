import { LiveSessionManager, LiveSessionManagerConfig } from '../LiveSessionManager';
import { EventBus } from '../EventBus';
import {
  AgentStatusEvent,
  TaskAssignedEvent,
  GameEvent,
} from '../../types/GameEvents';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: { error?: Error }) => void) | null = null;
  onopen: (() => void) | null = null;
  url: string;
  readyState: number = 0;
  private listeners = new Map<string, Set<(event: { data: string }) => void>>();

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    this.readyState = MockEventSource.CONNECTING;

    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      this.onopen?.();
    }, 0);
  }

  addEventListener(type: string, listener: (event: { data: string }) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: { data: string }) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  simulateMessage(data: string, eventType?: string): void {
    const event = { data };
    if (eventType && this.listeners.has(eventType)) {
      this.listeners.get(eventType)!.forEach(fn => fn(event));
    } else {
      this.onmessage?.(event);
    }
  }

  simulateError(error?: Error): void {
    this.onerror?.({ error });
  }

  static reset(): void {
    MockEventSource.instances = [];
  }
}

describe('LiveSessionManager', () => {
  let manager: LiveSessionManager;
  let eventBus: EventBus;
  let originalEventSource: typeof globalThis.EventSource;

  beforeAll(() => {
    originalEventSource = globalThis.EventSource;
  });

  afterAll(() => {
    globalThis.EventSource = originalEventSource;
  });

  beforeEach(() => {
    MockEventSource.reset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.EventSource = MockEventSource as any;
    eventBus = new EventBus();
    manager = new LiveSessionManager(eventBus);
  });

  afterEach(() => {
    manager.disconnect();
  });

  describe('connect', () => {
    it('should create EventSource with correct URL', () => {
      manager.connect('/api/game-events');
      expect(MockEventSource.instances).toHaveLength(1);
      expect(MockEventSource.instances[0].url).toBe('/api/game-events');
    });

    it('should not create duplicate connections', () => {
      manager.connect('/api/game-events');
      manager.connect('/api/game-events');
      expect(MockEventSource.instances).toHaveLength(1);
    });

    it('should emit connection:open event on successful connection', (done) => {
      eventBus.on('connection:open', (event) => {
        expect(event.url).toBe('/api/game-events');
        done();
      });

      manager.connect('/api/game-events');
    });
  });

  describe('disconnect', () => {
    it('should close EventSource connection', () => {
      manager.connect('/api/game-events');
      const es = MockEventSource.instances[0];

      manager.disconnect();
      expect(es.readyState).toBe(MockEventSource.CLOSED);
    });

    it('should emit connection:close event', (done) => {
      eventBus.on('connection:close', () => done());

      manager.connect('/api/game-events');
      manager.disconnect();
    });

    it('should handle disconnect when not connected', () => {
      expect(() => manager.disconnect()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(manager.isConnected()).toBe(false);
    });

    it('should return true after connection', async () => {
      manager.connect('/api/game-events');
      await new Promise(r => setTimeout(r, 10));
      expect(manager.isConnected()).toBe(true);
    });

    it('should return false after disconnect', () => {
      manager.connect('/api/game-events');
      manager.disconnect();
      expect(manager.isConnected()).toBe(false);
    });
  });

  describe('event processing', () => {
    it('should parse and emit agent:status-change events', (done) => {
      eventBus.on('agent:status-change', (event) => {
        expect(event.agentId).toBe('dev1');
        expect(event.status).toBe('busy');
        done();
      });

      manager.connect('/api/game-events');

      const es = MockEventSource.instances[0];
      es.simulateMessage(JSON.stringify({
        type: 'agent:status-change',
        agentId: 'dev1',
        status: 'busy',
      }));
    });

    it('should parse and emit agent:task-assigned events', (done) => {
      eventBus.on('agent:task-assigned', (event) => {
        expect(event.agentId).toBe('pm');
        expect(event.taskId).toBe('task-123');
        expect(event.description).toBe('Review PR');
        done();
      });

      manager.connect('/api/game-events');

      const es = MockEventSource.instances[0];
      es.simulateMessage(JSON.stringify({
        type: 'agent:task-assigned',
        agentId: 'pm',
        taskId: 'task-123',
        taskType: 'review',
        description: 'Review PR',
      }));
    });

    it('should ignore malformed messages', () => {
      const handler = jest.fn();
      eventBus.on('*', handler);

      manager.connect('/api/game-events');

      const es = MockEventSource.instances[0];
      es.simulateMessage('not json');
      es.simulateMessage('{}');
      es.simulateMessage('{"noType": true}');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should add timestamp if missing', (done) => {
      eventBus.on('agent:status-change', (event) => {
        expect(event.timestamp).toBeGreaterThan(0);
        done();
      });

      manager.connect('/api/game-events');

      const es = MockEventSource.instances[0];
      es.simulateMessage(JSON.stringify({
        type: 'agent:status-change',
        agentId: 'dev1',
        status: 'idle',
      }));
    });

    it('should handle SSE named events', (done) => {
      eventBus.on('session:started', (event) => {
        expect(event.sessionKey).toBe('sess-1');
        expect(event.role).toBe('developer');
        done();
      });

      manager.connect('/api/game-events');

      const es = MockEventSource.instances[0];
      es.simulateMessage(JSON.stringify({
        type: 'session:started',
        sessionKey: 'sess-1',
        role: 'developer',
        task: 'Implement feature',
      }));
    });
  });

  describe('reconnection', () => {
    it('should attempt to reconnect after error', (done) => {
      const config: LiveSessionManagerConfig = {
        reconnectDelay: 100,
        maxReconnectAttempts: 1,
      };
      const reconnectManager = new LiveSessionManager(eventBus, config);

      let connectCount = 0;
      MockEventSource;

      eventBus.on('connection:open', () => {
        connectCount++;
        if (connectCount === 1) {
          const es = MockEventSource.instances[0];
          es.simulateError(new Error('Connection lost'));
        }
        if (connectCount === 2) {
          expect(connectCount).toBe(2);
          reconnectManager.disconnect();
          done();
        }
      });

      reconnectManager.connect('/api/game-events');
    });

    it('should stop reconnecting after max attempts', (done) => {
      const config: LiveSessionManagerConfig = {
        reconnectDelay: 10,
        maxReconnectAttempts: 0,
      };
      const reconnectManager = new LiveSessionManager(eventBus, config);

      eventBus.on('connection:error', () => {
        setTimeout(() => {
          expect(MockEventSource.instances.length).toBe(1);
          reconnectManager.disconnect();
          done();
        }, 50);
      });

      reconnectManager.connect('/api/game-events');

      setTimeout(() => {
        const es = MockEventSource.instances[0];
        es.simulateError(new Error('Connection lost'));
      }, 10);
    });
  });

  describe('getEventBus', () => {
    it('should return the event bus', () => {
      expect(manager.getEventBus()).toBe(eventBus);
    });
  });

  describe('with custom config', () => {
    it('should use custom config', () => {
      const customManager = new LiveSessionManager(eventBus, {
        url: '/custom-events',
        reconnectDelay: 5000,
        maxReconnectAttempts: 10,
      });

      customManager.connect();
      expect(MockEventSource.instances[0].url).toBe('/custom-events');
      customManager.disconnect();
    });
  });
});
