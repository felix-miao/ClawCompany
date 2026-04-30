import { buildOpenClawSnapshot } from '../openclaw-snapshot'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

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

  function writeJsonlMessage(filePath: string, content: string): void {
    fs.writeFileSync(filePath, JSON.stringify({
      type: 'message',
      id: `msg-${path.basename(filePath)}`,
      timestamp: '2026-04-30T06:00:00Z',
      message: { role: 'assistant', content: [{ type: 'text', text: content }] },
    }))
  }

  function restoreOpenClawStateDir(originalOpenClawStateDir: string | undefined): void {
    if (originalOpenClawStateDir) process.env.OPENCLAW_STATE_DIR = originalOpenClawStateDir
    else delete process.env.OPENCLAW_STATE_DIR
  }

  function setupLocalFallbackSync(sync: ReturnType<typeof createSyncStub>, session: Record<string, unknown>): void {
    sync.fetchAgents.mockResolvedValue([
      { id: 'developer', name: 'Developer', identity: { name: 'Developer' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'agent:developer:main',
        agentId: 'developer',
        label: 'agent:developer:main',
        model: 'gpt-5.5',
        status: 'running',
        startedAt: '2026-04-30T06:00:00Z',
        endedAt: null,
        ...session,
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'developer', name: 'Developer', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
    ])
    sync.client.sessions_history.mockResolvedValue([])
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
      agentSnapshots: {
        'sidekick-claw': {
          id: 'sidekick-claw',
          name: 'PM Claw',
          role: 'pm',
          status: 'busy',
          emotion: 'neutral',
          currentTask: '用你的团队给我写一个网站出来',
          latestResultSummary: '已生成初始任务拆分',
        },
      },
    })
  })

  it('maps an active OpenClaw session into active agent, timeline, inspector data, and artifacts', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'sess-live-dev',
        agentId: 'dev-claw',
        label: 'Dashboard live fixture session',
        model: 'gpt-5.5',
        status: 'running',
        startedAt: new Date().toISOString(),
        endedAt: null,
        usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
    ])
    sync.client.sessions_history.mockResolvedValue([
      {
        role: 'user',
        content: 'Run dashboard live acceptance fixture',
        status: 'completed',
        timestamp: '2026-04-30T02:45:01Z',
      },
      {
        role: 'assistant',
        content: 'Implementing dashboard live active session timeline',
        status: 'running',
        timestamp: '2026-04-30T02:45:02Z',
      },
      {
        role: 'toolResult',
        content: '已写入文件: /tmp/claw-company-live/dashboard-live.html',
        status: 'completed',
        timestamp: '2026-04-30T02:45:03Z',
        tool: { name: 'write', rawName: 'write', success: true },
        files: [{ paths: ['/tmp/claw-company-live/dashboard-live.html'], operation: 'write' }],
        artifacts: [{ paths: ['/tmp/claw-company-live/dashboard-live.html'], type: 'html' }],
      },
    ])

    const snapshot = await buildOpenClawSnapshot(sync as any)

    expect(snapshot.connected).toBe(true)
    expect(snapshot.metrics.sessions.active).toBe(1)
    expect(snapshot.metrics.agents.active).toBe(1)
    expect(snapshot.agents[0]).toMatchObject({
      id: 'dev-claw',
      status: 'working',
      currentTask: 'Dashboard live fixture session',
    })
    expect(snapshot.sessions[0]).toMatchObject({
      sessionKey: 'sess-live-dev',
      category: 'running',
      currentWork: 'Dashboard live fixture session',
      latestThought: 'Implementing dashboard live active session timeline',
      latestResultSummary: '已写入文件: /tmp/claw-company-live/dashboard-live.html',
    })
    expect(snapshot.sessions[0].history).toHaveLength(3)
    expect(snapshot.sessions[0].artifacts).toEqual([
      expect.objectContaining({
        type: 'html',
        path: '/tmp/claw-company-live/dashboard-live.html',
        title: 'dashboard-live.html',
        producedBy: 'dev-claw',
        producedAt: '2026-04-30T02:45:03Z',
      }),
    ])
    expect(snapshot.sessions[0].eventFeed.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'message:received', sessionKey: 'sess-live-dev' }),
      expect.objectContaining({ type: 'tool:completed', sessionKey: 'sess-live-dev' }),
      expect.objectContaining({ type: 'artifact:produced', sessionKey: 'sess-live-dev' }),
    ]))
    expect(snapshot.tasks[0]).toMatchObject({
      taskId: 'sess-live-dev',
      status: 'in_progress',
      currentAgentId: 'dev-claw',
      currentAgentName: 'Dev Claw',
      latestResultSummary: '已写入文件: /tmp/claw-company-live/dashboard-live.html',
    })
    expect(snapshot.tasks[0].recentEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'task:progress',
        taskId: 'sess-live-dev',
        currentAction: 'Implementing dashboard live active session timeline',
      }),
      expect.objectContaining({
        type: 'task:completed',
        taskId: 'sess-live-dev',
      }),
    ]))
  })

  it('keeps task agent snapshots isolated per task and canonicalizes agent ids', async () => {
    const sync = createSyncStub()

    sync.fetchAgents.mockResolvedValue([
      { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      { id: 'reviewer-claw', name: 'Reviewer', identity: { name: 'Reviewer Claw' } },
    ])
    sync.fetchSessions.mockResolvedValue([
      {
        key: 'task-a',
        agentId: 'dev-agent',
        label: 'Task A',
        model: 'gpt-5',
        status: 'running',
        startedAt: '2026-04-14T00:00:00Z',
        endedAt: null,
      },
      {
        key: 'task-b',
        agentId: 'review-agent',
        label: 'Task B',
        model: 'gpt-5',
        status: 'running',
        startedAt: '2026-04-14T00:01:00Z',
        endedAt: null,
      },
    ])
    sync.mapToAgentInfo.mockReturnValue([
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      { id: 'reviewer-claw', name: 'Reviewer Claw', role: 'review', status: 'busy', emotion: 'neutral', currentTask: null },
    ])
    sync.client.sessions_history.mockImplementation(async (sessionKey: string) => {
      if (sessionKey === 'task-a') {
        return [{ role: 'assistant', content: 'Task A', status: 'running' }]
      }
      return [{ role: 'assistant', content: 'Task B', status: 'running' }]
    })

    const snapshot = await buildOpenClawSnapshot(sync as any)

    const taskA = snapshot.tasks.find(task => task.taskId === 'task-a')
    const taskB = snapshot.tasks.find(task => task.taskId === 'task-b')

    expect(taskA?.agentSnapshots?.['dev-claw']?.name).toBe('Dev Claw')
    expect(taskA?.agentSnapshots?.['reviewer-claw']).toBeUndefined()
    expect(taskB?.agentSnapshots?.['reviewer-claw']?.name).toBe('Reviewer Claw')
    expect(taskB?.agentSnapshots?.['dev-claw']).toBeUndefined()
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

  it('falls back to local OpenClaw jsonl history when gateway history is empty', async () => {
    const sync = createSyncStub()
    const openClawRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-snapshot-'))
    const originalOpenClawStateDir = process.env.OPENCLAW_STATE_DIR

    process.env.OPENCLAW_STATE_DIR = openClawRoot

    const sessionDir = path.join(openClawRoot, 'agents', 'developer', 'sessions')
    fs.mkdirSync(sessionDir, { recursive: true })
    const transcriptPath = path.join(sessionDir, 'local-session.jsonl')
    fs.writeFileSync(transcriptPath, [
      JSON.stringify({
        type: 'session',
        id: 'local-session',
        timestamp: '2026-04-30T04:40:00Z',
      }),
      JSON.stringify({
        type: 'message',
        id: 'msg-user',
        timestamp: '2026-04-30T04:40:01Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: '请实现 dashboard history fallback' }],
          timestamp: 1777524001000,
        },
      }),
      JSON.stringify({
        type: 'message',
        id: 'msg-assistant',
        parentId: 'msg-user',
        timestamp: '2026-04-30T04:40:02Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: '定位 snapshot history fallback' },
            { type: 'text', text: '正在读取本地 OpenClaw session jsonl' },
          ],
          timestamp: 1777524002000,
        },
      }),
      JSON.stringify({
        type: 'message',
        id: 'msg-tool',
        parentId: 'msg-assistant',
        timestamp: '2026-04-30T04:40:03Z',
        message: {
          role: 'toolResult',
          toolName: 'write',
          content: [{ type: 'text', text: 'Successfully wrote 42 bytes to /tmp/openclaw-fallback/report.html' }],
          isError: false,
          timestamp: 1777524003000,
        },
      }),
    ].join('\n'))

    try {
      sync.fetchAgents.mockResolvedValue([
        { id: 'developer', name: 'Developer', identity: { name: 'Developer' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'agent:developer:main',
          agentId: 'developer',
          label: 'agent:developer:main',
          model: 'gpt-5.5',
          status: 'running',
          startedAt: '2026-04-30T04:40:00Z',
          endedAt: null,
          transcriptPath,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'developer', name: 'Developer', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].history).toHaveLength(3)
      expect(snapshot.sessions[0]).toMatchObject({
        latestThought: '定位 snapshot history fallback\n正在读取本地 OpenClaw session jsonl',
        latestResultSummary: 'Successfully wrote 42 bytes to /tmp/openclaw-fallback/report.html',
      })
      expect(snapshot.sessions[0].artifacts).toEqual([
        expect.objectContaining({
          type: 'html',
          path: '/tmp/openclaw-fallback/report.html',
          producedBy: 'developer',
          producedAt: '2026-04-30T04:40:03.000Z',
        }),
      ])
      expect(snapshot.sessions[0].eventFeed.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'message:received', sessionKey: 'agent:developer:main' }),
        expect.objectContaining({ type: 'tool:completed', sessionKey: 'agent:developer:main' }),
        expect.objectContaining({ type: 'artifact:produced', sessionKey: 'agent:developer:main' }),
      ]))
      expect(snapshot.tasks[0].recentEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'task:progress',
          taskId: 'agent:developer:main',
          currentAction: '定位 snapshot history fallback 正在读取本地 OpenClaw session jsonl',
        }),
        expect.objectContaining({
          type: 'task:completed',
          taskId: 'agent:developer:main',
          result: 'success',
        }),
      ]))
    } finally {
      if (originalOpenClawStateDir) process.env.OPENCLAW_STATE_DIR = originalOpenClawStateDir
      else delete process.env.OPENCLAW_STATE_DIR
      fs.rmSync(openClawRoot, { recursive: true, force: true })
    }
  })

  it('rejects malicious transcriptPath outside the OpenClaw agent sessions directory', async () => {
    const sync = createSyncStub()
    const openClawRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-snapshot-'))
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-outside-'))
    const originalOpenClawStateDir = process.env.OPENCLAW_STATE_DIR
    const maliciousTranscriptPath = path.join(outsideDir, 'secret.jsonl')

    process.env.OPENCLAW_STATE_DIR = openClawRoot
    writeJsonlMessage(maliciousTranscriptPath, 'LEAKED_TRANSCRIPT_SECRET')

    try {
      setupLocalFallbackSync(sync, { transcriptPath: maliciousTranscriptPath })

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].history).toEqual([])
      expect(snapshot.sessions[0].latestThought).toBeNull()
      expect(snapshot.sessions[0].eventFeed.events).toEqual([])
      expect(JSON.stringify(snapshot)).not.toContain('LEAKED_TRANSCRIPT_SECRET')
    } finally {
      restoreOpenClawStateDir(originalOpenClawStateDir)
      fs.rmSync(openClawRoot, { recursive: true, force: true })
      fs.rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('rejects malicious sessionFile outside the OpenClaw agent sessions directory', async () => {
    const sync = createSyncStub()
    const openClawRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-snapshot-'))
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-outside-'))
    const originalOpenClawStateDir = process.env.OPENCLAW_STATE_DIR
    const maliciousSessionFile = path.join(outsideDir, 'secret.jsonl')

    process.env.OPENCLAW_STATE_DIR = openClawRoot
    writeJsonlMessage(maliciousSessionFile, 'LEAKED_SESSION_FILE_SECRET')

    try {
      setupLocalFallbackSync(sync, { sessionFile: maliciousSessionFile })

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].history).toEqual([])
      expect(snapshot.sessions[0].eventFeed.events).toEqual([])
      expect(JSON.stringify(snapshot)).not.toContain('LEAKED_SESSION_FILE_SECRET')
    } finally {
      restoreOpenClawStateDir(originalOpenClawStateDir)
      fs.rmSync(openClawRoot, { recursive: true, force: true })
      fs.rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('does not use path traversal agentId values when discovering local jsonl', async () => {
    const sync = createSyncStub()
    const openClawRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-snapshot-'))
    const originalOpenClawStateDir = process.env.OPENCLAW_STATE_DIR
    const traversalSessionDir = path.join(openClawRoot, 'sessions')
    const traversalPath = path.join(traversalSessionDir, 'traversal.jsonl')

    process.env.OPENCLAW_STATE_DIR = openClawRoot
    fs.mkdirSync(traversalSessionDir, { recursive: true })
    writeJsonlMessage(traversalPath, 'LEAKED_AGENT_TRAVERSAL_SECRET')

    try {
      sync.fetchAgents.mockResolvedValue([
        { id: '../..', name: 'Malicious', identity: { name: 'Malicious' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'agent:developer:main',
          agentId: '../..',
          label: 'agent:developer:main',
          model: 'gpt-5.5',
          status: 'running',
          startedAt: '2026-04-30T06:00:00Z',
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: '../..', name: 'Malicious', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].history).toEqual([])
      expect(snapshot.sessions[0].eventFeed.events).toEqual([])
      expect(JSON.stringify(snapshot)).not.toContain('LEAKED_AGENT_TRAVERSAL_SECRET')
    } finally {
      restoreOpenClawStateDir(originalOpenClawStateDir)
      fs.rmSync(openClawRoot, { recursive: true, force: true })
    }
  })

  it('reads a local jsonl path from the OpenClaw session store when it stays under the matching agent sessions directory', async () => {
    const sync = createSyncStub()
    const openClawRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-snapshot-'))
    const originalOpenClawStateDir = process.env.OPENCLAW_STATE_DIR
    const sessionDir = path.join(openClawRoot, 'agents', 'developer', 'sessions')
    const storeTranscriptPath = path.join(sessionDir, 'store-session.jsonl')

    process.env.OPENCLAW_STATE_DIR = openClawRoot
    fs.mkdirSync(sessionDir, { recursive: true })
    writeJsonlMessage(storeTranscriptPath, 'SAFE_STORE_HISTORY')
    fs.writeFileSync(path.join(sessionDir, 'sessions.json'), JSON.stringify({
      'agent:developer:main': { transcriptPath: storeTranscriptPath },
    }))

    try {
      setupLocalFallbackSync(sync, {})

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].history).toEqual([
        expect.objectContaining({ role: 'assistant', content: 'SAFE_STORE_HISTORY' }),
      ])
      expect(snapshot.sessions[0].latestThought).toBe('SAFE_STORE_HISTORY')
      expect(snapshot.sessions[0].eventFeed.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'message:received', sessionKey: 'agent:developer:main' }),
      ]))
    } finally {
      restoreOpenClawStateDir(originalOpenClawStateDir)
      fs.rmSync(openClawRoot, { recursive: true, force: true })
    }
  })

  it('rejects symlinked jsonl paths that realpath outside the OpenClaw agent sessions directory', async () => {
    const sync = createSyncStub()
    const openClawRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-snapshot-'))
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-outside-'))
    const originalOpenClawStateDir = process.env.OPENCLAW_STATE_DIR
    const sessionDir = path.join(openClawRoot, 'agents', 'developer', 'sessions')
    const outsideTarget = path.join(outsideDir, 'symlink-secret.jsonl')
    const symlinkPath = path.join(sessionDir, 'symlink-secret.jsonl')

    process.env.OPENCLAW_STATE_DIR = openClawRoot
    fs.mkdirSync(sessionDir, { recursive: true })
    writeJsonlMessage(outsideTarget, 'LEAKED_SYMLINK_SECRET')
    fs.symlinkSync(outsideTarget, symlinkPath)

    try {
      setupLocalFallbackSync(sync, { transcriptPath: symlinkPath })

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].history).toEqual([])
      expect(snapshot.sessions[0].eventFeed.events).toEqual([])
      expect(JSON.stringify(snapshot)).not.toContain('LEAKED_SYMLINK_SECRET')
    } finally {
      restoreOpenClawStateDir(originalOpenClawStateDir)
      fs.rmSync(openClawRoot, { recursive: true, force: true })
      fs.rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('discovers the latest agent jsonl when status only exposes a stale sessionId', async () => {
    const sync = createSyncStub()
    const openClawRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-snapshot-'))
    const originalOpenClawStateDir = process.env.OPENCLAW_STATE_DIR

    process.env.OPENCLAW_STATE_DIR = openClawRoot

    const sessionDir = path.join(openClawRoot, 'agents', 'pm', 'sessions')
    fs.mkdirSync(sessionDir, { recursive: true })
    fs.writeFileSync(path.join(sessionDir, 'stale-session.jsonl'), '')
    const latestTranscriptPath = path.join(sessionDir, 'latest-session.jsonl')
    fs.writeFileSync(latestTranscriptPath, [
      JSON.stringify({
        type: 'message',
        id: 'msg-user',
        timestamp: '2026-04-30T04:50:01Z',
        message: { role: 'user', content: [{ type: 'text', text: 'PM ping' }] },
      }),
      JSON.stringify({
        type: 'message',
        id: 'msg-assistant',
        timestamp: '2026-04-30T04:50:02Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'PM Agent 在线，随时待命处理任务。' }] },
      }),
    ].join('\n'))
    fs.utimesSync(path.join(sessionDir, 'stale-session.jsonl'), new Date('2026-04-30T04:40:00Z'), new Date('2026-04-30T04:40:00Z'))
    fs.utimesSync(latestTranscriptPath, new Date('2026-04-30T04:50:00Z'), new Date('2026-04-30T04:50:00Z'))

    try {
      sync.fetchAgents.mockResolvedValue([
        { id: 'pm', name: 'PM', identity: { name: 'PM' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'agent:pm:main',
          agentId: 'pm',
          label: 'agent:pm:main',
          model: 'glm-5',
          status: 'running',
          startedAt: '2026-04-30T04:50:00Z',
          endedAt: null,
          sessionId: 'missing-session-id',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'pm', name: 'PM', role: 'pm', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].history).toHaveLength(2)
      expect(snapshot.sessions[0].latestThought).toBe('PM Agent 在线，随时待命处理任务。')
      expect(snapshot.tasks[0].recentEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'session:progress',
          sessionKey: 'agent:pm:main',
          message: 'PM Agent 在线，随时待命处理任务。',
        }),
      ]))
    } finally {
      if (originalOpenClawStateDir) process.env.OPENCLAW_STATE_DIR = originalOpenClawStateDir
      else delete process.env.OPENCLAW_STATE_DIR
      fs.rmSync(openClawRoot, { recursive: true, force: true })
    }
  })

  it('discovers the latest agent jsonl when gateway session metadata has no local path', async () => {
    const sync = createSyncStub()
    const openClawRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-snapshot-'))
    const originalOpenClawStateDir = process.env.OPENCLAW_STATE_DIR

    process.env.OPENCLAW_STATE_DIR = openClawRoot

    const sessionDir = path.join(openClawRoot, 'agents', 'developer', 'sessions')
    fs.mkdirSync(sessionDir, { recursive: true })
    const latestTranscriptPath = path.join(sessionDir, 'latest-gateway-session.jsonl')
    fs.writeFileSync(latestTranscriptPath, [
      JSON.stringify({
        type: 'message',
        id: 'msg-user',
        timestamp: '2026-04-30T05:00:01Z',
        message: { role: 'user', content: [{ type: 'text', text: 'Developer ping' }] },
      }),
      JSON.stringify({
        type: 'message',
        id: 'msg-tool',
        timestamp: '2026-04-30T05:00:02Z',
        message: {
          role: 'toolResult',
          toolName: 'write',
          content: [{ type: 'text', text: 'Successfully wrote 10 bytes to /tmp/gateway-session/index.html' }],
        },
      }),
    ].join('\n'))
    fs.utimesSync(latestTranscriptPath, new Date('2026-04-30T05:00:00Z'), new Date('2026-04-30T05:00:00Z'))

    try {
      sync.fetchAgents.mockResolvedValue([
        { id: 'developer', name: 'Developer', identity: { name: 'Developer' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'agent:developer:main',
          agentId: 'developer',
          label: 'agent:developer:main',
          model: 'gpt-5.5',
          status: 'running',
          startedAt: '2026-04-30T05:00:00Z',
          endedAt: null,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'developer', name: 'Developer', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].history).toHaveLength(2)
      expect(snapshot.sessions[0].artifacts).toEqual([
        expect.objectContaining({
          type: 'html',
          path: '/tmp/gateway-session/index.html',
          producedBy: 'developer',
        }),
      ])
      expect(snapshot.sessions[0].eventFeed.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'artifact:produced', sessionKey: 'agent:developer:main' }),
      ]))
    } finally {
      if (originalOpenClawStateDir) process.env.OPENCLAW_STATE_DIR = originalOpenClawStateDir
      else delete process.env.OPENCLAW_STATE_DIR
      fs.rmSync(openClawRoot, { recursive: true, force: true })
    }
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

    it('derives phase timeline from history timestamps and agent activity instead of placeholder phases', async () => {
      const sync = createSyncStub()

      const startTime = '2026-04-14T08:00:00Z'
      const planningTime = '2026-04-14T08:02:00Z'
      const implementationTime = '2026-04-14T08:05:00Z'
      const doneTime = '2026-04-14T08:09:00Z'

      sync.fetchAgents.mockResolvedValue([
        { id: 'pm-claw', name: 'PM', identity: { name: 'PM Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-phase-history',
          agentId: 'pm-claw',
          label: '整理 timeline 语义',
          model: 'gpt-5',
          status: 'completed',
          startedAt: startTime,
          endedAt: doneTime,
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'pm-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'assistant', content: '正在分析需求并拆解任务', status: 'running', timestamp: planningTime },
        { role: 'toolResult', content: '已写入文件: /projects/plan.md', status: 'completed', timestamp: implementationTime },
        { role: 'assistant', content: '任务已完成，可以交付', status: 'completed', timestamp: doneTime },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      const task = snapshot.tasks[0]
      expect(task.currentPhase).toBe('done')
      expect(task.phases).toEqual([
        expect.objectContaining({
          phase: 'submitted',
          status: 'completed',
          startTime: Date.parse(startTime),
          endTime: Date.parse(startTime),
        }),
        expect.objectContaining({
          phase: 'pm_analysis',
          status: 'completed',
          agentId: 'pm-claw',
          agentName: 'PM Claw',
          startTime: Date.parse(planningTime),
          endTime: Date.parse(implementationTime),
        }),
        expect.objectContaining({
          phase: 'planning',
          status: 'pending',
        }),
        expect.objectContaining({
          phase: 'developer',
          status: 'completed',
          agentName: 'PM Claw',
          startTime: Date.parse(implementationTime),
          endTime: Date.parse(implementationTime),
        }),
        expect.objectContaining({
          phase: 'tester',
          status: 'pending',
        }),
        expect.objectContaining({
          phase: 'reviewer',
          status: 'pending',
        }),
        expect.objectContaining({
          phase: 'done',
          status: 'completed',
          startTime: Date.parse(doneTime),
          endTime: Date.parse(doneTime),
        }),
      ])
      expect(task.recentEvents.map(event => event.type)).toEqual([
        'task:progress',
        'task:completed',
        'session:progress',
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

    it('prefers structured tool/file/artifact metadata when deriving events', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-structured-events',
          agentId: 'dev-claw',
          label: 'Structured metadata events',
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
        {
          role: 'toolResult',
          content: 'Structured metadata only',
          status: 'completed',
          timestamp: '2026-04-14T10:01:00Z',
          tool: { name: 'edit', rawName: 'edit' },
          files: [{ paths: ['/test/component.tsx'], operation: 'edit' }],
          artifacts: [{ paths: ['/test/component.tsx'], type: 'tsx' }],
        },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      const toolEvent = snapshot.sessions[0].eventFeed.events.find(e => e.type === 'tool:completed')
      expect(toolEvent?.toolName).toBe('edit')
      expect(toolEvent?.filePaths).toContain('/test/component.tsx')

      const fileEvent = snapshot.sessions[0].eventFeed.events.find(e => e.type === 'file:modified')
      expect(fileEvent?.filePaths).toContain('/test/component.tsx')

      const artifactEvent = snapshot.sessions[0].eventFeed.events.find(e => e.type === 'artifact:produced')
      expect(artifactEvent?.artifactType).toBe('tsx')
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

  describe('structured final result summary', () => {
    it('derives structured finalResultSummary with tool type and paths from last toolResult', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-structured-result',
          agentId: 'dev-claw',
          label: 'Structured result test',
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
        { role: 'toolResult', content: '已写入文件: /test/index.html', status: 'completed', timestamp: '2026-04-14T10:10:00Z' },
        { role: 'toolResult', content: '已写入文件: /test/styles.css', status: 'completed', timestamp: '2026-04-14T10:20:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].finalResultSummary).toBeDefined()
      expect(snapshot.sessions[0].finalResultSummary?.toolType).toBe('write')
      expect(snapshot.sessions[0].finalResultSummary?.paths).toContain('/test/styles.css')
      expect(snapshot.sessions[0].finalResultSummary?.status).toBe('completed')
      expect(snapshot.sessions[0].latestResultSummary).toBeDefined()
    })

    it('derives structured finalResultSummary with URL from deployment output', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'deploy-claw', name: 'Deploy', identity: { name: 'Deploy Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-url-result',
          agentId: 'deploy-claw',
          label: 'Deploy test',
          model: 'gpt-5',
          status: 'completed',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: '2026-04-14T10:30:00Z',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'deploy-claw', name: 'Deploy Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'toolResult', content: 'Deployed to: https://example.com/app', status: 'completed', timestamp: '2026-04-14T10:20:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].finalResultSummary).toBeDefined()
      expect(snapshot.sessions[0].finalResultSummary?.urls).toContain('https://example.com/app')
      expect(snapshot.sessions[0].finalResultSummary?.operation).toBe('deploy')
    })

    it('derives structured finalResultSummary with failed status from failed toolResult', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-failed-result',
          agentId: 'dev-claw',
          label: 'Failed test',
          model: 'gpt-5',
          status: 'failed',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: '2026-04-14T10:30:00Z',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'toolResult', content: 'Command failed: npm run build', status: 'failed', timestamp: '2026-04-14T10:20:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].finalResultSummary).toBeDefined()
      expect(snapshot.sessions[0].finalResultSummary?.status).toBe('failed')
      expect(snapshot.sessions[0].finalResultSummary?.error).toBeDefined()
    })

    it('handles session with no toolResult gracefully in finalResultSummary', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'pm-claw', name: 'PM', identity: { name: 'PM Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-no-tool',
          agentId: 'pm-claw',
          label: 'Analysis only',
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
        { role: 'assistant', content: 'Analysis complete', status: 'completed', timestamp: '2026-04-14T10:20:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].finalResultSummary).toBeNull()
      expect(snapshot.sessions[0].latestResultSummary).toBeNull()
    })
  })

  describe('finalDeliveryArtifacts structured path/url', () => {
    it('populates both path and url fields in finalDeliveryArtifacts', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'deploy-claw', name: 'Deploy', identity: { name: 'Deploy Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-delivery',
          agentId: 'deploy-claw',
          label: 'Deploy delivery',
          model: 'gpt-5',
          status: 'completed',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: '2026-04-14T10:30:00Z',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'deploy-claw', name: 'Deploy Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        { role: 'toolResult', content: '已写入文件: /app/index.html', status: 'completed', timestamp: '2026-04-14T10:10:00Z' },
        { role: 'toolResult', content: 'Deployed to: https://example.com/app', status: 'completed', timestamp: '2026-04-14T10:20:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].finalDeliveryArtifacts).toHaveLength(2)
      const htmlArtifact = snapshot.sessions[0].finalDeliveryArtifacts.find(a => a.type === 'html')
      expect(htmlArtifact?.path).toBe('/app/index.html')
      expect(htmlArtifact?.url).toBeUndefined()

      const urlArtifact = snapshot.sessions[0].finalDeliveryArtifacts.find(a => a.type === 'url')
      expect(urlArtifact?.url).toBe('https://example.com/app')
    })

    it('supports structured metadata for final delivery path/url fields', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'deploy-claw', name: 'Deploy', identity: { name: 'Deploy Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-structured-delivery',
          agentId: 'deploy-claw',
          label: 'Structured delivery metadata',
          model: 'gpt-5',
          status: 'completed',
          startedAt: '2026-04-14T10:00:00Z',
          endedAt: '2026-04-14T10:30:00Z',
        },
      ])
      sync.mapToAgentInfo.mockReturnValue([
        { id: 'deploy-claw', name: 'Deploy Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
      sync.client.sessions_history.mockResolvedValue([
        {
          role: 'toolResult',
          content: 'Deployment completed',
          status: 'completed',
          timestamp: '2026-04-14T10:20:00Z',
          tool: { name: 'deploy', rawName: 'deploy' },
          files: [{ paths: ['/app/index.html'], operation: 'write' }],
          artifacts: [{ paths: ['https://example.com/app'], type: 'url' }],
        },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].finalDeliveryArtifacts).toHaveLength(2)
      const htmlArtifact = snapshot.sessions[0].finalDeliveryArtifacts.find(a => a.path === '/app/index.html')
      expect(htmlArtifact?.type).toBe('html')

      const urlArtifact = snapshot.sessions[0].finalDeliveryArtifacts.find(a => a.type === 'url')
      expect(urlArtifact?.url).toBe('https://example.com/app')
      expect(snapshot.sessions[0].finalResultSummary?.toolType).toBe('deploy')
      expect(snapshot.sessions[0].finalResultSummary?.urls).toContain('https://example.com/app')
    })

    it('provides structured artifact summary with file counts for dashboard', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-counts',
          agentId: 'dev-claw',
          label: 'Multi-file delivery',
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
        { role: 'toolResult', content: '已写入文件: /app/a.tsx', status: 'completed', timestamp: '2026-04-14T10:10:00Z' },
        { role: 'toolResult', content: '已写入文件: /app/b.tsx', status: 'completed', timestamp: '2026-04-14T10:15:00Z' },
        { role: 'toolResult', content: '已写入文件: /app/c.tsx', status: 'completed', timestamp: '2026-04-14T10:20:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.sessions[0].finalDeliveryArtifacts).toHaveLength(3)
      const fileCounts = snapshot.sessions[0].finalDeliveryArtifacts.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      expect(fileCounts['tsx'] || fileCounts['code']).toBe(3)
    })

    it('flows structured finalResultSummary to taskHistory tasks', async () => {
      const sync = createSyncStub()

      sync.fetchAgents.mockResolvedValue([
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ])
      sync.fetchSessions.mockResolvedValue([
        {
          key: 'sess-flow-test',
          agentId: 'dev-claw',
          label: 'Flow test session',
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
        { role: 'toolResult', content: '已写入文件: /app/main.tsx', status: 'completed', timestamp: '2026-04-14T10:20:00Z' },
      ])

      const snapshot = await buildOpenClawSnapshot(sync as any)

      expect(snapshot.tasks).toHaveLength(1)
      expect(snapshot.tasks[0].taskId).toBe('sess-flow-test')
      expect(snapshot.tasks[0].finalResultSummary).toBeDefined()
      expect(snapshot.tasks[0].finalResultSummary?.toolType).toBe('write')
      expect(snapshot.tasks[0].finalResultSummary?.paths).toContain('/app/main.tsx')
      expect(snapshot.tasks[0].finalResultSummary?.status).toBe('completed')
    })
  })
})
