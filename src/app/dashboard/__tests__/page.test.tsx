import { render, screen } from '@testing-library/react';

import DashboardPage from '../page';

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({ isConnected: true, isReconnecting: false }),
}));

jest.mock('@/hooks/useDashboardStore', () => ({
  useDashboardStore: () => ({
    agents: [
      { id: 'alice', name: 'Alice', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
      { id: 'bob', name: 'Bob', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
      { id: 'charlie', name: 'Charlie', role: 'PM', status: 'idle', emotion: 'neutral', currentTask: null },
      { id: 'diana', name: 'Diana', role: 'Reviewer', status: 'idle', emotion: 'neutral', currentTask: null },
    ],
    events: [],
    stats: { totalEvents: 0, activeTasks: 0, sessionCount: 0, completedSessionCount: 0, connected: true },
  }),
}));

jest.mock('@/game', () => ({
  startGame: jest.fn(() => ({ destroy: jest.fn() })),
}));

describe('DashboardPage', () => {
  it('should render dashboard title', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render connection status', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('should render game container', () => {
    render(<DashboardPage />);

    expect(document.getElementById('dashboard-game-container')).toBeInTheDocument();
  });

  it('should render back link', () => {
    render(<DashboardPage />);

    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  it('should render agent status panel', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Agent Status')).toBeInTheDocument();
  });

  it('should render event log', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Event Log')).toBeInTheDocument();
  });

  it('should render control panel', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Control Panel')).toBeInTheDocument();
  });

  it('should display stats in header', () => {
    render(<DashboardPage />);

    expect(screen.getByText(/0 events/)).toBeInTheDocument();
    expect(screen.getByText(/0 active tasks/)).toBeInTheDocument();
  });
});
