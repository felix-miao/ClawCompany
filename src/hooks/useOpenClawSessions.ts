'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

import { DashboardStore, AgentInfo } from '@/game/data/DashboardStore'

interface UseOpenClawSessionsResult {
  connected: boolean
  loading: boolean
  error: string | null
  refresh: () => void
}

interface SessionsResponse {
  success: boolean
  agents: AgentInfo[]
  sessions: Array<{
    key: string
    agentId: string
    label: string
    model: string
    status: string
    endedAt: string | null
  }>
  connected: boolean
  error?: string
}

const POLL_INTERVAL = 30000

export function useOpenClawSessions(store: DashboardStore): UseOpenClawSessionsResult {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const storeRef = useRef(store)
  storeRef.current = store
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/openclaw/sessions', {
        headers: { 'x-api-key': 'dashboard' },
      })
      const data: SessionsResponse = await response.json()

      if (data.success && data.connected) {
        storeRef.current.loadAgents(data.agents)
        setConnected(true)
        setError(null)
      } else {
        setConnected(false)
        setError(data.error || 'Gateway not connected')
        if (data.agents && data.agents.length > 0) {
          storeRef.current.loadAgents(data.agents)
        }
      }
    } catch (err) {
      setConnected(false)
      setError(err instanceof Error ? err.message : 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()

    timerRef.current = setInterval(fetchData, POLL_INTERVAL)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [fetchData])

  return { connected, loading, error, refresh }
}
