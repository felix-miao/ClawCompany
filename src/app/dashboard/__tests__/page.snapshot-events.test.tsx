import React from 'react'
import { render, screen } from '@testing-library/react'

import DashboardPage from '../page'

import type { GameEvent } from '@/game/types/GameEvents'

let mockSnapshotEvents: GameEvent[] = []

jest.mock('@/hooks/useSnapshotStream', () => ({
  useSnapshotStream: jest.fn(() => ({
    agents: [],
    sessions: [],
    tasks: mockSnapshotEvents.length > 0 ? [{
      taskId: 'task-001',
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
    refresh: jest.fn(),
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

describe('Dashboard page snapshot events', () => {
  beforeEach(() => {
    mockSnapshotEvents = []
  })

  function renderWithEvents(events: GameEvent[]) {
    mockSnapshotEvents = events
    return render(React.createElement(DashboardPage))
  }

  it('renders an empty timeline state without snapshot events', () => {
    renderWithEvents([])

    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument()
    expect(screen.getByText(/等待任务开始/)).toBeInTheDocument()
    expect(document.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('shows pm analysis events in the event log', () => {
    renderWithEvents([{
      type: 'pm:analysis-complete',
      agentId: 'pm-agent',
      timestamp: Date.now(),
      payload: { projectId: 'test', taskCount: 2, analysis: '需求分析' },
    }])

    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument()
    expect(screen.getByText('analysis-complete')).toBeInTheDocument()
  })

  it('shows developer iteration events in the selected task details', () => {
    renderWithEvents([{
      type: 'dev:iteration-start',
      agentId: 'dev-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', iteration: 1, hasFeedback: false },
    }])

    expect(screen.getByText('进入新一轮开发')).toBeInTheDocument()
  })

  it('shows workflow approval events in the selected task details', () => {
    renderWithEvents([{
      type: 'workflow:iteration-complete',
      agentId: 'review-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', totalIterations: 1, approved: true },
    }])

    expect(screen.getByText('本轮通过')).toBeInTheDocument()
  })

  it('shows review rejection and agent status events from the snapshot', () => {
    renderWithEvents([
      {
        type: 'review:rejected',
        agentId: 'review-agent',
        timestamp: Date.now(),
        payload: { taskId: 'task-001', iteration: 1, feedback: '错误处理不足' },
      },
      {
        type: 'agent:status-change',
        agentId: 'dev-agent',
        status: 'busy',
        timestamp: Date.now() + 1,
      },
    ])

    expect(screen.getByText('Reviewer 打回')).toBeInTheDocument()
    expect(screen.getByText('状态: busy')).toBeInTheDocument()
    expect(screen.getByText('dev-agent → busy')).toBeInTheDocument()
  })
})
