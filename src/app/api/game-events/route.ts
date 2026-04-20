import { NextRequest } from 'next/server';
import { getClientId, withAuth, withRateLimit, successResponse } from '@/lib/api/route-utils';
import { GameEventPostSchema, parseRequestBody } from '@/lib/api/schemas';
import { getGameEventStore } from '@/game/data/GameEventStore';
import type { GameEvent } from '@/game/types/GameEvents';
import { getSessionPoller } from '@/lib/gateway/session-poller';
import {
  acquireConnection as ac,
  releaseConnection as rc,
  resetConnectionCounters as rcc,
  getConnectionStats as gcs,
} from '@/lib/gateway/sse-connections';

export { acquireConnection, releaseConnection } from '@/lib/gateway/sse-connections';

let sseSubscriberCount = 0;

function acquireConnectionWrapped(ip: string): boolean {
  const result = ac(ip);
  if (result && process.env.NODE_ENV === 'development') {
    const stats = gcs();
    console.log(`[SSE] acquireConnection ip=${ip} totalConnections=${stats.totalConnections} sseSubscriberCount=${sseSubscriberCount}`);
  }
  return result;
}

function releaseConnectionWrapped(ip: string): void {
  rc(ip);
  if (process.env.NODE_ENV === 'development') {
    const stats = gcs();
    console.log(`[SSE] releaseConnection ip=${ip} totalConnections=${stats.totalConnections} sseSubscriberCount=${sseSubscriberCount}`);
  }
}

export function resetConnectionCounters(): void {
  rcc();
  sseSubscriberCount = 0;
}

export function getConnectionStats() {
  return {
    ...gcs(),
    sseSubscriberCount,
  };
}

const handleGet = async (request: NextRequest) => {
  const ip = getClientId(request);
  if (!acquireConnectionWrapped(ip)) {
    return new Response('Too Many Connections', {
      status: 503,
      headers: { 'Retry-After': '10' },
    });
  }

  const store = getGameEventStore();
  const encoder = new TextEncoder();

  const url = new URL(request.url);
  const lastEventId = request.headers.get('Last-Event-ID') || url.searchParams.get('since');

  const stream = new ReadableStream({
    start(controller) {
      const poller = getSessionPoller(store);
      sseSubscriberCount += 1;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SSE] open  ip=${ip} sseSubscriberCount=${sseSubscriberCount} totalConnections=${gcs().totalConnections} pollerRunning=${poller.isRunning()}`);
      }
      if (!poller.isRunning()) {
        poller.start();
      }

      let cleanedUp = false;

      const sendEvent = (data: unknown, eventType?: string, id?: string) => {
        let message = `data: ${JSON.stringify(data)}\n`;
        if (eventType) message = `event: ${eventType}\n${message}`;
        if (id) message += `id: ${id}\n`;
        message += '\n';
        controller.enqueue(encoder.encode(message));
      };

      sendEvent(
        { type: 'connection:open', timestamp: Date.now(), url: request.url },
        'connection',
        String(Date.now())
      );

      if (lastEventId) {
        const since = parseInt(lastEventId, 10);
        if (!isNaN(since)) {
          const missedEvents = store.getEvents(since);
          for (const event of missedEvents) {
            sendEvent(event, event.type, String(event.timestamp));
          }
        }
      }

      const unsubscribe = store.subscribe((event) => {
        try {
          sendEvent(event, event.type, String(event.timestamp));
        } catch {
          cleanup();
        }
      });

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          cleanup();
        }
      }, 30000);
      if (typeof keepalive === 'object' && keepalive !== null && 'unref' in keepalive) {
        (keepalive as { unref(): void }).unref();
      }

      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;

        clearInterval(keepalive);
        unsubscribe();
        releaseConnectionWrapped(ip);
        sseSubscriberCount = Math.max(0, sseSubscriberCount - 1);
        if (sseSubscriberCount === 0) {
          poller.stop();
        }
        if (process.env.NODE_ENV === 'development') {
          console.log(`[SSE] close ip=${ip} sseSubscriberCount=${sseSubscriberCount} totalConnections=${gcs().totalConnections} pollerRunning=${poller.isRunning()}`);
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener('abort', () => {
        cleanup();
      }, { once: true });
    },
    cancel() {
      // cleanup already handled by abort signal
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};

export const GET = withAuth(handleGet);

export const POST = withAuth(withRateLimit(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = parseRequestBody(GameEventPostSchema, body);
  if ('error' in parsed) return parsed.error;

  const store = getGameEventStore();

  const event = {
    ...parsed.data,
    timestamp: parsed.data.timestamp ?? Date.now(),
  } as GameEvent;

  store.push(event);

  return successResponse({ event }, request);
}, 'Game Events API'));