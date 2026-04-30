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

const idleSnapshot = {
  ...fallbackSnapshot,
  connected: true,
  metrics: {
    ...fallbackSnapshot.metrics,
    source: 'gateway',
  },
}

const runningSnapshot = {
  agents: [
    {
      id: 'sidekick',
      name: 'Sidekick',
      role: 'pm',
      status: 'working',
      emotion: 'neutral',
      currentTask: 'Snapshot sidekick running acceptance',
      latestResultSummary: 'Snapshot sidekick latest result',
    },
    {
      id: 'pm',
      name: 'PM',
      role: 'pm',
      status: 'working',
      emotion: 'neutral',
      currentTask: 'Snapshot pm running acceptance',
      latestResultSummary: 'Snapshot pm latest result',
    },
  ],
  sessions: [
    {
      sessionKey: 'agent:sidekick:main',
      agentId: 'sidekick',
      agentName: 'Sidekick',
      role: 'pm',
      label: 'Snapshot sidekick running acceptance',
      status: 'running',
      startedAt: '2026-04-30T09:18:00Z',
      endedAt: null,
      currentWork: 'Snapshot sidekick running acceptance',
      latestThought: 'Sidekick is running from snapshot history',
      latestResultSummary: 'Snapshot sidekick latest result',
      finalResultSummary: null,
      model: 'gpt-5.5',
      latestMessage: 'Sidekick is running from snapshot history',
      latestMessageRole: 'assistant',
      latestMessageStatus: 'running',
      history: [
        { role: 'assistant', content: 'Sidekick is running from snapshot history', status: 'running', timestamp: '2026-04-30T09:18:01Z' },
      ],
      artifacts: [],
      finalDeliveryArtifacts: [],
      category: 'running',
      eventFeed: { events: [], totalCount: 0, byType: {} },
    },
    {
      sessionKey: 'agent:pm:main',
      agentId: 'pm',
      agentName: 'PM',
      role: 'pm',
      label: 'Snapshot pm running acceptance',
      status: 'running',
      startedAt: '2026-04-30T09:18:00Z',
      endedAt: null,
      currentWork: 'Snapshot pm running acceptance',
      latestThought: 'PM is running from snapshot history',
      latestResultSummary: 'Snapshot pm latest result',
      finalResultSummary: null,
      model: 'gpt-5.5',
      latestMessage: 'PM is running from snapshot history',
      latestMessageRole: 'assistant',
      latestMessageStatus: 'running',
      history: [
        { role: 'assistant', content: 'PM is running from snapshot history', status: 'running', timestamp: '2026-04-30T09:18:01Z' },
      ],
      artifacts: [],
      finalDeliveryArtifacts: [],
      category: 'running',
      eventFeed: { events: [], totalCount: 0, byType: {} },
    },
  ],
  tasks: [
    {
      taskId: 'agent:sidekick:main',
      description: 'Snapshot sidekick running acceptance',
      currentPhase: 'pm_analysis',
      currentAgentId: 'sidekick',
      currentAgentName: 'Sidekick',
      createdAt: Date.parse('2026-04-30T09:18:00Z'),
      updatedAt: Date.parse('2026-04-30T09:18:01Z'),
      status: 'in_progress',
      latestResultSummary: 'Snapshot sidekick latest result',
      phases: [
        { phase: 'pm_analysis', label: 'PM Analysis', agentId: 'sidekick', agentName: 'Sidekick', startTime: Date.parse('2026-04-30T09:18:00Z'), status: 'in_progress' },
      ],
      recentEvents: [
        {
          type: 'task:progress',
          timestamp: Date.parse('2026-04-30T09:18:01Z'),
          agentId: 'sidekick',
          taskId: 'agent:sidekick:main',
          progress: 0,
          currentAction: 'Sidekick is running from snapshot timeline',
        },
      ],
      agentSnapshots: {
        sidekick: {
          id: 'sidekick',
          name: 'Sidekick',
          role: 'pm',
          status: 'working',
          emotion: 'neutral',
          currentTask: 'Snapshot sidekick running acceptance',
          latestResultSummary: 'Snapshot sidekick latest result',
        },
      },
    },
    {
      taskId: 'agent:pm:main',
      description: 'Snapshot pm running acceptance',
      currentPhase: 'pm_analysis',
      currentAgentId: 'pm',
      currentAgentName: 'PM',
      createdAt: Date.parse('2026-04-30T09:18:00Z'),
      updatedAt: Date.parse('2026-04-30T09:18:01Z'),
      status: 'in_progress',
      latestResultSummary: 'Snapshot pm latest result',
      phases: [
        { phase: 'pm_analysis', label: 'PM Analysis', agentId: 'pm', agentName: 'PM', startTime: Date.parse('2026-04-30T09:18:00Z'), status: 'in_progress' },
      ],
      recentEvents: [
        {
          type: 'task:progress',
          timestamp: Date.parse('2026-04-30T09:18:01Z'),
          agentId: 'pm',
          taskId: 'agent:pm:main',
          progress: 0,
          currentAction: 'PM is running from snapshot timeline',
        },
      ],
      agentSnapshots: {
        pm: {
          id: 'pm',
          name: 'PM',
          role: 'pm',
          status: 'working',
          emotion: 'neutral',
          currentTask: 'Snapshot pm running acceptance',
          latestResultSummary: 'Snapshot pm latest result',
        },
      },
    },
  ],
  metrics: {
    agents: { total: 2, active: 2, idle: 0, byRole: { pm: 2 } },
    sessions: { total: 2, active: 2, completed: 0, failed: 0 },
    tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    source: 'gateway',
    fetchedAt: '2026-04-30T09:18:02Z',
  },
  connected: true,
  fetchedAt: '2026-04-30T09:18:02Z',
}

