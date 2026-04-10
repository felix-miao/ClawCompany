/**
 * GameEventEmitter
 *
 * Bridges the server-side Orchestrator with the client-side GameEventStore
 * by posting events to the /api/game-events HTTP endpoint.
 *
 * This decouples the orchestration logic from the UI layer: the Orchestrator
 * calls emitXxx() at key lifecycle points, the events are stored server-side
 * in GameEventStore, and the dashboard/virtual-office receives them via SSE.
 */

export type AgentRole = 'pm' | 'dev' | 'review' | 'tester' | 'pm-agent' | 'dev-agent' | 'review-agent' | 'test-agent'

export interface GameEventEmitterOptions {
  /** Base URL for internal API calls (defaults to http://localhost:3000) */
  baseUrl?: string
  /** API authentication token (uses NEXTAUTH_SECRET or GAME_EVENTS_TOKEN env var if not supplied) */
  token?: string
  /** If true, errors are logged but never thrown (default: true) */
  silent?: boolean
}

export class GameEventEmitter {
  private readonly baseUrl: string
  private readonly token: string
  private readonly silent: boolean

  constructor(options: GameEventEmitterOptions = {}) {
    this.baseUrl = options.baseUrl
      ?? process.env.NEXT_PUBLIC_APP_URL
      ?? 'http://localhost:3000'
    this.token = options.token
      ?? process.env.GAME_EVENTS_TOKEN
      ?? process.env.NEXTAUTH_SECRET
      ?? ''
    this.silent = options.silent !== false
  }

  // ── Task lifecycle ─────────────────────────────────────────────────────────

  async emitTaskAssigned(params: {
    agentId: AgentRole
    taskId: string
    taskType: 'coding' | 'testing' | 'review' | 'meeting'
    description: string
  }): Promise<void> {
    await this.post({
      type: 'agent:task-assigned',
      agentId: params.agentId,
      taskId: params.taskId,
      taskType: params.taskType,
      description: params.description,
      timestamp: Date.now(),
    })
  }

  async emitTaskCompleted(params: {
    agentId: AgentRole
    taskId: string
    result: 'success' | 'failure' | 'partial'
    duration?: number
  }): Promise<void> {
    await this.post({
      type: 'agent:task-completed',
      agentId: params.agentId,
      taskId: params.taskId,
      result: params.result,
      duration: params.duration ?? 0,
      timestamp: Date.now(),
    })
  }

  async emitTaskHandover(params: {
    fromAgentId: AgentRole
    toAgentId: AgentRole
    taskId: string
    description: string
  }): Promise<void> {
    await this.post({
      type: 'task:visualization:handover',
      fromAgentId: params.fromAgentId,
      toAgentId: params.toAgentId,
      taskId: params.taskId,
      description: params.description,
      timestamp: Date.now(),
    })
  }

  // ── Agent status ───────────────────────────────────────────────────────────

  async emitAgentStatus(params: {
    agentId: AgentRole
    status: 'idle' | 'busy' | 'working' | 'offline'
  }): Promise<void> {
    await this.post({
      type: 'agent:status-change',
      agentId: params.agentId,
      status: params.status,
      timestamp: Date.now(),
    })
  }

  async emitEmotionChange(params: {
    agentId: AgentRole
    emotion: string
  }): Promise<void> {
    await this.post({
      type: 'agent:emotion-change',
      agentId: params.agentId,
      emotion: params.emotion,
      timestamp: Date.now(),
    })
  }

  // ── Session lifecycle ──────────────────────────────────────────────────────

  async emitSessionStarted(params: {
    sessionKey: string
    agentId: AgentRole
    task: string
  }): Promise<void> {
    await this.post({
      type: 'session:started',
      sessionKey: params.sessionKey,
      agentId: params.agentId,
      role: params.agentId,
      task: params.task,
      timestamp: Date.now(),
    })
  }

  async emitSessionCompleted(params: {
    sessionKey: string
    agentId: AgentRole
    status: 'completed' | 'failed'
    duration: number
  }): Promise<void> {
    await this.post({
      type: 'session:completed',
      sessionKey: params.sessionKey,
      agentId: params.agentId,
      role: params.agentId,
      status: params.status,
      duration: params.duration,
      timestamp: Date.now(),
    })
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async post(event: Record<string, unknown>): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/game-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(event),
      })
      if (!res.ok && !this.silent) {
        throw new Error(`GameEventEmitter: HTTP ${res.status} posting event ${event.type}`)
      }
    } catch (err) {
      if (!this.silent) throw err
      // swallow – UI updates are best-effort, must not break the workflow
    }
  }
}

let _emitter: GameEventEmitter | null = null

/** Returns a shared singleton emitter (server-side only) */
export function getGameEventEmitter(): GameEventEmitter {
  if (!_emitter) {
    _emitter = new GameEventEmitter()
  }
  return _emitter
}

/** Replace the singleton (useful in tests) */
export function setGameEventEmitter(emitter: GameEventEmitter | null): void {
  _emitter = emitter
}
