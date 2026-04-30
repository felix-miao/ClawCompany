import { expect, test } from '@playwright/test'

const liveSnapshot = {
  agents: [
    {
      id: 'dev-claw',
      name: 'Dev Claw',
      role: 'Developer',
      status: 'working',
      emotion: 'neutral',
      currentTask: 'Dashboard live fixture session',
      latestResultSummary: '已写入文件: /tmp/claw-company-live/dashboard-live.html',
    },
    { id: 'sidekick-claw', name: 'PM Claw', role: 'PM', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    { id: 'reviewer-claw', name: 'Reviewer Claw', role: 'Reviewer', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    { id: 'tester-claw', name: 'Tester Claw', role: 'Tester', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
  ],
  sessions: [
    {
      sessionKey: 'sess-live-dev',
      agentId: 'dev-claw',
      agentName: 'Dev Claw',
      role: 'dev',
      label: 'Dashboard live fixture session',
      status: 'running',
      startedAt: '2026-04-30T02:45:00Z',
      endedAt: null,
      currentWork: 'Dashboard live fixture session',
      latestThought: 'Implementing dashboard live active session timeline',
      latestResultSummary: '已写入文件: /tmp/claw-company-live/dashboard-live.html',
      finalResultSummary: {
        toolType: 'write',
        operation: 'write',
        paths: ['/tmp/claw-company-live/dashboard-live.html'],
        urls: [],
        status: 'completed',
        summaryText: '已写入文件: /tmp/claw-company-live/dashboard-live.html',
      },
      model: 'gpt-5.5',
      usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
      latestMessage: '已写入文件: /tmp/claw-company-live/dashboard-live.html',
      latestMessageRole: 'toolResult',
      latestMessageStatus: 'completed',
      history: [
        { role: 'user', content: 'Run dashboard live acceptance fixture', status: 'completed', timestamp: '2026-04-30T02:45:01Z' },
        { role: 'assistant', content: 'Implementing dashboard live active session timeline', status: 'running', timestamp: '2026-04-30T02:45:02Z' },
        { role: 'toolResult', content: '已写入文件: /tmp/claw-company-live/dashboard-live.html', status: 'completed', timestamp: '2026-04-30T02:45:03Z' },
      ],
      artifacts: [
        {
          type: 'html',
          path: '/tmp/claw-company-live/dashboard-live.html',
          title: 'dashboard-live.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-30T02:45:03Z',
          isFinal: true,
        },
      ],
      finalDeliveryArtifacts: [],
      category: 'running',
      eventFeed: {
        events: [],
        totalCount: 0,
        byType: {
          'tool:invoked': 0,
          'tool:completed': 1,
          'tool:failed': 0,
          'file:created': 1,
          'file:modified': 0,
          'file:deleted': 0,
          'file:read': 0,
          'artifact:produced': 1,
          'message:sent': 1,
          'message:received': 1,
          'session:handover': 0,
          'session:progress': 0,
          'session:completed': 0,
          'session:failed': 0,
        },
      },
    },
  ],
  tasks: [
    {
      taskId: 'sess-live-dev',
      description: 'Dashboard live fixture session',
      currentPhase: 'developer',
      currentAgentId: 'dev-claw',
      currentAgentName: 'Dev Claw',
      createdAt: Date.parse('2026-04-30T02:45:00Z'),
      updatedAt: Date.parse('2026-04-30T02:45:03Z'),
      status: 'in_progress',
      latestResultSummary: '已写入文件: /tmp/claw-company-live/dashboard-live.html',
      phases: [
        { phase: 'submitted', label: 'Submitted', agentId: 'user', agentName: 'User', startTime: Date.parse('2026-04-30T02:45:00Z'), endTime: Date.parse('2026-04-30T02:45:00Z'), status: 'completed' },
        { phase: 'pm_analysis', label: 'PM Analysis', agentId: null, agentName: null, status: 'completed' },
        { phase: 'planning', label: 'Planning', agentId: null, agentName: null, status: 'completed' },
        { phase: 'developer', label: 'Developer', agentId: 'dev-claw', agentName: 'Dev Claw', startTime: Date.parse('2026-04-30T02:45:02Z'), status: 'in_progress' },
        { phase: 'tester', label: 'Tester', agentId: null, agentName: null, status: 'pending' },
        { phase: 'reviewer', label: 'Reviewer', agentId: null, agentName: null, status: 'pending' },
        { phase: 'done', label: 'Done', agentId: null, agentName: null, status: 'pending' },
      ],
      recentEvents: [
        {
          type: 'task:progress',
          timestamp: Date.parse('2026-04-30T02:45:02Z'),
          agentId: 'dev-claw',
          taskId: 'sess-live-dev',
          progress: 0,
          currentAction: 'Implementing dashboard live active session timeline',
        },
        {
          type: 'task:completed',
          timestamp: Date.parse('2026-04-30T02:45:03Z'),
          agentId: 'dev-claw',
          taskId: 'sess-live-dev',
          result: 'success',
          duration: 0,
        },
      ],
      agentSnapshots: {
        'dev-claw': {
          id: 'dev-claw',
          name: 'Dev Claw',
          role: 'Developer',
          status: 'working',
          emotion: 'neutral',
          currentTask: 'Dashboard live fixture session',
          latestResultSummary: '已写入文件: /tmp/claw-company-live/dashboard-live.html',
        },
      },
    },
  ],
  metrics: {
    agents: { total: 4, active: 1, idle: 3, byRole: { Developer: 1, PM: 1, Reviewer: 1, Tester: 1 } },
    sessions: { total: 1, active: 1, completed: 0, failed: 0 },
    tokens: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
    source: 'gateway',
    fetchedAt: '2026-04-30T02:45:04Z',
  },
  connected: true,
  fetchedAt: '2026-04-30T02:45:04Z',
}

const sidekickPmRunningSnapshot = {
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
        { type: 'task:progress', timestamp: Date.parse('2026-04-30T09:18:01Z'), agentId: 'sidekick', taskId: 'agent:sidekick:main', progress: 0, currentAction: 'Sidekick is running from snapshot timeline' },
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
        { type: 'task:progress', timestamp: Date.parse('2026-04-30T09:18:01Z'), agentId: 'pm', taskId: 'agent:pm:main', progress: 0, currentAction: 'PM is running from snapshot timeline' },
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

test('dashboard renders active OpenClaw session timeline, inspector, and artifacts from snapshot data', async ({ page }) => {
  await page.route('**/api/openclaw/snapshot/stream', async route => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
      body: `event: snapshot-full\ndata: ${JSON.stringify(liveSnapshot)}\n\n`,
    })
  })
  await page.route('**/api/openclaw/snapshot', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(liveSnapshot) })
  })

  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Current Agents')).toBeVisible()
  await expect(page.getByText('1 active agent').first()).toBeVisible()
  await expect(page.getByTestId('agent-card-dev-claw')).toContainText('working')
  await expect(page.getByText('Dashboard live fixture session').first()).toBeVisible()
  await expect(page.getByText('Implementing dashboard live active session timeline').first()).toBeVisible()
  await expect(page.getByText('Session Outputs')).toBeVisible()
  await expect(page.getByText('dashboard-live.html', { exact: true })).toBeVisible()

  await page.getByTestId('agent-card-dev-claw').click()

  await expect(page.getByText('Session Inspector')).toBeVisible()
  await expect(page.getByText('Last Tool Result')).toBeVisible()
  await expect(page.getByText('/tmp/claw-company-live/dashboard-live.html').first()).toBeVisible()
  await expect(page.getByText(/Recent History \(3 messages\)/)).toBeVisible()
})

