import { GameEventStore } from '@/game/data/GameEventStore'
import { SessionSyncService, GatewayAgent, GatewaySession } from './session-sync'
import { AgentInfo } from '@/game/data/DashboardStore'

export interface SessionPollerOptions {
  interval?: number
}

const DEFAULT_INTERVAL = 30000

interface CachedAgentState {
  status: string
  role: string
}

interface CachedSession {
  key: string
  status: string
  endedAt: string | null
}

export class SessionPollerService {
  private readonly store: GameEventStore
  private readonly sync: SessionSyncService
  private readonly interval: number
  // [DIAG] 唯一标识每个实例，用于确认 HMR 后是否复用同一个实例
  readonly instanceId: string = Math.random().toString(36).slice(2, 8)
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private firstPoll = true
  private agentCache = new Map<string, CachedAgentState>()
  private sessionCache = new Map<string, CachedSession>()
  private polling = false

  constructor(store: GameEventStore, sync: SessionSyncService, options: SessionPollerOptions = {}) {
    this.store = store
    this.sync = sync
    this.interval = options.interval ?? DEFAULT_INTERVAL
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.firstPoll = true
    // [DIAG] 打印 poller 实例标识，确认是同一个实例被复用（HMR 安全验证）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SessionPoller] start instanceId=${this.instanceId} interval=${this.interval}ms`)
    }
    this.poll()
    this.timer = setInterval(() => this.poll(), this.interval)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.running = false
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SessionPoller] stop instanceId=${this.instanceId}`)
    }
  }

  isRunning(): boolean {
    return this.running
  }

  private async poll(): Promise<void> {
    if (this.polling) return
    this.polling = true

    try {
      let agents: GatewayAgent[]
      let sessions: GatewaySession[]

      try {
        agents = await this.sync.fetchAgents()
        sessions = await this.sync.fetchSessions()
      } catch {
        const defaults = this.sync.getDefaultAgents()
        if (this.firstPoll) {
          for (const agent of defaults) {
            this.pushAgentStatus(agent.id, agent.status, undefined)
          }
          this.firstPoll = false
        }
        return
      }

      const agentInfos = this.sync.mapToAgentInfo(agents, sessions)

      for (const info of agentInfos) {
        const cached = this.agentCache.get(info.id)
        if (this.firstPoll || !cached || cached.status !== info.status) {
          this.pushAgentStatus(info.id, info.status, cached?.status)
        }
        this.agentCache.set(info.id, { status: info.status, role: info.role })
      }

      this.detectSessionChanges(sessions)

      this.firstPoll = false
    } catch {
      // swallow errors, keep polling
    } finally {
      this.polling = false
    }
  }

  private pushAgentStatus(agentId: string, status: string, previousStatus: string | undefined): void {
    this.store.push({
      type: 'agent:status-change',
      timestamp: Date.now(),
      agentId,
      status: status as 'idle' | 'busy' | 'working' | 'offline',
      ...(previousStatus !== undefined ? { previousStatus: previousStatus as 'idle' | 'busy' | 'working' | 'offline' } : {}),
    })
  }

  private detectSessionChanges(sessions: GatewaySession[]): void {
    const currentKeys = new Set<string>()

    for (const session of sessions) {
      currentKeys.add(session.key)
      const cached = this.sessionCache.get(session.key)
      const agentRole = this.agentCache.get(session.agentId)?.role || ''

      if (!cached) {
        const isActive = session.endedAt === null || (session.status?.includes('running'))
        if (isActive) {
          this.store.push({
            type: 'session:started',
            timestamp: Date.now(),
            sessionKey: session.key,
            agentId: session.agentId,
            role: agentRole,
            task: session.label || '',
          })
        }
      } else {
        const wasActive = cached.endedAt === null || cached.status?.includes('running')
        const isActive = session.endedAt === null || session.status?.includes('running')
        if (wasActive && !isActive) {
          this.store.push({
            type: 'session:completed',
            timestamp: Date.now(),
            sessionKey: session.key,
            agentId: session.agentId,
            role: agentRole,
            status: session.status === 'failed' ? 'failed' as const : 'completed' as const,
            duration: 0,
          })
        }
      }

      this.sessionCache.set(session.key, {
        key: session.key,
        status: session.status,
        endedAt: session.endedAt,
      })
    }
  }
}


export function createSessionPoller(store: GameEventStore, sync?: SessionSyncService): SessionPollerService {
  return new SessionPollerService(store, sync ?? new SessionSyncService())
}

// ── 进程级单例（HMR 安全）──────────────────────────────────────────────────────
//
// Next.js dev 模式下，每次热重载都会重新执行本模块，module-level 变量被重置。
// 使用 globalThis 存储单例，确保 HMR 后能找到并停掉旧的 poller，
// 避免多个 setInterval 并发运行导致 listener 无限堆积。
//
declare global {
  // eslint-disable-next-line no-var
  var __sessionPoller: SessionPollerService | undefined
}

export function getSessionPoller(store: GameEventStore, sync?: SessionSyncService): SessionPollerService {
  if (!globalThis.__sessionPoller) {
    globalThis.__sessionPoller = createSessionPoller(store, sync)
  }
  return globalThis.__sessionPoller
}

export function resetSessionPoller(): void {
  if (globalThis.__sessionPoller) {
    globalThis.__sessionPoller.stop()
    globalThis.__sessionPoller = undefined
  }
}
