import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import DashboardPage from '@/app/dashboard/page'

const mockFetch = jest.fn()
const mockRefreshSnapshot = jest.fn()

jest.mock('@/hooks/useSnapshotStream', () => ({
  useSnapshotStream: jest.fn(() => ({
    agents: [
      { id: 'pm-agent', name: 'PM', role: 'Project Manager', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'dev-agent', name: 'Dev', role: 'Developer', status: 'working', emotion: 'focused', currentTask: '实现登录功能', latestResultSummary: null },
      { id: 'review-agent', name: 'Reviewer', role: 'Code Reviewer', status: 'busy', emotion: 'thinking', currentTask: null, latestResultSummary: null },
      { id: 'test-agent', name: 'Tester', role: 'QA Engineer', status: 'idle', emotion: 'happy', currentTask: null, latestResultSummary: null },
    ],
    sessions: [
      {
        sessionKey: 'task-smoke-001',
        agentId: 'dev-agent',
        agentName: 'Dev',
        role: 'developer',
        label: '实现登录功能',
        status: 'active',
        category: 'running',
        startedAt: '2026-04-14T05:00:00Z',
        endedAt: null,
        currentWork: '实现登录功能',
        latestThought: null,
        latestResultSummary: null,
        finalResultSummary: null,
        model: 'gpt-5.5',
        latestMessage: null,
        latestMessageRole: null,
        latestMessageStatus: null,
        history: [],
        artifacts: [],
        finalDeliveryArtifacts: [],
        eventFeed: { events: [], totalCount: 0, byType: {} },
      },
    ],
    tasks: [
      {
        taskId: 'task-smoke-001',
        description: '实现登录功能',
        currentPhase: 'developer',
        currentAgentId: 'dev-agent',
        currentAgentName: 'Dev',
        createdAt: Date.now() - 60000,
        updatedAt: Date.now(),
        status: 'in_progress',
        phases: [
          { phase: 'submitted', label: 'Submitted', agentId: 'user', agentName: 'User', status: 'completed', startTime: Date.now() - 60000, endTime: Date.now() - 59000 },
          { phase: 'developer', label: 'Developer', agentId: 'dev-agent', agentName: 'Dev', status: 'in_progress', startTime: Date.now() - 58000 },
        ],
        recentEvents: [
          { type: 'agent:status-change', agentId: 'dev-agent', status: 'busy', timestamp: Date.now() - 2000 },
          { type: 'task:progress', agentId: 'dev-agent', taskId: 'task-smoke-001', progress: 45, currentAction: 'Building dashboard timeline from snapshot', timestamp: Date.now() - 1000 },
        ],
      },
    ],
    metrics: {
      agents: { total: 4, active: 2, idle: 2, byRole: { Developer: 1 } },
      sessions: { total: 1, active: 1, completed: 0, failed: 0 },
      tokens: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      source: 'gateway',
      fetchedAt: new Date().toISOString(),
    },
    connected: true,
    loading: false,
    error: null,
    refresh: mockRefreshSnapshot,
  })),
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

describe('Dashboard timeline smoke tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, taskId: 'task-smoke-001' }),
    })
  })

  it('keeps the route entry SSR-safe', async () => {
    const pageModule = await import('@/app/dashboard/page')

    expect(pageModule.default.toString()).not.toContain('useEventStream')
    expect(pageModule.default.toString()).not.toContain('startGame')
  })

  it('renders the dashboard shell and snapshot status', async () => {
    const { container } = render(React.createElement(DashboardPage))

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.querySelector('header')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Timeline Entry')).toBeInTheDocument()
    expect(screen.getByText(/2 events/)).toBeInTheDocument()
  })

  it('mounts the traditional task tracker instead of a canvas scene', async () => {
    const { container } = render(React.createElement(DashboardPage))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('traditional-task-view')).toBeInTheDocument()
    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument()
    expect(container.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('shows agent state from the snapshot stream', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('agent-card-pm-agent')).toBeInTheDocument()
    expect(screen.getByTestId('agent-card-dev-agent')).toHaveTextContent('working')
    expect(screen.getByTestId('agent-card-review-agent')).toHaveTextContent('busy')
    expect(screen.getByTestId('agent-card-test-agent')).toBeInTheDocument()
  })

  it('posts quick tasks to chat and refreshes the snapshot stream', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(mockRefreshSnapshot).toHaveBeenCalled()
    })
    expect(mockFetch.mock.calls.map(call => call[0])).toEqual(['/api/chat'])
  })

  it('renders dashboard side panels from snapshot data', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Control Panel')).toBeInTheDocument()
    expect(screen.getByText('Agent Status')).toBeInTheDocument()
    expect(screen.getByText('Session Status')).toBeInTheDocument()
    expect(screen.getByText('Event Log')).toBeInTheDocument()
    expect(screen.getAllByText(/Building dashboard timeline from snapshot/).length).toBeGreaterThan(0)
  })

  it('shows a friendly error when task submission fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) })

    render(React.createElement(DashboardPage))

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(screen.getByText('触发失败，请重试')).toBeInTheDocument()
    })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
