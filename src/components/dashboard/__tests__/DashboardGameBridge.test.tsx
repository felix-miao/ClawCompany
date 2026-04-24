import { act, render, waitFor } from '@testing-library/react';

import { DashboardGameBridge } from '../DashboardGameBridge';

const mockReceiveGameEvent = jest.fn();
const mockDestroy = jest.fn();

let capturedStore: { processEvent: (event: unknown) => void } | null = null;

jest.mock('@/game', () => ({
  startGame: jest.fn(() => ({
    receiveGameEvent: mockReceiveGameEvent,
    destroy: mockDestroy,
  })),
}));

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: jest.fn((store: { processEvent: (event: unknown) => void }) => {
    capturedStore = store;
    return { isConnected: true, isReconnecting: false };
  }),
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
    capturedStore = null;
    mockReceiveGameEvent.mockClear();
    mockDestroy.mockClear();
    jest.mocked(require('@/game').startGame).mockClear();
  });

  it('starts the game lazily on the client and forwards SSE events', async () => {
    render(<DashboardGameBridge activeView="game" />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => expect(jest.mocked(require('@/game').startGame)).toHaveBeenCalledWith('dashboard-game-container'));

    capturedStore?.processEvent({
      type: 'pm:analysis-complete',
      agentId: 'pm-agent',
      timestamp: Date.now(),
    });

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pm:analysis-complete' }),
      );
    });
  });

  it('does not start the game when timeline is active', () => {
    render(<DashboardGameBridge activeView="timeline" />);

    expect(jest.mocked(require('@/game').startGame)).not.toHaveBeenCalled();
  });
});
