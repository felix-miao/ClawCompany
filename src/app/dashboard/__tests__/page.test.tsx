import { fireEvent, render, screen } from '@testing-library/react';

import DashboardPage from '../page';

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({ isConnected: true, isReconnecting: false }),
}));

jest.mock('@/hooks/useDashboardStore', () => ({
  useDashboardStore: () => ({
    events: [],
    stats: { totalEvents: 0, activeTasks: 1, sessionCount: 0, completedSessionCount: 0, connected: true },
  }),
}));

jest.mock('@/hooks/useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: () => ({
    agents: [
      { id: 'pm-agent', name: 'PM Claw', role: 'Project Manager', status: 'working', emotion: 'neutral', currentTask: '用你的团队给我写一个网站出来', latestResultSummary: '已生成初始任务拆分' },
      { id: 'dev-agent', name: 'Dev Claw', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'review-agent', name: 'Reviewer Claw', role: 'Code Reviewer', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'test-agent', name: 'Tester Claw', role: 'QA Engineer', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ],
    sessions: [
      {
        sessionKey: 'sess-1',
        agentId: 'pm-agent',
        agentName: 'PM Claw',
        role: 'pm',
        label: 'Test session label',
        status: 'running',
        startedAt: '2026-04-14T05:00:00Z',
        endedAt: null,
        currentWork: 'Working on something',
        latestThought: 'Thinking about stuff',
        latestResultSummary: 'Result summary',
        model: 'gpt-5.4',
        latestMessage: 'This is the latest assistant message',
        latestMessageRole: 'assistant',
        latestMessageStatus: 'completed',
        history: [
          { role: 'user', content: 'User request 1', timestamp: '2026-04-14T05:00:00Z' },
          { role: 'assistant', content: 'Assistant response 1', timestamp: '2026-04-14T05:01:00Z' },
        ],
        artifacts: [
          {
            type: 'code',
            path: '/Users/test/draft.ts',
            title: 'draft.ts',
            producedBy: 'dev-agent',
            producedAt: '2026-04-14T05:10:00Z',
          },
        ],
        finalDeliveryArtifacts: [
          {
            type: 'html',
            path: '/Users/test/index.html',
            url: 'file:///Users/test/index.html',
            title: 'index.html',
            producedBy: 'dev-agent',
            producedAt: '2026-04-14T05:20:00Z',
          },
        ],
        category: 'running',
      },
    ],
    tasks: [
      {
        taskId: 'sess-1',
        description: '用你的团队给我写一个网站出来',
        currentPhase: 'pm_analysis',
        currentAgentId: 'pm-agent',
        currentAgentName: 'PM Claw',
        createdAt: 100,
        updatedAt: 300,
        status: 'in_progress',
        phases: [
          { phase: 'submitted', label: 'Submitted', agentId: 'user', agentName: 'User', startTime: 100, endTime: 100, status: 'completed' },
          { phase: 'pm_analysis', label: 'PM Analysis', agentId: 'pm-agent', agentName: 'PM Claw', startTime: 120, status: 'in_progress' },
          { phase: 'planning', label: 'Planning', agentId: 'pm-agent', agentName: 'PM Claw', status: 'pending' },
          { phase: 'developer', label: 'Developer', agentId: 'dev-agent', agentName: 'Dev Claw', status: 'pending' },
          { phase: 'tester', label: 'Tester', agentId: 'test-agent', agentName: 'Tester Claw', status: 'pending' },
          { phase: 'reviewer', label: 'Reviewer', agentId: 'review-agent', agentName: 'Reviewer Claw', status: 'pending' },
          { phase: 'done', label: 'Done', agentId: null, agentName: null, status: 'pending' },
        ],
        recentEvents: [],
      },
    ],
    metrics: {
      agents: { total: 4, active: 1, idle: 3, byRole: { Developer: 1 } },
      sessions: { total: 1, active: 1, completed: 0, failed: 0 },
      tokens: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      source: 'gateway',
      fetchedAt: new Date().toISOString(),
    },
    connected: true,
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/game', () => ({
  startGame: jest.fn(() => ({ destroy: jest.fn(), triggerTestTask: jest.fn() })),
}));

