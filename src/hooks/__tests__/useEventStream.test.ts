import { renderHook, act } from '@testing-library/react';

import { useEventStream } from '../../hooks/useEventStream';
import { DashboardStore } from '../../game/data/DashboardStore';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  url: string;
  readyState: number = 0;
  private listeners: Map<string, Array<(event: MessageEvent) => void>> = new Map();

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    this.readyState = MockEventSource.CONNECTING;
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler);
  }

  removeEventListener(type: string, handler: (event: MessageEvent) => void): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  dispatchEvent(event: Event): boolean {
    return true;
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  simulateOpen(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  simulateError(): void {
    this.onerror?.();
  }

  static reset(): void {
    MockEventSource.instances = [];
  }
}

describe('useEventStream', () => {
  let originalEventSource: typeof globalThis.EventSource;

  beforeAll(() => {
    originalEventSource = globalThis.EventSource;
  });

  afterAll(() => {
    globalThis.EventSource = originalEventSource;
  });

  beforeEach(() => {
    MockEventSource.reset();
     
    globalThis.EventSource = MockEventSource as any;
  });

  it('should connect to SSE on mount', () => {
    const store = new DashboardStore();
    renderHook(() => useEventStream(store));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/game-events');
  });

  it('should not connect when disabled', () => {
    const store = new DashboardStore();
    renderHook(() => useEventStream(store, { enabled: false }));

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should process incoming events into store', () => {
    const store = new DashboardStore();
    renderHook(() => useEventStream(store));

    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateMessage(JSON.stringify({
        type: 'agent:status-change',
        agentId: 'pm-agent',
        status: 'working',
      }));
    });

    expect(store.getAgentById('pm-agent')?.status).toBe('working');
  });

  it('should track connection status', () => {
    const store = new DashboardStore();
    renderHook(() => useEventStream(store));

    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateOpen();
    });

    expect(store.isConnected()).toBe(true);
  });

  it('should disconnect on unmount', () => {
    const store = new DashboardStore();
    const { unmount } = renderHook(() => useEventStream(store));

    const es = MockEventSource.instances[0];
    unmount();

    expect(es.readyState).toBe(MockEventSource.CLOSED);
  });

  it('should use custom URL', () => {
    const store = new DashboardStore();
    renderHook(() => useEventStream(store, { url: '/custom-events' }));

    expect(MockEventSource.instances[0].url).toBe('/custom-events');
  });

  it('should handle malformed events gracefully', () => {
    const store = new DashboardStore();
    renderHook(() => useEventStream(store));

    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateMessage('not json');
      es.simulateMessage('{}');
    });

    expect(store.getEvents()).toHaveLength(0);
  });

  it('should report reconnecting state on error', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useEventStream(store));

    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateError();
    });

    expect(result.current.isReconnecting).toBe(true);
  });

  it('should stop reconnecting after MAX_RETRIES (5) consecutive errors', () => {
    jest.useFakeTimers();
    const store = new DashboardStore();
    const { result } = renderHook(() => useEventStream(store));

    // Exhaust all 5 retry attempts
    for (let i = 0; i < 5; i++) {
      const es = MockEventSource.instances[MockEventSource.instances.length - 1];
      act(() => { es.simulateError(); });
      act(() => { jest.runAllTimers(); });
    }

    // 6th error — should not schedule another reconnect
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];
    act(() => { es.simulateError(); });

    expect(result.current.isReconnecting).toBe(false);
    jest.useRealTimers();
  });

  it('should append ?since= with last event id on reconnect', () => {
    jest.useFakeTimers();
    const store = new DashboardStore();
    renderHook(() => useEventStream(store));

    // Simulate receiving an event with a timestamp
    const es = MockEventSource.instances[0];
    act(() => {
      es.simulateMessage(JSON.stringify({
        type: 'agent:status-change',
        agentId: 'pm-agent',
        status: 'working',
        timestamp: 1234567890,
      }));
    });

    // Trigger reconnect
    act(() => { es.simulateError(); });
    act(() => { jest.runAllTimers(); });

    const reconnectUrl = MockEventSource.instances[MockEventSource.instances.length - 1].url;
    expect(reconnectUrl).toContain('since=1234567890');
    jest.useRealTimers();
  });
});
