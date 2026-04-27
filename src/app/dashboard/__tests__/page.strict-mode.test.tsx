import React from 'react'
import { render, screen } from '@testing-library/react'

import DashboardPage from '../page'

jest.mock('@/hooks/useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: () => ({
    agents: [],
    sessions: [],
    tasks: [],
    metrics: null,
    connected: true,
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
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

describe('DashboardPage strict mode startup', () => {
  it('renders traditional dashboard without starting a game instance', () => {
    render(
      <React.StrictMode>
        <DashboardPage />
      </React.StrictMode>
    )

    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument()
    expect(document.getElementById('dashboard-game-container')).not.toBeInTheDocument()
  })
})