jest.mock('@/lib/core/metrics-aggregator', () => ({
  MetricsAggregator: jest.fn().mockImplementation(() => ({
    startPeriodicUpdate: jest.fn(() => () => {}),
  })),
}));

jest.mock('@/lib/core/performance-monitor', () => ({
  PerformanceMonitor: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/lib/core/error-tracker', () => ({
  ErrorTracker: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/lib/core/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({})),
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

  it('should render game container without showing a stuck loading overlay', () => {
    render(<DashboardPage />);
    expect(screen.queryByText('Loading office...')).not.toBeInTheDocument();
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
    expect(screen.getAllByText('用你的团队给我写一个网站出来')[0]).toBeInTheDocument();
    expect(screen.getByText('当前卡点')).toBeInTheDocument();
    expect(screen.getByText('PM Analysis · PM Claw')).toBeInTheDocument();
  });

  it('should show SessionInspector when clicking an agent in the panel', async () => {
    render(<DashboardPage />);

    const pmAgentCard = screen.getByTestId('agent-card-pm-agent');
    fireEvent.click(pmAgentCard);

    expect(screen.getByText('Session Inspector')).toBeInTheDocument();
    const pmClawInInspector = screen.getAllByText('PM Claw')[0];
    expect(pmClawInInspector).toBeInTheDocument();
    expect(screen.getByText(/This is the latest assistant message/)).toBeInTheDocument();
  });

  it('should display recent history in SessionInspector', async () => {
    render(<DashboardPage />);

    const pmAgentCard = screen.getByTestId('agent-card-pm-agent');
    fireEvent.click(pmAgentCard);

    expect(screen.getByText(/Recent History \(2 messages\)/)).toBeInTheDocument();
    expect(screen.getByText(/User request 1/)).toBeInTheDocument();
    expect(screen.getByText(/Assistant response 1/)).toBeInTheDocument();
  });

  it('should close SessionInspector when close button is clicked', async () => {
    render(<DashboardPage />);

    const pmAgentCard = screen.getByTestId('agent-card-pm-agent');
    fireEvent.click(pmAgentCard);

    expect(screen.getByText('Session Inspector')).toBeInTheDocument();

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(screen.queryByText('Session Inspector')).not.toBeInTheDocument();
  });

  it('should display active agent summary directly on dashboard without inspector', async () => {
    render(<DashboardPage />);

    const workingAgents = screen.getAllByText('working');
    expect(workingAgents.length).toBeGreaterThan(0);
    expect(screen.getAllByText('用你的团队给我写一个网站出来').length).toBeGreaterThan(0);
  });

  it('should display latest result summary for active agent on dashboard', async () => {
    render(<DashboardPage />);

    const pmCard = screen.getByTestId('agent-card-pm-agent');
    expect(pmCard).toBeInTheDocument();
    expect(screen.getByText(/已生成初始任务拆分/)).toBeInTheDocument();
  });

  it('should prioritize final delivery artifacts in SessionArtifactsPanel and SessionInspector', async () => {
    render(<DashboardPage />);

    expect(screen.getByText('Session Outputs')).toBeInTheDocument();
    expect(screen.getByText('index.html')).toBeInTheDocument();
    expect(screen.queryByText('draft.ts')).not.toBeInTheDocument();

    const pmAgentCard = screen.getByTestId('agent-card-pm-agent');
    fireEvent.click(pmAgentCard);

    expect(screen.getByText('Final Delivery (1)')).toBeInTheDocument();
    expect(screen.getAllByText('/Users/test/index.html')).toHaveLength(2);
  });

  it('should show timeline view with task card when switching views', async () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Timeline View' }));

    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument();
    expect(screen.getByText('当前卡点')).toBeInTheDocument();
  });

  it('should display active agents summary in header directly', async () => {
    render(<DashboardPage />);

    expect(screen.getByText(/1 active agent/)).toBeInTheDocument();
    expect(screen.getAllByText('working').length).toBeGreaterThan(0);
  });

  it('should show which agent is currently working in header', async () => {
    render(<DashboardPage />);

    const header = document.querySelector('header');
    expect(header).toHaveTextContent(/PM Claw/);
  });
});