test('dashboard shows sidekick and pm active from running OpenClaw snapshot within 3 seconds', async ({ page }) => {
  await page.route('**/api/openclaw/snapshot/stream', async route => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
      body: `event: snapshot-full\ndata: ${JSON.stringify(sidekickPmRunningSnapshot)}\n\n`,
    })
  })
  await page.route('**/api/openclaw/snapshot', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sidekickPmRunningSnapshot) })
  })

  await page.goto('/dashboard')

  await expect(page.getByText('2 active agents').first()).toBeVisible({ timeout: 3000 })
  await expect(page.getByTestId('agent-card-sidekick')).toContainText('working')
  await expect(page.getByTestId('agent-card-pm')).toContainText('working')
  await expect(page.getByTestId('agent-card-sidekick')).toContainText('Snapshot sidekick running acceptance')
  await expect(page.getByTestId('agent-card-pm')).toContainText('Snapshot pm running acceptance')
  await expect(page.getByText('Sidekick is running from snapshot timeline').first()).toBeVisible()
  await expect(page.getByText('PM is running from snapshot timeline').first()).toBeVisible()
  await expect(page.getByText('running').first()).toBeVisible()
})

test('dashboard bootstraps active agents within 3 seconds when cold stream first package is delayed', async ({ page }) => {
  const snapshotRequests: string[] = []

  await page.route('**/api/openclaw/snapshot/stream', async route => {
    await new Promise(resolve => setTimeout(resolve, 5000))
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
      body: `event: snapshot-full\ndata: ${JSON.stringify(sidekickPmRunningSnapshot)}\n\n`,
    })
  })
  await page.route('**/api/openclaw/snapshot**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/openclaw/snapshot') {
      snapshotRequests.push(`${url.pathname}${url.search}`)
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sidekickPmRunningSnapshot) })
  })

  await page.goto('/dashboard')

  await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 3000 })
  await expect(page.getByText('OpenClaw: Live')).toBeVisible({ timeout: 3000 })
  await expect(page.getByText('2 active agents').first()).toBeVisible({ timeout: 3000 })
  await expect(page.getByTestId('agent-card-sidekick')).toContainText('working')
  await expect(page.getByTestId('agent-card-pm')).toContainText('working')
  expect(snapshotRequests).toEqual(['/api/openclaw/snapshot?fresh=cold-start-bootstrap'])
})