class MockEventSource {
  static instances: MockEventSource[] = []
  onerror: (() => void) | null = null
  onopen: (() => void) | null = null
  url: string
  private listeners = new Map<string, Array<(event: MessageEvent) => void>>()

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }
  close(): void {}

  open(): void {
    this.onopen?.()
  }

  emit(type: string, data: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent)
    }
  }

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
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/openclaw/snapshot?fresh=cold-start-bootstrap', expect.objectContaining({ cache: 'no-store' }))
  })

  it('does not synthesize active agents before OpenClaw snapshot reports them', async () => {
    render(<DashboardClient />)

    act(() => {
      MockEventSource.instances[0].open()
      MockEventSource.instances[0].emit('snapshot-full', idleSnapshot)
    })

    await waitFor(() => expect(screen.getByText('OpenClaw: Live')).toBeInTheDocument())
    expect(screen.getByText('Current Agents').nextElementSibling).toHaveTextContent('4')
    expect(screen.getAllByText('No active sessions').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/active agent/)).not.toBeInTheDocument()
  })

  it('renders sidekick and pm as active within 3 seconds from running snapshot fields', async () => {
    render(<DashboardClient />)

    act(() => {
      MockEventSource.instances[0].open()
      MockEventSource.instances[0].emit('snapshot-full', idleSnapshot)
    })

    await waitFor(() => expect(screen.getAllByText('No active sessions').length).toBeGreaterThanOrEqual(1))

    act(() => {
      MockEventSource.instances[0].emit('snapshot-full', runningSnapshot)
    })

    await waitFor(() => {
      expect(screen.getByTestId('agent-card-sidekick')).toHaveTextContent('working')
      expect(screen.getByTestId('agent-card-pm')).toHaveTextContent('working')
      expect(screen.getByText('Current Agents').parentElement).toHaveTextContent('2 active agents')
      expect(screen.getAllByText(/running/).length).toBeGreaterThanOrEqual(2)
    }, { timeout: 3000 })

    expect(screen.getByTestId('agent-card-sidekick')).toHaveTextContent('Snapshot sidekick running acceptance')
    expect(screen.getByTestId('agent-card-pm')).toHaveTextContent('Snapshot pm running acceptance')
    expect(screen.getAllByText('Snapshot sidekick latest result').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Snapshot pm latest result').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Sidekick is running from snapshot timeline')).toBeInTheDocument()
  })
})
