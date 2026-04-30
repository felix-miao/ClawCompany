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
  await expect(page.getByText('Connected')).toBeVisible()
  await expect(page.getByText('OpenClaw: Live')).toBeVisible()
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
