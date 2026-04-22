'use client'

import { useMemo } from 'react'

import { useOpenClawSnapshot } from './useOpenClawSnapshot'

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

interface UseOpenClawMetricsResult {
  metrics: OpenClawMetrics | null
  loading: boolean
  error: string | null
  source: 'gateway' | 'fallback' | null
  refresh: () => void
}

const FALLBACK_METRICS: OpenClawMetrics = {
  agents: { total: 0, active: 0, idle: 0, byRole: {} },
  sessions: { total: 0, active: 0, completed: 0, failed: 0 },
  tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  source: 'fallback',
  fetchedAt: new Date().toISOString(),
}

export function useOpenClawMetrics(): UseOpenClawMetricsResult {
  const snapshot = useOpenClawSnapshot()

  return useMemo(() => {
    const metrics = snapshot.metrics ? {
      ...snapshot.metrics,
      source: snapshot.metrics.source,
    } : FALLBACK_METRICS

    return {
      metrics,
      loading: snapshot.loading,
      error: snapshot.error,
      source: metrics.source,
      refresh: snapshot.refresh,
    }
  }, [snapshot])
}
