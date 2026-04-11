import { renderHook, act } from '@testing-library/react';

import { useDashboardStore } from '../useDashboardStore';

import { DashboardStore } from '@/game/data/DashboardStore';

describe('useDashboardStore', () => {
  it('should return initial agents', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useDashboardStore(store));

    expect(result.current.agents).toHaveLength(4);
    expect(result.current.agents[0].id).toBe('pm-agent');
  });

  it('should update when store processes event', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useDashboardStore(store));

    act(() => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'pm-agent',
        status: 'working',
      });
    });

    expect(result.current.agents[0].status).toBe('working'); // pm-agent
  });

  it('should update events list', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useDashboardStore(store));

    act(() => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'pm-agent',
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
        agentId: 'pm-agent',
        taskId: 'task-1',
        taskType: 'develop',
        description: 'Build feature',
      });
    });

    expect(result.current.stats.activeTasks).toBe(1);
  });

  it('should expose task history derived from task lifecycle events', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useDashboardStore(store));

    act(() => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: {
          id: 'task-1',
          description: '实现传统任务视图',
          taskType: 'feature',
        },
      });
    });

    expect(result.current.taskHistory).toHaveLength(1);
    expect(result.current.taskHistory[0]).toMatchObject({
      taskId: 'task-1',
      currentPhase: 'pm_analysis',
      status: 'in_progress',
    });
  });

  it('should update when agents load without new events', () => {
    const store = new DashboardStore();
    const { result } = renderHook(() => useDashboardStore(store));

    act(() => {
      store.loadAgents([
        {
          id: 'pm-agent',
          name: 'PM Updated',
          role: 'PM',
          status: 'busy',
          emotion: 'neutral',
          currentTask: null,
        },
      ]);
    });

    expect(result.current.agents[0]).toMatchObject({
      id: 'pm-agent',
      name: 'PM Updated',
      status: 'busy',
    });
  });

  it('should unsubscribe on unmount', () => {
    const store = new DashboardStore();
    const { unmount } = renderHook(() => useDashboardStore(store));

    unmount();

    act(() => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'pm-agent',
        status: 'busy',
      });
    });

    // Should not throw or cause issues
  });
});
