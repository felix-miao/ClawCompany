import {
  AgentInfo,
  TaskHistory,
  TaskPhase,
  TaskPhaseRecord,
  TASK_PHASE_LABELS,
  TASK_PHASE_ORDER,
} from '@/game/data/DashboardStore'

import {
  GameEvent,
  TaskVisualizationCompletedEvent,
  TaskVisualizationHandoverEvent,
  TaskVisualizationProgressEvent,
  TaskVisualizationFailedEvent,
  SessionProgressEvent,
} from '@/game/types/GameEvents'

import { HistoryMessage, OpenClawToolType, HistoryToolMetadata, HistoryFileMetadata, HistoryArtifactMetadata } from './client'
import { GatewayAgent, GatewaySession, SessionSyncService } from './session-sync'

export type OpenClawEventType = 
  | 'tool:invoked'
  | 'tool:completed'
  | 'tool:failed'
  | 'file:created'
  | 'file:modified'
  | 'file:deleted'
  | 'file:read'
  | 'artifact:produced'
  | 'message:sent'
  | 'message:received'
  | 'session:handover'
  | 'session:progress'
  | 'session:completed'
  | 'session:failed'

export interface OpenClawEvent {
  id: string
  type: OpenClawEventType
  timestamp: number
  sessionKey: string
  agentId: string
  toolName?: OpenClawToolType
  filePaths?: string[]
  artifactType?: OpenClawArtifactType
  content?: string
  summary: string
  metadata?: Record<string, unknown>
}

export interface OpenClawEventFeed {
  events: OpenClawEvent[]
  totalCount: number
  byType: Record<OpenClawEventType, number>
}

export type OpenClawArtifactType = 'html' | 'tsx' | 'code' | 'image' | 'markdown' | 'json' | 'test-report' | 'url'

export interface OpenClawArtifact {
  type: OpenClawArtifactType
  path?: string
  url?: string
  title: string
  producedBy: string
  producedAt: string
  isFinal?: boolean
}

export type SessionCategory = 'running' | 'completed' | 'just-completed' | 'failed' | 'stuck'

export interface OpenClawSessionDetails {
  sessionKey: string
  agentId: string
  agentName: string
  role: string
  label: string
  status: string
  startedAt: string
  endedAt: string | null
  currentWork: string | null
  latestThought: string | null
  latestResultSummary: string | null
  model: string
  usage?: GatewaySession['usage']
  latestMessage: string | null
  latestMessageRole: HistoryMessage['role'] | null
  latestMessageStatus: HistoryMessage['status'] | null
  history: HistoryMessage[]
  artifacts: OpenClawArtifact[]
  finalDeliveryArtifacts: OpenClawArtifact[]
  category: SessionCategory
  eventFeed: OpenClawEventFeed
}

export interface OpenClawSnapshotMetrics {
  agents: {
    total: number
    active: number
    idle: number
    byRole: Record<string, number>
  }
  sessions: {
    total: number
    active: number
    completed: number
    failed: number
  }
  tokens: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  source: 'gateway' | 'fallback'
  fetchedAt: string
}

export interface OpenClawSnapshot {
  agents: AgentInfo[]
  sessions: OpenClawSessionDetails[]
  tasks: TaskHistory[]
  metrics: OpenClawSnapshotMetrics
  connected: boolean
  fetchedAt: string
}

const HISTORY_LIMIT = 20

const ROLE_LABELS: Record<string, string> = {
  pm: 'PM',
  dev: 'Developer',
  review: 'Reviewer',
  tester: 'Tester',
}

const ROLE_TO_PHASE: Record<string, TaskPhase> = {
  pm: 'pm_analysis',
  dev: 'developer',
  review: 'reviewer',
  tester: 'tester',
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase()
}

function phaseForRole(role: string): TaskPhase {
  return ROLE_TO_PHASE[normalizeRole(role)] ?? 'developer'
}

