import React from 'react'
import { render, screen } from '@testing-library/react'

import DashboardPage from '../page'

const mockRefresh = jest.fn()

jest.mock('@/hooks/useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: jest.fn(() => ({
    agents: [],
    sessions: [],
    tasks: [
      {
        taskId: 'task-1',
        description: 'Build a landing page',
        currentPhase: 'developer',
        currentAgentId: 'dev-agent',
        currentAgentName: 'Dev Claw',
        createdAt: 100,
        updatedAt: 200,
        status: 'in_progress',
        phases: [],
        recentEvents: [],
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
    getMetrics: jest.fn(() => ({})),
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

describe('Dashboard page traditional view', () => {
  beforeEach(() => {
    mockRefresh.mockClear()
  })

  it('renders the traditional task tracker without mounting a game canvas', () => {
    render(React.createElement(DashboardPage))

    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument()
    expect(screen.getAllByText('Build a landing page').length).toBeGreaterThan(0)
    expect(document.getElementById('dashboard-game-container')).not.toBeInTheDocument()
  })

  it('does not show game view controls', () => {
    render(React.createElement(DashboardPage))

    expect(screen.queryByRole('button', { name: 'Game View' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Timeline View' })).not.toBeInTheDocument()
  })
})
