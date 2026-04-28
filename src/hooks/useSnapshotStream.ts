'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { AgentInfo, TaskHistory } from '@/game/data/DashboardStore'
import type { OpenClawSessionDetails, OpenClawSnapshot, OpenClawSnapshotMetrics } from '@/lib/gateway/openclaw-snapshot'
import type { OpenClawSnapshotDiff } from '@/lib/gateway/snapshot-diff'

interface SnapshotResponse extends OpenClawSnapshot {
  success?: boolean
  error?: string
}

interface SnapshotStreamState {
  agents: AgentInfo[]
  sessions: OpenClawSessionDetails[]
  tasks: TaskHistory[]
  metrics: OpenClawSnapshotMetrics | null
  connected: boolean
  loading: boolean
  error: string | null
  refresh: () => void
}

const STREAM_URL = '/api/openclaw/snapshot/stream'
const SNAPSHOT_URL = '/api/openclaw/snapshot'
const MIN_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000

function mergeById<T>(current: T[], changed: T[] | undefined, removed: string[] | undefined, getId: (item: T) => string): T[] {
  const removedIds = new Set(removed ?? [])
  const changedById = new Map((changed ?? []).map(item => [getId(item), item]))
  const merged = current
    .filter(item => !removedIds.has(getId(item)))
    .map(item => changedById.get(getId(item)) ?? item)

  for (const item of changed ?? []) {
    if (!current.some(existing => getId(existing) === getId(item))) {
      merged.push(item)
    }
  }

  return merged
}

export function useSnapshotStream(): SnapshotStreamState {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [sessions, setSessions] = useState<OpenClawSessionDetails[]>([])
  const [tasks, setTasks] = useState<TaskHistory[]>([])
  const [metrics, setMetrics] = useState<OpenClawSnapshotMetrics | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reconnectToken, setReconnectToken] = useState(0)

  const eventSourceRef = useRef<EventSource | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const unmountedRef = useRef(false)

  const applyFullSnapshot = useCallback((snapshot: OpenClawSnapshot) => {
    setAgents(snapshot.agents ?? [])
    setSessions(snapshot.sessions ?? [])
    setTasks(snapshot.tasks ?? [])
    setMetrics(snapshot.metrics ?? null)
    setConnected(Boolean(snapshot.connected))
    setError(null)
    setLoading(false)
  }, [])

  const fetchFallbackSnapshot = useCallback(async () => {
    try {
      const response = await fetch(SNAPSHOT_URL, {
        headers: { 'x-api-key': 'dashboard' },
      })
      const snapshot: SnapshotResponse = await response.json()

      if (snapshot.success === false) {
        throw new Error(snapshot.error ?? 'Snapshot fallback failed')
      }

      applyFullSnapshot(snapshot)
      setConnected(false)
    } catch (err) {
      setConnected(false)
      setError(err instanceof Error ? err.message : 'Snapshot fallback failed')
      setLoading(false)
    }
  }, [applyFullSnapshot])

  const applyDiff = useCallback((diff: OpenClawSnapshotDiff) => {
    if (diff.agents) {
      setAgents(current => mergeById(current, diff.agents?.changed, diff.agents?.removed, agent => agent.id))
    }
    if (diff.sessions) {
      setSessions(current => mergeById(current, diff.sessions?.changed, diff.sessions?.removed, session => session.sessionKey))
    }
    if (diff.tasks) {
      setTasks(current => mergeById(current, diff.tasks?.changed, diff.tasks?.removed, task => task.taskId))
    }
    if (diff.metrics) {
      setMetrics(diff.metrics)
    }
    if (typeof diff.connected === 'boolean') {
      setConnected(diff.connected)
    }
    setError(null)
    setLoading(false)
  }, [])

  const refresh = useCallback(() => {
    setLoading(true)
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    retryCountRef.current = 0
    setReconnectToken(token => token + 1)
  }, [])

  useEffect(() => {
    unmountedRef.current = false

    const connect = () => {
      if (unmountedRef.current) return

      const source = new EventSource(STREAM_URL)
      eventSourceRef.current = source

      source.onopen = () => {
        if (unmountedRef.current) return
        retryCountRef.current = 0
        setConnected(true)
        setError(null)
      }

      source.addEventListener('snapshot-full', (event) => {
        if (unmountedRef.current) return
        try {
          applyFullSnapshot(JSON.parse((event as MessageEvent).data))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Invalid snapshot payload')
          setLoading(false)
        }
      })

      source.addEventListener('snapshot-diff', (event) => {
        if (unmountedRef.current) return
        try {
          applyDiff(JSON.parse((event as MessageEvent).data))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Invalid snapshot diff payload')
          setLoading(false)
        }
      })

      source.addEventListener('snapshot-error', (event) => {
        if (unmountedRef.current) return
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { error?: string }
          setError(payload.error ?? 'Snapshot stream unavailable')
        } catch {
          setError('Snapshot stream unavailable')
        }
        void fetchFallbackSnapshot()
      })

      source.onerror = () => {
        if (unmountedRef.current) return
        setConnected(false)
        setError('Snapshot stream disconnected')
        source.close()
        eventSourceRef.current = null
        void fetchFallbackSnapshot()

        const backoffMs = Math.min(MIN_BACKOFF_MS * Math.pow(2, retryCountRef.current), MAX_BACKOFF_MS)
        retryCountRef.current += 1
        retryTimerRef.current = setTimeout(connect, backoffMs)
      }
    }

    connect()

    return () => {
      unmountedRef.current = true
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [applyDiff, applyFullSnapshot, fetchFallbackSnapshot, reconnectToken])

  return { agents, sessions, tasks, metrics, connected, loading, error, refresh }
}
