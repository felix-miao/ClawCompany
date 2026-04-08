'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

import { DashboardStore } from '@/game/data/DashboardStore';
import { parseGameEvent } from '@/game/types/GameEvents';

interface UseEventStreamOptions {
  url?: string;
  enabled?: boolean;
}

interface UseEventStreamResult {
  isConnected: boolean;
  isReconnecting: boolean;
}

export function useEventStream(
  store: DashboardStore,
  options: UseEventStreamOptions = {}
): UseEventStreamResult {
  const { url = '/api/game-events', enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  const handleMessage = useCallback((event: MessageEvent) => {
    const gameEvent = parseGameEvent(event.data);
    if (gameEvent) {
      storeRef.current.processEvent(gameEvent);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      storeRef.current.processEvent({
        type: 'connection:open',
        timestamp: Date.now(),
        url,
      });
    };

    es.onmessage = handleMessage;

    es.onerror = () => {
      setIsConnected(false);
      setIsReconnecting(true);
      es.close();
      eventSourceRef.current = null;
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [url, enabled, handleMessage]);

  return { isConnected, isReconnecting };
}
