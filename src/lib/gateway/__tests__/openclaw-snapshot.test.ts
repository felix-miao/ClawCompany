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

  it('classifies .tsx files as code type', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-tsx',
        agentId: 'dev-claw',
        label: '实现组件',
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
      { role: 'assistant', content: '开始实现组件', status: 'running' },
      { role: 'toolResult', content: '已写入文件: /Users/felixmiao/Projects/ClawCompany/src/app/hello/page.tsx', status: 'completed' },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(snapshot.sessions[0].artifacts).toHaveLength(1)
    expect(snapshot.sessions[0].artifacts[0]).toMatchObject({
      type: 'tsx',
      path: '/Users/felixmiao/Projects/ClawCompany/src/app/hello/page.tsx',
      title: 'page.tsx',
    })
  })

  it('uses message.timestamp as producedAt for artifacts', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-time',
        agentId: 'dev-claw',
        label: 'Test timestamps',
        model: 'gpt-5',
        status: 'running',
        startedAt: '2026-04-14T02:00:00Z',
        endedAt: null,
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
    ])
    const artifactTime = '2026-04-14T03:00:00Z'
    sync.client.sessions_history.mockResolvedValue([
      { role: 'assistant', content: 'Creating file', status: 'running' },
      { role: 'toolResult', content: '已写入文件: /Users/test/output.html', status: 'completed', timestamp: artifactTime },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(snapshot.sessions[0].artifacts[0].producedAt).toBe(artifactTime)
  })

  it('derives finalDeliveryArtifacts from completed session (last write per path)', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-final',
        agentId: 'dev-claw',
        label: 'Final delivery test',
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-04-14T02:00:00Z',
        endedAt: '2026-04-14T02:30:00Z',
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
    ])
    const firstWrite = '2026-04-14T02:10:00Z'
    const secondWrite = '2026-04-14T02:20:00Z'
    const finalWrite = '2026-04-14T02:25:00Z'
    sync.client.sessions_history.mockResolvedValue([
      { role: 'assistant', content: 'Start', status: 'running' },
      { role: 'toolResult', content: '已写入文件: /Users/test/index.html', status: 'completed', timestamp: firstWrite },
      { role: 'assistant', content: 'Update', status: 'running' },
      { role: 'toolResult', content: '已写入文件: /Users/test/index.html', status: 'completed', timestamp: secondWrite },
      { role: 'assistant', content: 'Final update', status: 'completed' },
      { role: 'toolResult', content: '已写入文件: /Users/test/styles.css', status: 'completed', timestamp: finalWrite },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(snapshot.sessions[0].finalDeliveryArtifacts).toHaveLength(2)
    const finalPaths = snapshot.sessions[0].finalDeliveryArtifacts.map(a => a.path).sort()
    expect(finalPaths).toEqual([
      '/Users/test/index.html',
      '/Users/test/styles.css',
    ])
    const indexArtifact = snapshot.sessions[0].finalDeliveryArtifacts.find(a => a.path === '/Users/test/index.html')
    expect(indexArtifact?.producedAt).toBe(secondWrite)
  })

  it('marks isFinal=true only for last write per path in completed session', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-final-flag',
        agentId: 'dev-claw',
        label: 'Final flag test',
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-04-14T02:00:00Z',
        endedAt: '2026-04-14T02:30:00Z',
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
    ])
    const firstWrite = '2026-04-14T02:10:00Z'
    const finalWrite = '2026-04-14T02:20:00Z'
    sync.client.sessions_history.mockResolvedValue([
      { role: 'toolResult', content: '已写入文件: /Users/test/page.tsx', status: 'completed', timestamp: firstWrite },
      { role: 'toolResult', content: '已写入文件: /Users/test/page.tsx', status: 'completed', timestamp: finalWrite },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(snapshot.sessions[0].artifacts).toHaveLength(1)
    expect(snapshot.sessions[0].artifacts[0].isFinal).toBe(true)
    expect(snapshot.sessions[0].artifacts[0].producedAt).toBe(finalWrite)
  })

  it('classifies test report files correctly', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'tester-claw', name: 'Tester', identity: { name: 'Tester Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-test',
        agentId: 'tester-claw',
        label: '运行测试',
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-04-14T02:00:00Z',
        endedAt: '2026-04-14T02:30:00Z',
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'tester-claw', name: 'Tester Claw', role: 'tester', status: 'idle', emotion: 'neutral', currentTask: null },
    ])
    sync.client.sessions_history.mockResolvedValue([
      { role: 'assistant', content: '开始测试', status: 'running' },
      { role: 'toolResult', content: '已写入文件: /Users/felixmiao/Projects/ClawCompany/generated/test-report.html', status: 'completed' },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(snapshot.sessions[0].artifacts).toHaveLength(1)
    expect(snapshot.sessions[0].artifacts[0]).toMatchObject({
      type: 'test-report',
      path: '/Users/felixmiao/Projects/ClawCompany/generated/test-report.html',
      title: 'test-report.html',
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

    it('derives timeline with real events from session history instead of phase skeleton', async () => {
      const sync = createSyncStub()

      const now = Date.now()
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString()

      sync.fetchAgents.mockResolvedValue([
        { id: 'pm-claw', name: 'PM', identity: { name: 'PM Claw' } },
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-pm',
          agentId: 'pm-claw',
          label: '分析需求',
          model: 'gpt-5',
          status: 'running',
          startedAt: fiveMinutesAgo,
          endedAt: null,
        },
        {
          key: 'sess-dev',
          agentId: 'dev-claw',
          label: '实现功能',
          model: 'gpt-5',
          status: 'running',
          startedAt: fiveMinutesAgo,
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'pm-claw', name: 'PM Claw', role: 'pm', status: 'busy', emotion: 'neutral', currentTask: null },
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValueOnce([
        { role: 'assistant', content: 'PM 开始分析需求', status: 'running', timestamp: fiveMinutesAgo },
        { role: 'toolResult', content: '已生成任务拆分文档', status: 'completed', timestamp: new Date(now - 3 * 60 * 1000).toISOString() },
        { role: 'assistant', content: 'PM 完成分析', status: 'completed', timestamp: new Date(now - 1 * 60 * 1000).toISOString() },
      ]).mockResolvedValueOnce([
        { role: 'assistant', content: 'Dev 开始实现', status: 'running', timestamp: fiveMinutesAgo },
        { role: 'toolResult', content: '已写入文件: /generated/feature.ts', status: 'completed', timestamp: new Date(now - 2 * 60 * 1000).toISOString() },
        { role: 'assistant', content: '正在测试', status: 'running', timestamp: new Date(now - 30 * 1000).toISOString() },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.tasks).toHaveLength(2)

      const pmTask = snapshot.tasks.find(t => t.taskId === 'sess-pm')
      expect(pmTask).toBeDefined()
      expect(pmTask?.currentAgentId).toBe('pm-claw')
      expect(pmTask?.currentAgentName).toBe('PM Claw')
      expect(pmTask?.description).toBe('分析需求')

      const devTask = snapshot.tasks.find(t => t.taskId === 'sess-dev')
      expect(devTask).toBeDefined()
      expect(devTask?.currentAgentId).toBe('dev-claw')
      expect(devTask?.currentAgentName).toBe('Dev Claw')
    })

    it('timeline shows latest output summary and exact update time from session history', async () => {
      const sync = createSyncStub()

      const now = Date.now()
      const startTime = new Date(now - 10 * 60 * 1000).toISOString()
      const lastUpdateTime = new Date(now - 30 * 1000).toISOString()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-output',
          agentId: 'dev-claw',
          label: '实现功能',
          model: 'gpt-5',
          status: 'running',
          startedAt: startTime,
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'assistant', content: '开始开发', status: 'running', timestamp: startTime },
        { role: 'toolResult', content: '已写入文件: /projects/app.tsx', status: 'completed', timestamp: new Date(now - 5 * 60 * 1000).toISOString() },
        { role: 'toolResult', content: '已写入文件: /projects/utils.ts', status: 'completed', timestamp: lastUpdateTime },
        { role: 'assistant', content: '正在验证功能', status: 'running', timestamp: lastUpdateTime },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      const task = snapshot.tasks[0]
      expect(task.updatedAt).toBe(Date.parse(lastUpdateTime))
      expect(task.latestResultSummary).toBe('已写入文件: /projects/utils.ts')
      expect(task.currentAgentName).toBe('Dev Claw')
    })

    it('derives timeline recentEvents from timestamped session history with session trace metadata', async () => {
      const sync = createSyncStub()

      const startTime = '2026-04-14T06:00:00Z'
      const progressTime = '2026-04-14T06:02:00Z'
      const handoverTime = '2026-04-14T06:03:00Z'
      const resultTime = '2026-04-14T06:05:00Z'

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-history',
          agentId: 'dev-claw',
          label: '实现 timeline 映射',
          model: 'gpt-5',
          status: 'completed',
          startedAt: startTime,
          endedAt: resultTime,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'assistant', content: '正在实现真实 timeline', status: 'running', timestamp: progressTime },
        { role: 'assistant', content: '交接给 review-claw 做最终验证', status: 'running', timestamp: handoverTime },
        { role: 'toolResult', content: '已写入文件: /projects/src/lib/gateway/openclaw-snapshot.ts', status: 'completed', timestamp: resultTime },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      const task = snapshot.tasks[0]
      expect(task.updatedAt).toBe(Date.parse(resultTime))
      expect(task.currentAgentId).toBe('dev-claw')
      expect(task.currentAgentName).toBe('Dev Claw')
      expect(task.recentEvents).toEqual([
        expect.objectContaining({
          type: 'task:progress',
          taskId: 'sess-history',
          agentId: 'dev-claw',
          timestamp: Date.parse(progressTime),
        }),
        expect.objectContaining({
          type: 'task:handover',
          taskId: 'sess-history',
          fromAgentId: 'dev-claw',
          toAgentId: 'reviewer',
          timestamp: Date.parse(handoverTime),
        }),
        expect.objectContaining({
          type: 'task:completed',
          taskId: 'sess-history',
          agentId: 'dev-claw',
          timestamp: Date.parse(resultTime),
        }),
      ])
    })

    it('falls back to endedAt for timeline update time when history messages have no timestamps', async () => {
      const sync = createSyncStub()

      const startTime = '2026-04-14T07:00:00Z'
      const endTime = '2026-04-14T07:12:00Z'

      sync.fetchAgents.mockResolvedValue([
        { id: 'pm-claw', name: 'PM', identity: { name: 'PM Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-ended-at',
          agentId: 'pm-claw',
          label: '整理需求',
          model: 'gpt-5',
          status: 'completed',
          startedAt: startTime,
          endedAt: endTime,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'pm-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'assistant', content: '需求已整理完成', status: 'completed' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.tasks[0].updatedAt).toBe(Date.parse(endTime))
      expect(snapshot.tasks[0].currentAgentName).toBe('PM Claw')
    })

    it('timeline task displays sessionKey for debugging', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'pm-claw', name: 'PM', identity: { name: 'PM Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'session-abc123',
          agentId: 'pm-claw',
          label: '测试任务',
          model: 'gpt-5',
          status: 'completed',
          startedAt: '2026-04-14T00:00:00Z',
          endedAt: '2026-04-14T00:10:00Z',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'pm-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'assistant', content: '任务完成', status: 'completed', timestamp: '2026-04-14T00:10:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      const task = snapshot.tasks[0]
      expect(task.taskId).toBe('session-abc123')
      expect(task.description).toBe('测试任务')
    })
  })

  describe('structured event feed', () => {
    it('derives event feed with tool events from toolResult messages', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-events',
          agentId: 'dev-claw',
          label: 'Test event feed',
          model: 'gpt-5',
          status: 'running',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'toolResult', content: '已写入文件: /test/index.html', status: 'completed', timestamp: '2026-04-14T10:01:00Z' },
        { role: 'toolResult', content: 'Running bash command', status: 'completed', timestamp: '2026-04-14T10:02:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].eventFeed).toBeDefined()
      expect(snapshot.sessions[0].eventFeed.totalCount).toBeGreaterThan(0)
      expect(snapshot.sessions[0].eventFeed.byType['tool:completed']).toBeGreaterThan(0)
      expect(snapshot.sessions[0].eventFeed.events.some(e => e.toolName === 'write')).toBe(true)
      expect(snapshot.sessions[0].eventFeed.events.some(e => e.toolName === 'bash')).toBe(true)
    })

    it('derives file:created events with artifact metadata from file write outputs', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-files',
          agentId: 'dev-claw',
          label: 'Test file events',
          model: 'gpt-5',
          status: 'running',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'toolResult', content: '已写入文件: /test/component.tsx', status: 'completed', timestamp: '2026-04-14T10:01:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      const fileEvent = snapshot.sessions[0].eventFeed.events.find(e => e.type === 'file:created')
      expect(fileEvent).toBeDefined()
      expect(fileEvent?.filePaths).toContain('/test/component.tsx')
      expect(fileEvent?.artifactType).toBe('tsx')
    })

    it('derives artifact:produced event for url artifacts', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-url',
          agentId: 'dev-claw',
          label: 'Test URL events',
          model: 'gpt-5',
          status: 'running',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'toolResult', content: 'Deployed to: https://example.com/app', status: 'completed', timestamp: '2026-04-14T10:01:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      const artifactEvent = snapshot.sessions[0].eventFeed.events.find(e => e.type === 'artifact:produced')
      expect(artifactEvent).toBeDefined()
      expect(artifactEvent?.filePaths).toContain('https://example.com/app')
    })

    it('derives session:handover event when handover pattern is detected', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-handover',
          agentId: 'dev-claw',
          label: 'Test handover',
          model: 'gpt-5',
          status: 'running',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'assistant', content: '交接给 reviewer 进行代码审查', status: 'completed', timestamp: '2026-04-14T10:01:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      const handoverEvent = snapshot.sessions[0].eventFeed.events.find(e => e.type === 'session:handover')
      expect(handoverEvent).toBeDefined()
      expect(handoverEvent?.metadata?.handoverTarget).toBe('reviewer')
    })

    it('derives tool:failed and session:failed events from failed toolResult', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-failed',
          agentId: 'dev-claw',
          label: 'Test failure',
          model: 'gpt-5',
          status: 'failed',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: '2026-04-14T10:05:00Z',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'toolResult', content: 'Command failed: npm run build', status: 'failed', timestamp: '2026-04-14T10:05:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].eventFeed.byType['tool:failed']).toBe(1)
      expect(snapshot.sessions[0].eventFeed.byType['session:failed']).toBe(1)
    })

    it('derives session:completed event for completed sessions', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'pm-claw', name: 'PM', identity: { name: 'PM Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-done',
          agentId: 'pm-claw',
          label: 'Completed task',
          model: 'gpt-5',
          status: 'completed',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: '2026-04-14T10:30:00Z',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'pm-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'assistant', content: '任务完成', status: 'completed', timestamp: '2026-04-14T10:30:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].eventFeed.byType['session:completed']).toBe(1)
    })

    it('includes message:sent and message:received events in event feed', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-messages',
          agentId: 'dev-claw',
          label: 'Test messages',
          model: 'gpt-5',
          status: 'running',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'user', content: '帮我写一个组件', status: 'completed', timestamp: '2026-04-14T10:01:00Z' },
        { role: 'assistant', content: '好的，我来帮你实现', status: 'completed', timestamp: '2026-04-14T10:01:30Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].eventFeed.byType['message:sent']).toBe(1)
      expect(snapshot.sessions[0].eventFeed.byType['message:received']).toBe(1)
    })

    it('provides summary field in each event for dashboard display', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-summary',
          agentId: 'dev-claw',
          label: 'Test summary',
          model: 'gpt-5',
          status: 'running',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'toolResult', content: '已写入文件: /test/example.tsx', status: 'completed', timestamp: '2026-04-14T10:01:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      for (const event of snapshot.sessions[0].eventFeed.events) {
        expect(event.summary).toBeDefined()
        expect(typeof event.summary).toBe('string')
        expect(event.summary.length).toBeGreaterThan(0)
      }
    })

    it('populates byType counts correctly in event feed', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-counts',
          agentId: 'dev-claw',
          label: 'Test counts',
          model: 'gpt-5',
          status: 'completed',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: '2026-04-14T10:30:00Z',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'toolResult', content: '已写入文件: /test/a.tsx', status: 'completed', timestamp: '2026-04-14T10:10:00Z' },
        { role: 'toolResult', content: '已写入文件: /test/b.tsx', status: 'completed', timestamp: '2026-04-14T10:20:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].eventFeed.totalCount).toBe(snapshot.sessions[0].eventFeed.events.length)
      expect(snapshot.sessions[0].eventFeed.byType['tool:completed']).toBe(2)
      expect(snapshot.sessions[0].eventFeed.byType['session:completed']).toBe(1)
    })
  })
})