function formatRoleLabel(role: string): string {
  return ROLE_LABELS[normalizeRole(role)] ?? role ?? 'Agent'
}

function findLatestMessage(
  history: HistoryMessage[],
  predicate: (message: HistoryMessage) => boolean,
): HistoryMessage | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.content.trim().length > 0 && predicate(message)) {
      return message
    }
  }

  return null
}

function isSessionActive(session: Pick<OpenClawSessionDetails, 'endedAt' | 'status'> | Pick<GatewaySession, 'endedAt' | 'status'>): boolean {
  return session.endedAt === null || session.status.includes('running')
}

function deriveCategory(session: Pick<OpenClawSessionDetails, 'endedAt' | 'status' | 'latestMessageStatus' | 'startedAt'>): SessionCategory {
  const isEnded = session.endedAt !== null

  if (session.status === 'failed') {
    return 'failed'
  }

  if (session.status === 'completed' || session.status === 'done') {
    if (isEnded) {
      const endedTime = Date.parse(session.endedAt)
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000
      if (endedTime >= fiveMinutesAgo) {
        return 'just-completed'
      }
    }
    return 'completed'
  }

  if (session.status.includes('running') || session.status === 'pending') {
    if (session.latestMessageStatus === 'running') {
      return 'running'
    }

    if (!isEnded && session.startedAt) {
      const startTime = Date.parse(session.startedAt)
      const now = Date.now()
      const threshold = 10 * 60 * 1000
      if (now - startTime > threshold) {
        return 'stuck'
      }
    }
    return 'running'
  }

  return 'just-completed'
}

function deriveCurrentTask(session: GatewaySession, history: HistoryMessage[]): string | null {
  const latestAssistant = findLatestMessage(history, message => message.role === 'assistant')
  return session.label || latestAssistant?.content || null
}

function deriveLatestThought(history: HistoryMessage[]): string | null {
  const latestAssistant = findLatestMessage(history, message => message.role === 'assistant')
  return latestAssistant?.content?.slice(0, 200) || null
}

function deriveLatestResultSummary(history: HistoryMessage[]): string | null {
  const latestToolResult = findLatestMessage(history, message => message.role === 'toolResult')
  return latestToolResult?.content?.slice(0, 200) || null
}

const FILE_EXT_ARTIFACT_TYPE: Record<string, OpenClawArtifactType> = {
  '.html': 'html',
  '.htm': 'html',
  '.tsx': 'tsx',
  '.css': 'code',
  '.ts': 'code',
  '.js': 'code',
  '.jsx': 'code',
  '.py': 'code',
  '.json': 'json',
  '.md': 'markdown',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.svg': 'image',
}

function detectArtifactType(filePath: string): OpenClawArtifactType {
  if (filePath.toLowerCase().startsWith('http://') || filePath.toLowerCase().startsWith('https://')) {
    return 'url'
  }
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  const baseName = filePath.toLowerCase()
  if (baseName.includes('test-report')) return 'test-report'
  return FILE_EXT_ARTIFACT_TYPE[ext] || 'code'
}

function extractFilePath(content: string): string | null {
  const patterns = [
    /已写入文件:\s*(.+)/,
    /已写入[^:]*:\s*(.+)/,
    /Wrote file:\s*(.+)/,
    /written:\s*(.+)/,
    /Created:\s*(.+)/,
    /Saved:\s*(.+)/,
    /File:\s*(.+)/,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      const path = match[1].trim()
      if (path.startsWith('/') || path.includes(':')) {
        return path
      }
    }
  }

  return null
}

