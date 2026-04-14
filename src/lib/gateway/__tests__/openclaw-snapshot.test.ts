import { buildOpenClawSnapshot } from '../openclaw-snapshot'

describe('buildOpenClawSnapshot', () => {
  function createSyncStub() {
    const client = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      sessions_history: jest.fn(),
    }

    return {
      client,
      fetchAgents: jest.fn(),
      fetchSessions: jest.fn(),
      mapToAgentInfo: jest.fn(),
    }
  }

  it('builds stable session details and task history from sessionKey without falling back', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'sidekick-claw', name: 'PM', identity: { name: 'PM Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-1',
        agentId: 'sidekick-claw',
        label: '用你的团队给我写一个网站出来',
        model: 'gpt-5',
        status: 'running',
        startedAt: '2026-04-14T00:00:00Z',
        endedAt: null,
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'busy', emotion: 'neutral', currentTask: null },
    ])
    sync.client.sessions_history.mockResolvedValue([
      { role: 'assistant', content: '已收到，PM 正在分析...', status: 'running' },
      { role: 'toolResult', content: '已生成初始任务拆分', status: 'completed' },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(sync.client.connect).toHaveBeenCalledTimes(1)
    expect(sync.client.disconnect).toHaveBeenCalledTimes(1)
    expect(snapshot.connected).toBe(true)
    expect(snapshot.agents[0]).toMatchObject({
      id: 'sidekick-claw',
      status: 'working',
      currentTask: '用你的团队给我写一个网站出来',
    })
    expect(snapshot.sessions[0]).toMatchObject({
      sessionKey: 'sess-1',
      agentId: 'sidekick-claw',
      agentName: 'PM Claw',
      role: 'pm',
      currentWork: '用你的团队给我写一个网站出来',
      latestThought: '已收到，PM 正在分析...',
      latestResultSummary: '已生成初始任务拆分',
    })
    expect(snapshot.tasks[0]).toMatchObject({
      taskId: 'sess-1',
      description: '用你的团队给我写一个网站出来',
      currentAgentId: 'sidekick-claw',
      currentAgentName: 'PM Claw',
      status: 'in_progress',
    })
  })

  it('prefers the latest assistant and toolResult messages when deriving summaries', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-2',
        agentId: 'dev-claw',
        label: '实现 snapshot 数据模型增强',
        model: 'gpt-5',
        status: 'running',
        startedAt: '2026-04-14T01:00:00Z',
        endedAt: null,
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
    ])
    sync.client.sessions_history.mockResolvedValue([
      { role: 'assistant', content: '旧的分析', status: 'running' },
      { role: 'toolResult', content: '旧的工具输出', status: 'completed' },
      { role: 'assistant', content: '最新思路：先统一 snapshot 真相源', status: 'running' },
      { role: 'toolResult', content: '最新结果：route test 已修复', status: 'completed' },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(snapshot.sessions[0]).toMatchObject({
      latestThought: '最新思路：先统一 snapshot 真相源',
      latestResultSummary: '最新结果：route test 已修复',
      latestMessage: '最新结果：route test 已修复',
      latestMessageRole: 'toolResult',
      latestMessageStatus: 'completed',
    })
  })

  it('derives artifacts from toolResult messages containing file outputs', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-3',
        agentId: 'dev-claw',
        label: '实现首页组件',
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-04-14T02:00:00Z',
        endedAt: '2026-04-14T02:30:00Z',
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
    ])
    sync.client.sessions_history.mockResolvedValue([
      { role: 'assistant', content: '开始实现首页', status: 'running' },
      { role: 'toolResult', content: '已写入文件: /Users/felixmiao/Projects/ClawCompany/generated/index.html', status: 'completed' },
      { role: 'toolResult', content: '已写入样式: /Users/felixmiao/Projects/ClawCompany/generated/styles.css', status: 'completed' },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(snapshot.sessions[0].artifacts).toHaveLength(2)
    expect(snapshot.sessions[0].artifacts[0]).toMatchObject({
      type: 'html',
      path: '/Users/felixmiao/Projects/ClawCompany/generated/index.html',
      title: 'index.html',
      producedBy: 'dev-claw',
    })
    expect(snapshot.sessions[0].artifacts[1]).toMatchObject({
      type: 'code',
      path: '/Users/felixmiao/Projects/ClawCompany/generated/styles.css',
      title: 'styles.css',
    })
  })

  it('handles history with no file artifacts gracefully', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'pm-claw', name: 'PM', identity: { name: 'PM Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-4',
        agentId: 'pm-claw',
        label: '分析需求',
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-04-14T03:00:00Z',
        endedAt: '2026-04-14T03:10:00Z',
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'pm-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
    ])
    sync.client.sessions_history.mockResolvedValue([
      { role: 'assistant', content: '已完成需求分析', status: 'completed' },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(snapshot.sessions[0].artifacts).toHaveLength(0)
  })

  describe('session classification', () => {
    it('classifies running session as running', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-running',
          agentId: 'dev-claw',
          label: 'Running task',
          model: 'gpt-5',
          status: 'running',
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].category).toBe('running')
    })

    it('classifies failed session as failed', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-failed',
          agentId: 'dev-claw',
          label: 'Failed task',
          model: 'gpt-5',
          status: 'failed',
          startedAt: '2026-04-14T04:00:00Z',
          endedAt: '2026-04-14T04:05:00Z',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].category).toBe('failed')
    })

    it('classifies recently completed session (within 5min) as just-completed', async () => {
      const sync = createSyncStub()

      const now = new Date()
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-recent',
          agentId: 'dev-claw',
          label: 'Recent task',
          model: 'gpt-5',
          status: 'completed',
          startedAt: '2026-04-14T05:00:00Z',
          endedAt: twoMinutesAgo,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].category).toBe('just-completed')
    })

    it('classifies older completed session as completed', async () => {
      const sync = createSyncStub()

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-old',
          agentId: 'dev-claw',
          label: 'Old task',
          model: 'gpt-5',
          status: 'completed',
          startedAt: '2026-04-14T06:00:00Z',
          endedAt: tenMinutesAgo,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].category).toBe('completed')
    })

    it('classifies long-running session without recent activity as stuck', async () => {
      const sync = createSyncStub()

      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-stuck',
          agentId: 'dev-claw',
          label: 'Stuck task',
          model: 'gpt-5',
          status: 'running',
          startedAt: fifteenMinutesAgo,
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].category).toBe('stuck')
    })
  })
})
