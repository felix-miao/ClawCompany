import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import DashboardPage from '@/app/dashboard/page'

const mockRefresh = jest.fn()
const mockFetch = jest.fn()
global.fetch = mockFetch

jest.mock('@/hooks/useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: jest.fn(() => ({
    agents: [],
    sessions: [],
    tasks: [],
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

describe('Dashboard smoke: ControlPanel click to snapshot refresh', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockRefresh.mockClear()
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/chat') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            workflowType: 'orchestrator',
            taskId: 'task-e2e-001',
            message: 'PM 分析完成，任务已拆分',
            tasks: [
              { id: 'subtask-1', title: '实现登录表单', status: 'completed', assignedTo: 'dev' },
            ],
          }),
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
  })

  it('sends /api/chat when clicking a quick task', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('refreshes the traditional dashboard after a task is triggered', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })
})
