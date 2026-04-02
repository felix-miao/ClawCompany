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

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    this.readyState = MockEventSource.CONNECTING;
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  simulateOpen(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: string): void {
    this.onmessage?.({ data });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        agentId: 'alice',
        status: 'working',
      }));
    });

    expect(store.getAgentById('alice')?.status).toBe('working');
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
});
