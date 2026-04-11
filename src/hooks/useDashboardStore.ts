'use client';

import { useSyncExternalStore, useRef } from 'react';

import { DashboardStore, AgentInfo, DashboardStats, CostSummary } from '@/game/data/DashboardStore';
import { GameEvent } from '@/game/types/GameEvents';

export interface DashboardState {
  agents: AgentInfo[];
  events: GameEvent[];
  stats: DashboardStats;
  cost: CostSummary;
}

export function useDashboardStore(store: DashboardStore): DashboardState {
  const cacheRef = useRef<DashboardState | null>(null);
  const versionRef = useRef(0);

  const subscribe = (callback: () => void) => {
    return store.subscribe(callback);
  };

  const getSnapshot = (): DashboardState => {
    const newVersion = store.getStats().totalEvents;
    if (cacheRef.current && versionRef.current === newVersion) {
      return cacheRef.current;
    }
    versionRef.current = newVersion;
    const snapshot: DashboardState = {
      agents: store.getAgents(),
      events: store.getEvents(),
      stats: store.getStats(),
      cost: store.getCostSummary(),
    };
    cacheRef.current = snapshot;
    return snapshot;
  };

  const emptyState: DashboardState = {
    agents: [],
    events: [],
    stats: { totalEvents: 0, activeTasks: 0, sessionCount: 0, completedSessionCount: 0, connected: false },
    cost: { sessions: new Map(), totalTokens: 0, totalCostUsd: 0, activeBudget: 0, activeRemaining: 0, budgetExceeded: false },
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => emptyState);
}
