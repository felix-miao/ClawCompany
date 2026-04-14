'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { AgentInfo, TaskHistory } from '@/game/data/DashboardStore'
import { OpenClawSnapshotMetrics } from '@/lib/gateway/openclaw-snapshot'

interface OpenClawSessionDetails {
  sessionKey: string
  agentId: string
  agentName: string
  role: string
  label: string
  model: string
  status: string
  startedAt: string
  endedAt: string | null
  currentWork: string | null
  latestThought: string | null
  latestResultSummary: string | null
  latestMessage: string | null
  latestMessageRole: 'user' | 'assistant' | 'toolResult' | null
  latestMessageStatus: 'pending' | 'running' | 'completed' | 'failed' | null
}

interface SnapshotResponse {
  success: boolean
  agents: AgentInfo[]
  sessions: OpenClawSessionDetails[]
  tasks: TaskHistory[]
  metrics: OpenClawSnapshotMetrics
  connected: boolean
  error?: string
  fetchedAt: string
}

interface OpenClawSnapshotState {
  agents: AgentInfo[]
  sessions: OpenClawSessionDetails[]
  tasks: TaskHistory[]
  metrics: OpenClawSnapshotMetrics | null
  connected: boolean
  loading: boolean
  error: string | null
  refresh: () => void
}

const POLL_INTERVAL = 30000

export function useOpenClawSnapshot(): OpenClawSnapshotState {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [sessions, setSessions] = useState<OpenClawSessionDetails[]>([])
  const [tasks, setTasks] = useState<TaskHistory[]>([])
  const [metrics, setMetrics] = useState<OpenClawSnapshotMetrics | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSnapshot = useCallback(async () => {
    try {
      const response = await fetch('/api/openclaw/snapshot', {
        headers: { 'x-api-key': 'dashboard' },
      })
      const data: SnapshotResponse = await response.json()

      setAgents(data.agents ?? [])
      setSessions(data.sessions ?? [])
      setTasks(data.tasks ?? [])
      setMetrics(data.metrics ?? null)
      setConnected(Boolean(data.connected))
      setError(data.error ?? null)
    } catch (err) {
      setConnected(false)
      setError(err instanceof Error ? err.message : 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => {
    setLoading(true)
    fetchSnapshot()
  }, [fetchSnapshot])

  useEffect(() => {
    fetchSnapshot()
    timerRef.current = setInterval(fetchSnapshot, POLL_INTERVAL)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [fetchSnapshot])

  return { agents, sessions, tasks, metrics, connected, loading, error, refresh }
}
