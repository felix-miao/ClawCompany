import { act, render, screen, waitFor } from '@testing-library/react'

import { DashboardClient } from '../DashboardClient'

const fallbackSnapshot = {
  agents: [
    { id: 'pm-agent', name: 'PM Claw', role: 'Project Manager', status: 'idle', emotion: 'neutral', currentTask: null },
    { id: 'dev-agent', name: 'Dev Claw', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
    { id: 'review-agent', name: 'Reviewer Claw', role: 'Code Reviewer', status: 'idle', emotion: 'neutral', currentTask: null },
    { id: 'test-agent', name: 'Tester Claw', role: 'QA Engineer', status: 'idle', emotion: 'neutral', currentTask: null },
  ],
  sessions: [],
  tasks: [],
  metrics: {
    agents: { total: 4, active: 0, idle: 4, byRole: { 'Project Manager': 1, Developer: 1, 'Code Reviewer': 1, 'QA Engineer': 1 } },
    sessions: { total: 0, active: 0, completed: 0, failed: 0 },
    tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    source: 'fallback',
    fetchedAt: '2026-04-30T00:00:00Z',
  },
  connected: false,
  fetchedAt: '2026-04-30T00:00:00Z',
}

class MockEventSource {
  static instances: MockEventSource[] = []
  onerror: (() => void) | null = null
  url: string

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(): void {}
  close(): void {}

  error(): void {
    this.onerror?.()
  }
}

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

describe('DashboardClient snapshot fallback', () => {
  const originalEventSource = globalThis.EventSource
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    MockEventSource.instances = []
    globalThis.EventSource = MockEventSource as never
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fallbackSnapshot }) as never
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
    globalThis.fetch = originalFetch
  })

  it('renders fallback snapshot agents after the SSE stream fails', async () => {
    render(<DashboardClient />)

    act(() => {
      MockEventSource.instances[0].error()
    })

    await waitFor(() => expect(screen.getByText('PM Claw')).toBeInTheDocument())
    expect(screen.getByText('Current Agents').nextElementSibling).toHaveTextContent('4')
    expect(screen.queryByText('No agents reported')).not.toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/openclaw/snapshot', expect.objectContaining({ cache: 'no-store' }))
  })
})
