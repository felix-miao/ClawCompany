'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { AgentInfo, TaskHistory } from '@/game/data/DashboardStore'
import type { OpenClawSessionDetails, OpenClawSnapshot, OpenClawSnapshotMetrics } from '@/lib/gateway/openclaw-snapshot'
import type { OpenClawSnapshotDiff } from '@/lib/gateway/snapshot-diff'

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
const MIN_BACKOFF_MS = 15000
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
  const fallbackSnapshotRef = useRef<Promise<void> | null>(null)
  const hasStreamSnapshotRef = useRef(false)

  const applyFullSnapshot = useCallback((snapshot: OpenClawSnapshot) => {
    hasStreamSnapshotRef.current = true
    setAgents(snapshot.agents ?? [])
    setSessions(snapshot.sessions ?? [])
    setTasks(snapshot.tasks ?? [])
    setMetrics(snapshot.metrics ?? null)
    setConnected(Boolean(snapshot.connected))
    setError(null)
    setLoading(false)
  }, [])

  const applyDiff = useCallback((diff: OpenClawSnapshotDiff) => {
    hasStreamSnapshotRef.current = true
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

  const fetchFallbackSnapshot = useCallback(async (fallbackError: string) => {
    if (fallbackSnapshotRef.current) return fallbackSnapshotRef.current

    const request = (async () => {
      try {
        const response = await fetch(SNAPSHOT_URL, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Snapshot fallback failed with ${response.status}`)
        }
        const snapshot = await response.json() as OpenClawSnapshot
        if (!unmountedRef.current) {
          applyFullSnapshot(snapshot)
        }
      } catch (err) {
        if (!unmountedRef.current) {
          setError(err instanceof Error ? err.message : fallbackError)
          setLoading(false)
        }
      } finally {
        fallbackSnapshotRef.current = null
      }
    })()

    fallbackSnapshotRef.current = request
    return request
  }, [applyFullSnapshot])

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

    const scheduleReconnect = (source: EventSource) => {
      if (eventSourceRef.current !== source) return
      setConnected(false)
      setError('Snapshot stream disconnected')
      source.close()
      eventSourceRef.current = null
      if (!hasStreamSnapshotRef.current) {
        void fetchFallbackSnapshot('Snapshot stream disconnected')
      }

      const backoffMs = Math.min(MIN_BACKOFF_MS * Math.pow(2, retryCountRef.current), MAX_BACKOFF_MS)
      retryCountRef.current += 1
      retryTimerRef.current = setTimeout(connect, backoffMs)
    }

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

      source.addEventListener('snapshot-error', () => {
        if (unmountedRef.current) return
        scheduleReconnect(source)
      })

      source.onerror = () => {
        if (unmountedRef.current) return
        scheduleReconnect(source)
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
