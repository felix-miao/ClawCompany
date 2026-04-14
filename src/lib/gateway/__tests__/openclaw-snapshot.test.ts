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
})
