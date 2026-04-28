import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import type { GameEvent } from '@/game/types/GameEvents'
import DashboardPage from '@/app/dashboard/page'

const mockFetch = jest.fn()
const mockRefreshSnapshot = jest.fn()

let mockSnapshotEvents: GameEvent[] = []

jest.mock('@/hooks/useSnapshotStream', () => ({
  useSnapshotStream: jest.fn(() => ({
    agents: [],
    sessions: [],
    tasks: mockSnapshotEvents.length > 0 ? [{
      taskId: 'task-e2e-001',
      description: 'Snapshot task',
      currentPhase: 'developer',
      currentAgentId: 'dev-agent',
      currentAgentName: 'Dev',
      createdAt: 1,
      updatedAt: 2,
      status: 'in_progress',
      phases: [
        { phase: 'developer', label: 'Developer', agentId: 'dev-agent', agentName: 'Dev', status: 'in_progress', startTime: 1 },
      ],
      recentEvents: mockSnapshotEvents,
    }] : [],
    metrics: null,
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

describe('Dashboard task submission and snapshot refresh', () => {
  beforeEach(() => {
    global.fetch = mockFetch
    mockFetch.mockReset()
    mockRefreshSnapshot.mockClear()
    mockSnapshotEvents = []

    mockFetch.mockResolvedValue({
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
  })

  it('clicking a preset task sends a chat request', async () => {
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

  it('refreshes the snapshot stream after chat returns a task id', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(mockRefreshSnapshot).toHaveBeenCalled()
    })
  })

  it('only posts through the chat endpoint when triggering a task', async () => {
    render(React.createElement(DashboardPage))

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
    expect(mockFetch.mock.calls.map(call => call[0])).toEqual(['/api/chat'])
  })

  it('renders the updated snapshot timeline after task submission', async () => {
    const view = render(React.createElement(DashboardPage))

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })
    await waitFor(() => expect(mockRefreshSnapshot).toHaveBeenCalled())

    mockSnapshotEvents = [
      {
        type: 'pm:analysis-complete',
        agentId: 'pm-agent',
        timestamp: Date.now(),
        payload: { projectId: 'test', taskCount: 1, analysis: '需求分析' },
      },
      {
        type: 'dev:iteration-start',
        agentId: 'dev-agent',
        timestamp: Date.now() + 1,
        payload: { taskId: 'task-e2e-001', iteration: 1, hasFeedback: false },
      },
      {
        type: 'workflow:iteration-complete',
        agentId: 'review-agent',
        timestamp: Date.now() + 2,
        payload: { taskId: 'task-e2e-001', totalIterations: 1, approved: true },
      },
    ]

    view.rerender(React.createElement(DashboardPage))

    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument()
    expect(screen.getByText('analysis-complete')).toBeInTheDocument()
    expect(screen.getByText('进入新一轮开发')).toBeInTheDocument()
    expect(screen.getByText('本轮通过')).toBeInTheDocument()
  })
})
