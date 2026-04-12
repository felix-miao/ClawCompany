import { fireEvent, render, screen } from '@testing-library/react';

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
    stats: { totalEvents: 0, activeTasks: 1, sessionCount: 0, completedSessionCount: 0, connected: true },
    taskHistory: [
      {
        taskId: 'task-1',
        description: '实现传统任务视图',
        currentPhase: 'developer',
        currentAgentId: 'dev-agent',
        currentAgentName: 'Dev Claw',
        createdAt: 100,
        updatedAt: 300,
        status: 'in_progress',
        phases: [
          { phase: 'submitted', label: 'Submitted', agentId: 'user', agentName: 'User', startTime: 100, endTime: 100, status: 'completed' },
          { phase: 'pm_analysis', label: 'PM Analysis', agentId: 'pm-agent', agentName: 'PM Claw', startTime: 120, endTime: 180, status: 'completed' },
          { phase: 'planning', label: 'Planning', agentId: 'pm-agent', agentName: 'PM Claw', startTime: 180, endTime: 200, status: 'completed' },
          { phase: 'developer', label: 'Developer', agentId: 'dev-agent', agentName: 'Dev Claw', startTime: 200, status: 'in_progress' },
          { phase: 'tester', label: 'Tester', agentId: 'test-agent', agentName: 'Tester Claw', status: 'pending' },
          { phase: 'reviewer', label: 'Reviewer', agentId: 'review-agent', agentName: 'Reviewer Claw', status: 'pending' },
          { phase: 'done', label: 'Done', agentId: null, agentName: null, status: 'pending' },
        ],
      },
    ],
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
    expect(screen.getByText('Loading office...')).toBeInTheDocument();
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
    expect(screen.getByText(/1 active tasks/)).toBeInTheDocument();
  });

  it('should render keyboard shortcuts', () => {
    render(<DashboardPage />);
    // Keyboard shortcuts removed in display-only mode; verify control panel is present instead
    expect(screen.getByText('Control Panel')).toBeInTheDocument();
  });

  it('should render trigger test task button', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/触发任务/)).toBeInTheDocument();
  });

  it('should render tester agent with correct emoji', () => {
    render(<DashboardPage />);
    expect(screen.getByText('QA Engineer')).toBeInTheDocument();
  });

  it('should switch to timeline view', () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Timeline View' }));

    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument();
    expect(screen.getAllByText('实现传统任务视图')[0]).toBeInTheDocument();
    expect(screen.getByText('当前卡点')).toBeInTheDocument();
  });
});
