'use client';

import { useSyncExternalStore, useRef } from 'react';
import { DashboardStore, AgentInfo, DashboardStats } from '@/game/data/DashboardStore';
import { GameEvent } from '@/game/types/GameEvents';

export interface DashboardState {
  agents: AgentInfo[];
  events: GameEvent[];
  stats: DashboardStats;
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
    };
    cacheRef.current = snapshot;
    return snapshot;
  };

  return useSyncExternalStore(subscribe, getSnapshot);
}
