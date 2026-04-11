'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

import { DashboardStore } from '@/game/data/DashboardStore';
import { parseGameEvent, GameEventType } from '@/game/types/GameEvents';

interface UseEventStreamOptions {
  url?: string;
  enabled?: boolean;
}

interface UseEventStreamResult {
  isConnected: boolean;
  isReconnecting: boolean;
}

// All named SSE event types from GameEvents.ts
const NAMED_EVENT_TYPES: GameEventType[] = [
  'agent:status-change',
  'agent:task-assigned',
  'agent:task-completed',
  'agent:navigation-request',
  'agent:emotion-change',
  'session:started',
  'session:completed',
  'session:progress',
  'connection:open',
  'connection:close',
  'connection:error',
  'task:assigned',
  'task:progress',
  'task:completed',
  'task:failed',
  'task:handover',
  'openclaw:send',
  'pm:analysis-complete',
  'dev:iteration-start',
  'review:rejected',
  'workflow:iteration-complete',
  'cost:update',
  'cost:budget-exceeded',
];

const MIN_BACKOFF_MS = 3000;  // 3s initial retry delay
const MAX_BACKOFF_MS = 30000;
const MAX_RETRIES = 5;        // give up after 5 consecutive failures

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

    // Build URL with ?since= carrying the last known event id.
    // The browser EventSource API doesn't support custom request headers, so we
    // pass the id as a query param; the server accepts it as the fallback for
    // the native Last-Event-ID header (which the browser sends automatically on
    // reconnect when the previous EventSource received an `id:` field).
    const buildUrl = (base: string, since?: number): string => {
      const params = new URLSearchParams();
      if (since !== undefined) params.set('since', String(since));
      const qs = params.toString();
      return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
    };

    const connectUrl =
      lastEventTimestampRef.current !== null
        ? buildUrl(url, lastEventTimestampRef.current)
        : buildUrl(url);

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
      // Track the SSE id field for Last-Event-ID reconnect
      if (event.lastEventId) {
        const ts = parseInt(event.lastEventId, 10);
        if (!isNaN(ts)) lastEventTimestampRef.current = ts;
      }
      const gameEvent = parseGameEvent(event.data);
      if (gameEvent) {
        if (gameEvent.timestamp != null) lastEventTimestampRef.current = gameEvent.timestamp;
        storeRef.current.processEvent(gameEvent);
      }
    };

    // Register listeners for all named SSE event types
    for (const eventType of NAMED_EVENT_TYPES) {
      es.addEventListener(eventType, (event: MessageEvent) => {
        if (unmountedRef.current) return;
        // Track the SSE id field for Last-Event-ID reconnect
        if (event.lastEventId) {
          const ts = parseInt(event.lastEventId, 10);
          if (!isNaN(ts)) lastEventTimestampRef.current = ts;
        }
        const gameEvent = parseGameEvent(event.data);
        if (gameEvent) {
          if (gameEvent.timestamp != null) lastEventTimestampRef.current = gameEvent.timestamp;
          storeRef.current.processEvent(gameEvent);
        }
      });
    }

    es.onerror = () => {
      if (unmountedRef.current) return;
      setIsConnected(false);
      es.close();
      eventSourceRef.current = null;

      if (retryCountRef.current >= MAX_RETRIES) {
        // Exhausted retries — stop reconnecting
        setIsReconnecting(false);
        storeRef.current.processEvent({
          type: 'connection:error',
          timestamp: Date.now(),
          message: `SSE gave up after ${MAX_RETRIES} retries`,
        } as never);
        return;
      }

      // Exponential backoff: 3s → 6s → 12s → 24s → 30s (capped)
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
