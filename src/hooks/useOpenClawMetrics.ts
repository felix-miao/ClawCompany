'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface OpenClawMetrics {
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

interface MetricsResponse {
  success: boolean
  metrics: OpenClawMetrics
  error?: string
}

interface UseOpenClawMetricsResult {
  metrics: OpenClawMetrics | null
  loading: boolean
  error: string | null
  source: 'gateway' | 'fallback' | null
  refresh: () => void
}

const POLL_INTERVAL = 30000

const FALLBACK_METRICS: OpenClawMetrics = {
  agents: { total: 0, active: 0, idle: 0, byRole: {} },
  sessions: { total: 0, active: 0, completed: 0, failed: 0 },
  tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  source: 'fallback',
  fetchedAt: new Date().toISOString(),
}

export function useOpenClawMetrics(): UseOpenClawMetricsResult {
  const [metrics, setMetrics] = useState<OpenClawMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'gateway' | 'fallback' | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/openclaw/metrics', {
        headers: { 'x-api-key': 'dashboard' },
      })
      const data: MetricsResponse = await response.json()

      if (data.success && data.metrics) {
        setMetrics(data.metrics)
        setSource(data.metrics.source)
        setError(data.error || null)
      } else {
        setMetrics(FALLBACK_METRICS)
        setSource('fallback')
        setError(data.error || 'Failed to fetch metrics')
      }
    } catch (err) {
      setMetrics(FALLBACK_METRICS)
      setSource('fallback')
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

  return { metrics, loading, error, source, refresh }
}
