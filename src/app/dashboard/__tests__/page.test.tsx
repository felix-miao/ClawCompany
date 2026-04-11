import { render, screen } from '@testing-library/react';

import DashboardPage from '../page';

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({ isConnected: true, isReconnecting: false }),
}));

jest.mock('@/hooks/useDashboardStore', () => ({
  useDashboardStore: () => ({
    agents: [
      { id: 'pm-agent', name: 'PM Claw', role: 'Project Manager', status: 'idle', emotion: 'neutral', currentTask: null },
      { id: 'dev-agent', name: 'Dev Claw', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
      { id: 'review-agent', name: 'Reviewer Claw', role: 'Code Reviewer', status: 'idle', emotion: 'neutral', currentTask: null },
      { id: 'test-agent', name: 'Tester Claw', role: 'QA Engineer', status: 'idle', emotion: 'neutral', currentTask: null },
    ],
    events: [],
    stats: { totalEvents: 0, activeTasks: 0, sessionCount: 0, completedSessionCount: 0, connected: true },
  }),
}));

jest.mock('@/game', () => ({
  startGame: jest.fn(() => ({ destroy: jest.fn(), triggerTestTask: jest.fn() })),
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

  it('should render game loading overlay initially', () => {
    render(<DashboardPage />);
    expect(screen.getByText('正在加载虚拟办公室...')).toBeInTheDocument();
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

  it('should render keyboard shortcuts', () => {
    render(<DashboardPage />);
    expect(screen.getByText('🎮 键盘操作')).toBeInTheDocument();
  });

  it('should render trigger test task button', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/触发任务/)).toBeInTheDocument();
  });

  it('should render tester agent with correct emoji', () => {
    render(<DashboardPage />);
    expect(screen.getByText('QA Engineer')).toBeInTheDocument();
  });
});
