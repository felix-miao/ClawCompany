import { act, render, waitFor } from '@testing-library/react';

import { DashboardGameBridge } from '../DashboardGameBridge';

const mockReceiveGameEvent = jest.fn();
const mockDestroy = jest.fn();

const mockUseEventStream = jest.fn();

jest.mock('@/game', () => ({
  startGame: jest.fn(() => ({
    receiveGameEvent: mockReceiveGameEvent,
    destroy: mockDestroy,
  })),
}));

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: mockUseEventStream,
}));

jest.mock('@/hooks/useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: jest.fn(() => ({
    agents: [],
    sessions: [],
    tasks: [],
    metrics: null,
    connected: true,
    loading: false,
    error: null,
    refresh: jest.fn(),
  })),
}));

jest.mock('@/game/data/DashboardStore', () => ({
  DashboardStore: jest.fn().mockImplementation(() => ({
    processEvent: jest.fn(),
  })),
}));

describe('DashboardGameBridge', () => {
  beforeEach(() => {
    mockReceiveGameEvent.mockClear();
    mockDestroy.mockClear();
    jest.mocked(require('@/game').startGame).mockClear();
  });

  it('starts the game lazily on the client and forwards snapshot-derived events', async () => {
    render(
      <DashboardGameBridge
        activeView="game"
        gameEvents={[
          {
            type: 'pm:analysis-complete',
            agentId: 'pm-agent',
            timestamp: 100,
            payload: { projectId: 'project-1', taskCount: 1, analysis: 'ready' },
          },
        ]}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => expect(jest.mocked(require('@/game').startGame)).toHaveBeenCalledWith('dashboard-game-container'));

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pm:analysis-complete' }),
      );
    });
    expect(mockUseEventStream).not.toHaveBeenCalled();
  });

  it('does not forward the same snapshot event twice after rerender', async () => {
    const event = {
      type: 'agent:status-change' as const,
      agentId: 'pm-agent',
      status: 'working' as const,
      timestamp: 100,
    };

    const { rerender } = render(<DashboardGameBridge activeView="game" gameEvents={[event]} />);

    await waitFor(() => expect(mockReceiveGameEvent).toHaveBeenCalledTimes(1));

    rerender(<DashboardGameBridge activeView="game" gameEvents={[event]} />);

    expect(mockReceiveGameEvent).toHaveBeenCalledTimes(1);
  });

  it('does not start the game when timeline is active', () => {
    render(<DashboardGameBridge activeView="timeline" gameEvents={[]} />);

    expect(jest.mocked(require('@/game').startGame)).not.toHaveBeenCalled();
  });
});