function extractAllFilePaths(content: string): string[] {
  const patterns = [
    /已写入文件:\s*(.+)/g,
    /已写入[^:]*:\s*(.+)/g,
    /Wrote file:\s*(.+)/g,
    /written:\s*(.+)/g,
    /Created:\s*(.+)/g,
    /Saved:\s*(.+)/g,
    /File:\s*(.+)/g,
    /已读取文件:\s*(.+)/g,
    /Read file:\s*(.+)/g,
    /Deleting:\s*(.+)/g,
    /已删除文件:\s*(.+)/g,
    /Deployed to:\s*(https?:\/\/[^\s]+)/g,
    /Published to:\s*(https?:\/\/[^\s]+)/g,
    /URL:\s*(https?:\/\/[^\s]+)/g,
    /Link:\s*(https?:\/\/[^\s]+)/g,
  ]

  const paths: string[] = []
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const path = match[1].trim()
      if (path.startsWith('/') || path.includes(':') || path.startsWith('http')) {
        paths.push(path)
      }
    }
  }

  return [...new Set(paths)]
}

function inferToolType(content: string): OpenClawToolType {
  const lower = content.toLowerCase()
  if (/read|读取|读取文件/.test(lower)) return 'read'
  if (/write|写入|创建文件|已写入/.test(lower)) return 'write'
  if (/edit|修改|更新文件/.test(lower)) return 'edit'
  if (/delete|删除/.test(lower)) return 'delete'
  if (/mkdir|创建目录/.test(lower)) return 'mkdir'
  if (/bash|shell|终端|命令/.test(lower)) return 'bash'
  if (/grep|搜索|搜索文件/.test(lower)) return 'grep'
  if (/find|查找/.test(lower)) return 'find'
  if (/glob|匹配/.test(lower)) return 'glob'
  if (/browser|screenshot|浏览器/.test(lower)) return 'browser'
  if (/search|搜索网络/.test(lower)) return 'search'
  if (/fetch|http|请求/.test(lower)) return 'fetch'
  if (/git/.test(lower)) return 'git'
  if (/npm/.test(lower)) return 'npm'
  if (/python/.test(lower)) return 'python'
  if (/node/.test(lower)) return 'node'
  if (/test|测试/.test(lower)) return 'test'
  if (/lint|检查/.test(lower)) return 'lint'
  if (/build|构建/.test(lower)) return 'build'
  if (/deploy|部署/.test(lower)) return 'deploy'
  return 'unknown'
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function deriveEventFeed(
  session: GatewaySession,
  history: HistoryMessage[],
  agentId: string,
): OpenClawEventFeed {
  const events: OpenClawEvent[] = []
  const byType: Record<OpenClawEventType, number> = {
    'tool:invoked': 0,
    'tool:completed': 0,
    'tool:failed': 0,
    'file:created': 0,
    'file:modified': 0,
    'file:deleted': 0,
    'file:read': 0,
    'artifact:produced': 0,
    'message:sent': 0,
    'message:received': 0,
    'session:handover': 0,
    'session:progress': 0,
    'session:completed': 0,
    'session:failed': 0,
  }

  for (const message of history) {
    const timestamp = parseHistoryTimestamp(message.timestamp) ?? Date.now()
    const filePaths = extractAllFilePaths(message.content)
    const toolName = inferToolType(message.content)

    if (message.role === 'user') {
      const event: OpenClawEvent = {
        id: generateEventId(),
        type: 'message:sent',
        timestamp,
        sessionKey: session.key,
        agentId,
        content: message.content,
        summary: shortenHistoryContent(message.content, 80),
        metadata: { status: message.status },
      }
      events.push(event)
      byType['message:sent']++
    }

    if (message.role === 'assistant') {
      const isHandover = /交接给|handover to|passed to/i.test(message.content)
      const eventType: OpenClawEventType = isHandover ? 'session:handover' : 'message:received'
      
      const event: OpenClawEvent = {
        id: generateEventId(),
        type: eventType,
        timestamp,
        sessionKey: session.key,
        agentId,
        content: message.content,
        summary: shortenHistoryContent(message.content, 80),
        metadata: { status: message.status },
      }
      
      if (isHandover) {
        const handoverMatch = message.content.match(/交接给\s*([a-zA-Z0-9_-]+)/i)
          ?? message.content.match(/(?:handover to|passed to)\s*([a-zA-Z0-9_-]+)/i)
        if (handoverMatch) {
          event.metadata = { ...event.metadata, handoverTarget: normalizeHandoverTarget(handoverMatch[1]) }
        }
      }
      
      events.push(event)
      byType[eventType]++
    }

    if (message.role === 'toolResult') {
      const isFailed = message.status === 'failed'
      const eventType: OpenClawEventType = isFailed ? 'tool:failed' : 'tool:completed'

      const event: OpenClawEvent = {
        id: generateEventId(),
        type: eventType,
        timestamp,
        sessionKey: session.key,
        agentId,
        toolName,
        filePaths: filePaths.length > 0 ? filePaths : undefined,
        content: message.content,
        summary: filePaths.length > 0
          ? `${toolName}: ${filePaths.join(', ')}`
          : shortenHistoryContent(message.content, 80),
        metadata: { status: message.status, toolType: toolName },
      }
      events.push(event)
      byType[eventType]++

      if (!isFailed && filePaths.length > 0) {
        for (const filePath of filePaths) {
          const artifactType = detectArtifactType(filePath)
          const artifactEvent: OpenClawEvent = {
            id: generateEventId(),
            type: artifactType === 'url' ? 'artifact:produced' : 'file:created',
            timestamp,
            sessionKey: session.key,
            agentId,
            filePaths: [filePath],
            artifactType,
            summary: `${filePath.split('/').pop() || filePath}`,
            metadata: { artifactType, toolName },
          }
          events.push(artifactEvent)
          byType[artifactEvent.type]++
        }
      }

      if (isFailed) {
        const failedEvent: OpenClawEvent = {
          id: generateEventId(),
          type: 'session:failed',
          timestamp,
          sessionKey: session.key,
          agentId,
          content: message.content,
          summary: shortenHistoryContent(message.content, 100),
          metadata: { toolName, error: true },
        }
        events.push(failedEvent)
        byType['session:failed']++
      }
    }
  }

  if (session.status === 'completed' || session.status === 'done') {
    const completedEvent: OpenClawEvent = {
      id: generateEventId(),
      type: 'session:completed',
      timestamp: parseHistoryTimestamp(session.endedAt ?? undefined) ?? Date.now(),
      sessionKey: session.key,
      agentId,
      summary: `Session completed: ${session.label || session.key}`,
      metadata: { status: session.status },
    }
    events.push(completedEvent)
    byType['session:completed']++
  }

  return {
    events,
    totalCount: events.length,
    byType,
  }
}

function deriveArtifacts(history: HistoryMessage[], agentId: string): OpenClawArtifact[] {
  const artifactMap = new Map<string, OpenClawArtifact>()

  for (const message of history) {
    if (message.role !== 'toolResult') continue

    const filePath = extractFilePath(message.content)
    if (!filePath) continue

    const fileName = filePath.split('/').pop() || filePath
    const producedAt = message.timestamp || new Date().toISOString()
    artifactMap.set(filePath, {
      type: detectArtifactType(filePath),
      path: filePath,
      title: fileName,
      producedBy: agentId,
      producedAt,
      isFinal: true,
    })
  }

  return Array.from(artifactMap.values())
}

function deriveFinalDeliveryArtifacts(history: HistoryMessage[], agentId: string): OpenClawArtifact[] {
  const lastWriteMap = new Map<string, { artifact: OpenClawArtifact; timestamp: number }>()

  for (const message of history) {
    if (message.role !== 'toolResult') continue

    const filePath = extractFilePath(message.content)
    if (!filePath) continue

    const timestamp = parseHistoryTimestamp(message.timestamp) ?? 0
    const existing = lastWriteMap.get(filePath)

    if (!existing || timestamp > existing.timestamp) {
      const fileName = filePath.split('/').pop() || filePath
      lastWriteMap.set(filePath, {
        artifact: {
          type: detectArtifactType(filePath),
          path: filePath,
          title: fileName,
          producedBy: agentId,
          producedAt: message.timestamp || new Date().toISOString(),
          isFinal: true,
        },
        timestamp,
      })
    }
  }

  return Array.from(lastWriteMap.values())
    .map(entry => entry.artifact)
    .sort((a, b) => parseHistoryTimestamp(b.producedAt)! - parseHistoryTimestamp(a.producedAt)!)
}

function createPhaseRecords(createdAt: number): TaskPhaseRecord[] {
  return TASK_PHASE_ORDER.map((phase) => ({
    phase,
    label: TASK_PHASE_LABELS[phase],
    agentId: phase === 'submitted' ? 'user' : null,
    agentName: phase === 'submitted' ? 'User' : null,
    startTime: phase === 'submitted' ? createdAt : undefined,
    endTime: phase === 'submitted' ? createdAt : undefined,
    status: phase === 'submitted' ? 'completed' : 'pending',
  }))
}

function applyPhaseState(phases: TaskPhaseRecord[], currentPhase: TaskPhase, agentId: string, agentName: string, timestamp: number, finished: boolean): TaskPhaseRecord[] {
  return phases.map((phase) => {
    const phaseIndex = TASK_PHASE_ORDER.indexOf(phase.phase)
    const currentIndex = TASK_PHASE_ORDER.indexOf(currentPhase)

    if (phase.phase === currentPhase) {
      return {
        ...phase,
        agentId,
        agentName,
        startTime: phase.startTime ?? timestamp,
        endTime: finished ? timestamp : phase.endTime,
        status: finished ? 'completed' : 'in_progress',
      }
    }

    if (phaseIndex < currentIndex) {
      return {
        ...phase,
        endTime: phase.endTime ?? timestamp,
        status: phase.status === 'pending' ? 'completed' : phase.status,
      }
    }

    if (finished && phase.phase === 'done') {
      return {
        ...phase,
        startTime: phase.startTime ?? timestamp,
        endTime: timestamp,
        status: 'completed',
      }
    }

    return phase
  })
}

function parseHistoryTimestamp(timestamp?: string | null): number | null {
  if (!timestamp) {
    return null
  }

  const parsed = Date.parse(timestamp)
  return Number.isNaN(parsed) ? null : parsed
}

function shortenHistoryContent(content: string, maxLength: number = 80): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1)}…`
}

function normalizeHandoverTarget(rawTarget: string): string {
  const normalized = rawTarget.trim().toLowerCase()
  if (normalized.includes('review')) return 'reviewer'
  if (normalized.includes('test')) return 'tester'
  if (normalized.includes('dev')) return 'developer'
  if (normalized.includes('pm')) return 'pm'
  return normalized || 'unknown'
}

function deriveRecentEvents(
  session: Pick<OpenClawSessionDetails, 'sessionKey' | 'agentId'>,
  history: HistoryMessage[],
): GameEvent[] {
  const events = history.flatMap((message) => {
    const content = message.content.trim()
    const timestamp = parseHistoryTimestamp(message.timestamp)

    if (!content || timestamp === null) {
      return []
    }

    if (message.role === 'assistant') {
      const handoverMatch = content.match(/交接给\s*([a-zA-Z0-9_-]+)/i)
        ?? content.match(/(?:passed to|handover(?: to)?)\s*([a-zA-Z0-9_-]+)/i)
      const isProgress = message.status === 'running'
        || /(正在|进行中|处理中|working|implementing|verifying|testing)/i.test(content)

      if (handoverMatch) {
        return [{
          type: 'task:handover',
          timestamp,
          fromAgentId: session.agentId,
          toAgentId: normalizeHandoverTarget(handoverMatch[1] ?? ''),
          taskId: session.sessionKey,
          description: shortenHistoryContent(content, 100),
        } satisfies TaskVisualizationHandoverEvent]
      }

      if (isProgress) {
        return [{
          type: 'task:progress',
          timestamp,
          agentId: session.agentId,
          taskId: session.sessionKey,
          progress: 0,
          currentAction: shortenHistoryContent(content, 100),
        } satisfies TaskVisualizationProgressEvent]
      }

      return [{
        type: 'session:progress',
        timestamp,
        sessionKey: session.sessionKey,
        progress: 0,
        message: shortenHistoryContent(content, 100),
      } satisfies SessionProgressEvent]
    }

    if (message.role === 'toolResult') {
      if (message.status === 'failed') {
        return [{
          type: 'task:failed',
          timestamp,
          agentId: session.agentId,
          taskId: session.sessionKey,
          error: shortenHistoryContent(content, 160),
        } satisfies TaskVisualizationFailedEvent]
      }

      if (extractFilePath(content)) {
        return [{
          type: 'task:completed',
          timestamp,
          agentId: session.agentId,
          taskId: session.sessionKey,
          result: 'success',
          duration: 0,
        } satisfies TaskVisualizationCompletedEvent]
      }

      return [{
        type: 'session:progress',
        timestamp,
        sessionKey: session.sessionKey,
        progress: 0,
        message: shortenHistoryContent(content, 100),
      } satisfies SessionProgressEvent]
    }

    return []
  })

  return events.slice(-5)
}

function deriveUpdatedAt(session: OpenClawSessionDetails): number {
  for (let index = session.history.length - 1; index >= 0; index -= 1) {
    const timestamp = parseHistoryTimestamp(session.history[index]?.timestamp)
    if (timestamp !== null) {
      return timestamp
    }
  }

  return parseHistoryTimestamp(session.endedAt)
    ?? parseHistoryTimestamp(session.startedAt)
    ?? 0
}

function deriveTaskHistory(session: OpenClawSessionDetails): TaskHistory {
  const derivedUpdatedAt = deriveUpdatedAt(session)
  const startTime = parseHistoryTimestamp(session.startedAt) ?? derivedUpdatedAt
  const endedTime = parseHistoryTimestamp(session.endedAt)
  const phase = phaseForRole(session.role)
  const agentName = session.agentName || formatRoleLabel(session.role)
  const active = isSessionActive(session)
  const failed = session.status === 'failed'
  const latestMessage = session.latestMessage?.trim() || session.label || session.sessionKey
  const recentEvents = deriveRecentEvents(session, session.history ?? [])
  const phases = applyPhaseState(
    createPhaseRecords(startTime),
    failed || !active ? (failed ? phase : 'done') : phase,
    session.agentId,
    agentName,
    derivedUpdatedAt,
    !active,
  )

  return {
    taskId: session.sessionKey,
    description: session.label || latestMessage,
    phases,
    currentPhase: failed || !active ? (failed ? phase : 'done') : phase,
    currentAgentId: session.agentId,
    currentAgentName: agentName,
    createdAt: startTime,
    updatedAt: derivedUpdatedAt,
    completedAt: endedTime ?? undefined,
    result: failed ? 'failure' : !active ? 'success' : undefined,
    status: failed ? 'failed' : active ? 'in_progress' : 'completed',
    recentEvents,
    failureSummary: failed ? (session.latestMessage || 'Session failed') : undefined,
    latestResultSummary: session.latestResultSummary ?? undefined,
    lastReviewFeedback: failed ? session.latestMessage || undefined : undefined,
    lastApproved: !active && !failed,
  }
}

function buildMetrics(agents: AgentInfo[], sessions: GatewaySession[], fetchedAt: string): OpenClawSnapshotMetrics {
  const activeSessions = sessions.filter(session => session.endedAt === null || session.status.includes('running'))
  const byRole: Record<string, number> = {}
  for (const agent of agents) {
    byRole[agent.role] = (byRole[agent.role] ?? 0) + 1
  }

  return {
    agents: {
      total: agents.length,
      active: agents.filter(agent => agent.status !== 'idle').length,
      idle: agents.filter(agent => agent.status === 'idle').length,
      byRole,
    },
    sessions: {
      total: sessions.length,
      active: activeSessions.length,
      completed: sessions.filter(session => session.status === 'completed').length,
      failed: sessions.filter(session => session.status === 'failed').length,
    },
    tokens: sessions.reduce((acc, session) => ({
      promptTokens: acc.promptTokens + (session.usage?.promptTokens ?? 0),
      completionTokens: acc.completionTokens + (session.usage?.completionTokens ?? 0),
      totalTokens: acc.totalTokens + (session.usage?.totalTokens ?? 0),
    }), {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }),
    source: 'gateway',
    fetchedAt,
  }
}

export async function buildOpenClawSnapshot(sync: SessionSyncService): Promise<OpenClawSnapshot> {
  await sync['client'].connect()
  try {
    const [agents, sessions] = await Promise.all([
      sync.fetchAgents(),
      sync.fetchSessions(),
    ])

    const histories = await Promise.all(
      sessions.map(async (session) => {
        const history = await sync['client'].sessions_history(session.key, HISTORY_LIMIT).catch(() => [])
        return [session.key, history] as const
      })
    )

    const historyMap = new Map(histories)
    const mappedAgents = sync.mapToAgentInfo(agents, sessions)
    const sessionDetails = sessions.map((session) => {
      const history = historyMap.get(session.key) ?? []
      const latestMessage = findLatestMessage(history, () => true)
      const agent = agents.find(item => item.id === session.agentId)
      const role = mappedAgents.find(item => item.id === session.agentId)?.role ?? 'Developer'
      const isCompleted = session.status === 'completed' || session.status === 'done'

      return {
        sessionKey: session.key,
        agentId: session.agentId,
        agentName: agent?.identity?.name || agent?.name || session.agentId,
        role,
        label: session.label,
        status: session.status,
        startedAt: session.startedAt || new Date().toISOString(),
        endedAt: session.endedAt,
        currentWork: deriveCurrentTask(session, history),
        latestThought: deriveLatestThought(history),
        latestResultSummary: deriveLatestResultSummary(history),
        model: session.model,
        usage: session.usage,
        latestMessage: latestMessage?.content ?? null,
        latestMessageRole: latestMessage?.role ?? null,
        latestMessageStatus: latestMessage?.status ?? null,
        history,
        artifacts: deriveArtifacts(history, session.agentId),
        finalDeliveryArtifacts: isCompleted
          ? deriveFinalDeliveryArtifacts(history, session.agentId)
          : [],
        eventFeed: deriveEventFeed(session, history, session.agentId),
      }
    })

    const sessionDetailsWithCategory = sessionDetails.map(session => ({
      ...session,
      category: deriveCategory(session),
    }))

    const agentsWithCurrentTask = mappedAgents.map((agent) => {
      const activeSession = sessionDetails.find(session => session.agentId === agent.id && isSessionActive(session))
      return {
        ...agent,
        status: activeSession ? 'working' : agent.status,
        currentTask: activeSession?.currentWork ?? activeSession?.latestThought ?? activeSession?.label ?? null,
      } satisfies AgentInfo
    })

    const fetchedAt = new Date().toISOString()
    return {
      agents: agentsWithCurrentTask,
      sessions: sessionDetailsWithCategory,
      tasks: sessionDetailsWithCategory.map(deriveTaskHistory).sort((a, b) => b.updatedAt - a.updatedAt),
      metrics: buildMetrics(agentsWithCurrentTask, sessions, fetchedAt),
      connected: true,
      fetchedAt,
    }
  } finally {
    await sync['client'].disconnect().catch(() => {})
  }
}
