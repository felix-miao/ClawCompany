import React from 'react'
import { render, act } from '@testing-library/react'

const mockDestroy = jest.fn()
const mockStartGame = jest.fn(() => ({
  destroy: mockDestroy,
  receiveGameEvent: jest.fn(),
  triggerTestTask: jest.fn(),
}))

jest.mock('@/game', () => ({
  startGame: (...args: unknown[]) => mockStartGame(...args),
}))

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({ isConnected: true, isReconnecting: false }),
}))

jest.mock('@/hooks/useDashboardStore', () => ({
  useDashboardStore: () => ({
    agents: [],
    events: [],
    stats: { totalEvents: 0, activeTasks: 0, sessionCount: 0, completedSessionCount: 0, connected: true },
    taskHistory: [],
  }),
}))

jest.mock('@/hooks/useOpenClawSessions', () => ({
  useOpenClawSessions: jest.fn(),
}))

jest.mock('@/hooks/useOpenClawMetrics', () => ({
  useOpenClawMetrics: () => ({ metrics: null, source: 'none' }),
}))

jest.mock('@/lib/core/metrics-aggregator', () => ({
  MetricsAggregator: jest.fn().mockImplementation(() => ({
    startPeriodicUpdate: jest.fn(() => () => {}),
  })),
}))

jest.mock('@/lib/core/performance-monitor', () => ({
  PerformanceMonitor: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@/lib/core/error-tracker', () => ({
  ErrorTracker: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@/lib/core/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({})),
}))

import DashboardPage from '../page'

describe('DashboardPage strict mode startup', () => {
  beforeEach(() => {
    mockStartGame.mockClear();
    mockDestroy.mockClear();
  });

  it('should tear down stale game instances created during strict mode remounts', async () => {
    const view = render(
      <React.StrictMode>
        <DashboardPage />
      </React.StrictMode>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockStartGame.mock.calls.length).toBeLessThanOrEqual(2);

    view.unmount();
    expect(mockDestroy).toHaveBeenCalled();
  });
});
