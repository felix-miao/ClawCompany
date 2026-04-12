'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

import { DashboardStore } from '@/game/data/DashboardStore';
import { parseGameEvent, NAMED_GAME_EVENT_TYPES } from '@/game/types/GameEvents';

interface UseEventStreamOptions {
  url?: string;
  enabled?: boolean;
}

interface UseEventStreamResult {
  isConnected: boolean;
  isReconnecting: boolean;
}

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

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
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventTimestampRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    // Build URL with ?since= for resume after disconnect
    const connectUrl =
      lastEventTimestampRef.current !== null
        ? `${url}${url.includes('?') ? '&' : '?'}since=${lastEventTimestampRef.current}`
        : url;

    const es = new EventSource(connectUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (unmountedRef.current) return;
      setIsConnected(true);
      setIsReconnecting(false);
      retryCountRef.current = 0;
      storeRef.current.processEvent({
        type: 'connection:open',
        timestamp: Date.now(),
        url: connectUrl,
      });
    };

    // Handle generic (unnamed) messages
    es.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current) return;
      const gameEvent = parseGameEvent(event.data);
      if (gameEvent) {
        lastEventTimestampRef.current = gameEvent.timestamp;
        storeRef.current.processEvent(gameEvent);
      }
    };

    // Register listeners for all named SSE event types
    for (const eventType of NAMED_GAME_EVENT_TYPES) {
      es.addEventListener(eventType, (event: MessageEvent) => {
        if (unmountedRef.current) return;
        const gameEvent = parseGameEvent(event.data);
        if (gameEvent) {
          lastEventTimestampRef.current = gameEvent.timestamp;
          storeRef.current.processEvent(gameEvent);
        }
      });
    }

    es.onerror = () => {
      if (unmountedRef.current) return;
      setIsConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff: 1s → 2s → 4s → 8s → … → max 30s
      const backoffMs = Math.min(
        MIN_BACKOFF_MS * Math.pow(2, retryCountRef.current),
        MAX_BACKOFF_MS
      );
      retryCountRef.current += 1;
      setIsReconnecting(true);

      retryTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          connect();
        }
      }, backoffMs);
    };
  }, [url]);

  useEffect(() => {
    if (!enabled) return;
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      setIsReconnecting(false);
    };
  }, [url, enabled, connect]);

  return { isConnected, isReconnecting };
}
