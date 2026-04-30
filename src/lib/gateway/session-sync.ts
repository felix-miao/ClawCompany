import { OpenClawGatewayClient, createGatewayClient } from './client'
import { createDefaultAgents } from './default-agents'

import { AgentInfo } from '@/game/data/DashboardStore'

import { execFile } from 'child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const GATEWAY_LIST_TIMEOUT_MS = 1_500

export interface GatewayAgent {
  id: string
  name: string
  identity: {
    name: string
    avatarUrl?: string
  }
}

export interface GatewaySession {
  key: string
  agentId: string
  label: string
  model: string
  status: string
  startedAt?: string
  endedAt: string | null
  sessionId?: string
  transcriptPath?: string
  sessionFile?: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface SessionSummary {
  key: string
  agentId: string
  label: string
  model: string
  status: string
  endedAt: string | null
}

interface StatusAgentEntry {
  id: string
  name?: string
}

interface StatusSessionEntry {
  key: string
  agentId?: string
  model?: string | null
  updatedAt?: number | null
  sessionId?: string | null
  transcriptPath?: string | null
  sessionFile?: string | null
  totalTokens?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
}

interface OpenClawStatusJson {
  agents?: {
    agents?: StatusAgentEntry[]
  }
  sessions?: {
    recent?: StatusSessionEntry[]
  }
}

interface OpenClawConfigJson {
  agents?: {
    list?: Array<{ id?: string; name?: string }>
  }
}

const AGENT_ID_ROLE_MAP: Record<string, string> = {
  'sidekick-claw': 'pm',
  'dev-claw': 'dev',
  'reviewer-claw': 'review',
  'tester-claw': 'tester',
  sidekick: 'pm',
  pm: 'pm',
  developer: 'dev',
  reviewer: 'review',
  tester: 'tester',
}

function mapAgentIdToRole(agentId: string): string {
  return AGENT_ID_ROLE_MAP[agentId] || 'dev'
}

function toGatewayAgent(agent: StatusAgentEntry): GatewayAgent {
  const name = agent.name || agent.id
  return {
    id: agent.id,
    name,
    identity: { name },
  }
}

function toGatewaySession(session: StatusSessionEntry): GatewaySession {
  const updatedAt = typeof session.updatedAt === 'number'
    ? new Date(session.updatedAt).toISOString()
    : undefined

  return {
    key: session.key,
    agentId: session.agentId || 'main',
    label: session.key,
    model: session.model || 'unknown',
    status: 'running',
    startedAt: updatedAt,
    endedAt: null,
    sessionId: session.sessionId ?? undefined,
    transcriptPath: session.transcriptPath ?? session.sessionFile ?? undefined,
    sessionFile: session.sessionFile ?? undefined,
    usage: {
      promptTokens: session.inputTokens ?? undefined,
      completionTokens: session.outputTokens ?? undefined,
      totalTokens: session.totalTokens ?? undefined,
    },
  }
}

function withTimeout<T>(promise: Promise<T>, method: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Gateway RPC timed out: ${method}`))
    }, GATEWAY_LIST_TIMEOUT_MS)
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
      ;(timer as { unref(): void }).unref()
    }
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

function readOpenClawStatusFromDisk(): OpenClawStatusJson | null {
  const root = path.join(os.homedir(), '.openclaw')
  const config = readJsonFile<OpenClawConfigJson>(path.join(root, 'openclaw.json'))
  const configuredAgents = config?.agents?.list ?? []
  const agentIds = new Set<string>(['main'])
  const agents: StatusAgentEntry[] = []

  for (const agent of configuredAgents) {
    if (!agent.id) continue
    agentIds.add(agent.id)
    agents.push({ id: agent.id, name: agent.name || agent.id })
  }

  const sessions: StatusSessionEntry[] = []
  for (const agentId of agentIds) {
    const storePath = path.join(root, 'agents', agentId, 'sessions', 'sessions.json')
    const store = readJsonFile<Record<string, Record<string, unknown>>>(storePath)
    if (!store) continue

    for (const [key, entry] of Object.entries(store)) {
      if (key === 'global' || key === 'unknown') continue
      sessions.push({
        key,
        agentId,
        model: typeof entry.model === 'string' ? entry.model : null,
        updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : null,
        sessionId: typeof entry.sessionId === 'string' ? entry.sessionId : null,
        transcriptPath: typeof entry.transcriptPath === 'string' ? entry.transcriptPath : null,
        sessionFile: typeof entry.sessionFile === 'string' ? entry.sessionFile : null,
        inputTokens: typeof entry.inputTokens === 'number' ? entry.inputTokens : null,
        outputTokens: typeof entry.outputTokens === 'number' ? entry.outputTokens : null,
        totalTokens: typeof entry.totalTokens === 'number' ? entry.totalTokens : null,
      })
    }
  }

  if (agents.length === 0 && sessions.length === 0) return null

  sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  return {
    agents: { agents },
    sessions: { recent: sessions },
  }
}

function isActiveSession(session: GatewaySession): boolean {
  if (session.endedAt === null) return true
  if (session.status?.includes('running')) return true
  return false
}

export class SessionSyncService {
  private client: OpenClawGatewayClient
  private statusSnapshot: OpenClawStatusJson | null = null
  private usingStatusFallback = false

  constructor(client?: OpenClawGatewayClient) {
    this.client = client || createGatewayClient()
  }

  async fetchAgents(): Promise<GatewayAgent[]> {
    try {
      const result = await withTimeout(
        this.client.call<{ agents: GatewayAgent[]; defaultId: string }>('agents.list'),
        'agents.list',
      )
      return result.agents || []
    } catch (error) {
      const status = await this.fetchOpenClawStatusJson(error)
      return status.agents?.agents?.map(toGatewayAgent) ?? []
    }
  }

  async fetchSessions(): Promise<GatewaySession[]> {
    try {
      const result = await withTimeout(
        this.client.call<{ sessions: GatewaySession[]; defaults: Record<string, unknown> }>('sessions.list'),
        'sessions.list',
      )
      return result.sessions || []
    } catch (error) {
      const status = await this.fetchOpenClawStatusJson(error)
      return status.sessions?.recent?.map(toGatewaySession) ?? []
    }
  }

  private async fetchOpenClawStatusJson(cause: unknown): Promise<OpenClawStatusJson> {
    if (this.statusSnapshot) return this.statusSnapshot

    try {
      const result = await execFileAsync('openclaw', ['status', '--json'], {
        timeout: 10_000,
        maxBuffer: 10 * 1024 * 1024,
      })
      const stdout = typeof result === 'string' ? result : result.stdout
      this.statusSnapshot = JSON.parse(stdout) as OpenClawStatusJson
      this.usingStatusFallback = true
      return this.statusSnapshot
    } catch (error) {
      if (error instanceof Error && 'stdout' in error && typeof error.stdout === 'string' && error.stdout.trim()) {
        this.statusSnapshot = JSON.parse(error.stdout) as OpenClawStatusJson
        this.usingStatusFallback = true
        return this.statusSnapshot
      }

      const diskStatus = readOpenClawStatusFromDisk()
      if (diskStatus) {
        this.statusSnapshot = diskStatus
        this.usingStatusFallback = true
        return this.statusSnapshot
      }

      const causeMessage = cause instanceof Error ? cause.message : String(cause)
      const fallbackMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`OpenClaw gateway RPC failed (${causeMessage}); openclaw status --json fallback failed (${fallbackMessage})`)
    }
  }

  mapToAgentInfo(agents: GatewayAgent[], sessions: GatewaySession[]): AgentInfo[] {
    const activeSessionAgentIds = new Set<string>()
    for (const session of sessions) {
      if (isActiveSession(session)) {
        activeSessionAgentIds.add(session.agentId)
      }
    }

    return agents.map(agent => ({
      id: agent.id,
      name: agent.identity?.name || agent.name || agent.id,
      role: mapAgentIdToRole(agent.id),
      status: activeSessionAgentIds.has(agent.id) ? 'busy' as const : 'idle' as const,
      emotion: 'neutral',
      currentTask: null,
      latestResultSummary: null,
    }))
  }

  getDefaultAgents(): AgentInfo[] {
    return createDefaultAgents()
  }

  isUsingStatusFallback(): boolean {
    return this.usingStatusFallback
  }
}

export function getDefaultAgents(): AgentInfo[] {
  return createDefaultAgents()
}
