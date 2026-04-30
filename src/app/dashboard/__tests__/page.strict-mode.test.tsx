import React from 'react'
import { act, render, screen } from '@testing-library/react'

const mockCleanupMetrics = jest.fn()
const mockStartPeriodicUpdate = jest.fn(() => mockCleanupMetrics)

jest.mock('@/hooks/useSnapshotStream', () => ({
  useSnapshotStream: () => ({
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
    startPeriodicUpdate: mockStartPeriodicUpdate,
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
    mockCleanupMetrics.mockClear()
    mockStartPeriodicUpdate.mockClear()
  })

  it('keeps the timeline dashboard stable across strict mode remounts', async () => {
    const view = render(
      <React.StrictMode>
        <DashboardPage />
      </React.StrictMode>,
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument()
    expect(document.querySelector('canvas')).not.toBeInTheDocument()
    expect(mockStartPeriodicUpdate).toHaveBeenCalled()

    view.unmount()
    expect(mockCleanupMetrics).toHaveBeenCalled()
  })
})
