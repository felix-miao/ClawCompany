import { renderHook, act } from '@testing-library/react';

import { useDashboardStore } from '../useDashboardStore';

import { DashboardStore } from '@/game/data/DashboardStore';

describe('useDashboardStore', () => {
  it('should return initial agents', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useDashboardStore(store));

    expect(result.current.agents).toHaveLength(4);
    expect(result.current.agents[0].id).toBe('alice');
  });

  it('should update when store processes event', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useDashboardStore(store));

    act(() => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'alice',
        status: 'working',
      });
    });

    expect(result.current.agents[0].status).toBe('working');
  });

  it('should update events list', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useDashboardStore(store));

    act(() => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'alice',
        status: 'busy',
      });
    });

    expect(result.current.events).toHaveLength(1);
  });

  it('should update stats', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useDashboardStore(store));

    act(() => {
      store.processEvent({
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'alice',
        taskId: 'task-1',
        taskType: 'develop',
        description: 'Build feature',
      });
    });

    expect(result.current.stats.activeTasks).toBe(1);
  });

  it('should unsubscribe on unmount', () => {
    const store = new DashboardStore();
    const { unmount } = renderHook(() => useDashboardStore(store));

    unmount();

    act(() => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'alice',
        status: 'busy',
      });
    });

    // Should not throw or cause issues
  });
});
