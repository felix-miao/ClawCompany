import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import DashboardPage from '@/app/dashboard/page'

const mockRefresh = jest.fn()

jest.mock('@/hooks/useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: jest.fn(() => ({
    agents: [
      { id: 'pm-agent', name: 'PM', role: 'Project Manager', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'dev-agent', name: 'Dev', role: 'Developer', status: 'working', emotion: 'focused', currentTask: null, latestResultSummary: null },
      { id: 'review-agent', name: 'Reviewer', role: 'Code Reviewer', status: 'busy', emotion: 'thinking', currentTask: null, latestResultSummary: null },
      { id: 'test-agent', name: 'Tester', role: 'QA Engineer', status: 'idle', emotion: 'happy', currentTask: null, latestResultSummary: null },
    ],
    sessions: [
      { sessionKey: 'session-1', agentId: 'pm-agent', status: 'active', startedAt: Date.now() - 60000 },
    ],
    tasks: [
      {
        taskId: 'task-1',
        description: '实现登录功能',
        currentPhase: 'developer',
        currentAgentId: 'dev-agent',
        currentAgentName: 'Dev',
        createdAt: 100,
        updatedAt: 200,
        status: 'in_progress',
        phases: [
          { phase: 'submitted', label: 'Submitted', agentId: 'user', agentName: 'User', startTime: 100, endTime: 100, status: 'completed' },
          { phase: 'developer', label: 'Developer', agentId: 'dev-agent', agentName: 'Dev', startTime: 120, status: 'in_progress' },
        ],
        recentEvents: [
          { type: 'agent:status-change', agentId: 'dev-agent', status: 'working', timestamp: 150 },
        ],
      },
    ],
    metrics: null,
    connected: true,
    loading: false,
    error: null,
    refresh: mockRefresh,
  })),
}))

jest.mock('@/lib/core/metrics-aggregator', () => ({
  MetricsAggregator: jest.fn().mockImplementation(() => ({
    recordEvent: jest.fn(),
    getMetrics: jest.fn(() => null),
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

describe('Dashboard traditional view smoke tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({ taskId: 'task-1' }) })) as jest.Mock
  })

  it('renders the dashboard header and stats', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText(/1 events/)).toBeInTheDocument()
  })

  it('renders traditional task tracking instead of a game container', async () => {
    const { container } = render(React.createElement(DashboardPage))

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument()
    expect(screen.getAllByText('实现登录功能').length).toBeGreaterThan(0)
    expect(container.querySelector('#dashboard-game-container')).not.toBeInTheDocument()
  })

  it('shows agent and sidebar panels', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(screen.getByTestId('agent-card-pm-agent')).toBeInTheDocument()
    expect(screen.getByTestId('agent-card-dev-agent')).toBeInTheDocument()
    expect(screen.getByText('Control Panel')).toBeInTheDocument()
    expect(screen.getByText('Agent Status')).toBeInTheDocument()
  })

  it('refreshes snapshot after triggering a quick task', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({ method: 'POST' }))
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('does not expose game view controls', () => {
    render(React.createElement(DashboardPage))

    expect(screen.queryByRole('button', { name: 'Game View' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Timeline View' })).not.toBeInTheDocument()
  })
})
