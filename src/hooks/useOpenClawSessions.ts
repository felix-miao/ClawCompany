'use client'

import { useEffect, useRef } from 'react'

import { DashboardStore } from '@/game/data/DashboardStore'

import { useOpenClawSnapshot } from './useOpenClawSnapshot'

interface UseOpenClawSessionsResult {
  connected: boolean
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useOpenClawSessions(store: DashboardStore): UseOpenClawSessionsResult {
  const storeRef = useRef(store)
  storeRef.current = store
  const snapshot = useOpenClawSnapshot()

  useEffect(() => {
    if (snapshot.agents.length > 0) {
      storeRef.current.loadAgents(snapshot.agents)
    }
  }, [snapshot.agents])

  return {
    connected: snapshot.connected,
    loading: snapshot.loading,
    error: snapshot.error,
    refresh: snapshot.refresh,
  }
}
