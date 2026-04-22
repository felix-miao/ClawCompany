import { renderHook, act, waitFor } from '@testing-library/react';
import { useOpenClawSnapshot } from '../useOpenClawSnapshot';

global.fetch = jest.fn();

const mockSnapshotResponse = {
  success: true,
  agents: [
    { id: 'agent-1', name: 'PM Claw', role: 'pm', status: 'working', emotion: 'neutral', currentTask: 'Test task' },
  ],
  sessions: [
    {
      sessionKey: 'sess-1',
      agentId: 'agent-1',
      agentName: 'PM Claw',
      role: 'pm',
      label: 'Test task',
      model: 'gpt-5',
      status: 'running',
      currentWork: 'Testing',
      startedAt: '2026-04-22T00:00:00Z',
      endedAt: null,
    },
  ],
  tasks: [
    {
      taskId: 'sess-1',
      description: 'Test task',
      currentAgentId: 'agent-1',
      currentAgentName: 'PM Claw',
      status: 'in_progress',
      updatedAt: Date.now(),
    },
  ],
  metrics: {
    agents: { total: 1, active: 1, idle: 0, byRole: { pm: 1 } },
    sessions: { total: 1, active: 1, completed: 0, failed: 0 },
    tokens: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
    source: 'gateway',
    fetchedAt: '2026-04-22T00:00:00Z',
  },
  connected: true,
  fetchedAt: '2026-04-22T00:00:00Z',
};

describe('useOpenClawSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches unified snapshot data from /api/openclaw/snapshot', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockSnapshotResponse,
    });

    const { result } = renderHook(() => useOpenClawSnapshot());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledWith('/api/openclaw/snapshot', {
      headers: { 'x-api-key': 'dashboard' },
    });

    expect(result.current.agents).toHaveLength(1);
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.metrics).not.toBeNull();
    expect(result.current.connected).toBe(true);
  });

  it('exposes metrics with source indicator', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockSnapshotResponse,
    });

    const { result } = renderHook(() => useOpenClawSnapshot());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics?.source).toBe('gateway');
    expect(result.current.metrics?.agents.total).toBe(1);
    expect(result.current.metrics?.sessions.active).toBe(1);
  });

  it('handles fetch error gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useOpenClawSnapshot());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe('Network error');
    expect(result.current.agents).toHaveLength(0);
  });

  it('handles unsuccessful response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Gateway unavailable' }),
    });

    const { result } = renderHook(() => useOpenClawSnapshot());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe('Gateway unavailable');
  });

  it('provides refresh function', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockSnapshotResponse,
    });

    const { result } = renderHook(() => useOpenClawSnapshot());

    await waitFor(() => expect(result.current.loading).toBe(false));

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockSnapshotResponse,
        agents: [
          { ...mockSnapshotResponse.agents[0], name: 'Updated Claw' },
        ],
      }),
    });

    await act(() => {
      result.current.refresh();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});