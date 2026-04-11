import { NextRequest } from 'next/server';

import { requireApiKey, getClientId, withAuth, withRateLimit, successResponse } from '@/lib/api/route-utils';
import { GameEventPostSchema, parseRequestBody } from '@/lib/api/schemas';
import { getGameEventStore } from '@/game/data/GameEventStore';
import type { GameEvent } from '@/game/types/GameEvents';
import { getSessionPoller } from '@/lib/gateway/session-poller';

// ── SSE 连接计数器 ────────────────────────────────────────────
// ⚠️  注意：Vercel 多 Worker 环境下，此计数器仅在单个 Worker 进程内有效。
//   多 Worker 场景需要 Redis 原子计数（待 P0-1 Redis PR 实现后替换）。
//   单容器/Docker 部署（--replicas 1）时计数器完全有效。
const MAX_SSE_CONNECTIONS = 100;
const MAX_SSE_PER_IP = 5;
const activeConnections = new Map<string, number>(); // ip → count
let totalConnections = 0;

function acquireConnection(ip: string): boolean {
  if (totalConnections >= MAX_SSE_CONNECTIONS) return false;
  const ipCount = activeConnections.get(ip) ?? 0;
  if (ipCount >= MAX_SSE_PER_IP) return false;
  activeConnections.set(ip, ipCount + 1);
  totalConnections++;
  return true;
}

function releaseConnection(ip: string): void {
  const ipCount = activeConnections.get(ip) ?? 0;
  if (ipCount <= 1) {
    activeConnections.delete(ip);
  } else {
    activeConnections.set(ip, ipCount - 1);
  }
  totalConnections = Math.max(0, totalConnections - 1);
}

// ── GET：SSE 端点（需认证 + 连接限制）───────────────────────
export async function GET(request: NextRequest) {
  // 1. API Key 认证（SSE 兼容模式）
  // EventSource 无法发送自定义 Header，因此同时支持：
  //   - Header: X-Api-Key / Authorization: Bearer <key>
  //   - Query param: ?token=<key>
  // 若 AGENT_API_KEY 未配置（本地开发），跳过认证。
  const apiKey = process.env.AGENT_API_KEY;
  if (apiKey) {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get('token');
    const headerKey =
      request.headers.get('x-api-key') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const providedKey = queryToken || headerKey;

    if (!providedKey) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // timing-safe compare
    const { timingSafeEqual } = await import('crypto');
    const a = Buffer.from(providedKey);
    const b = Buffer.from(apiKey);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 2. per-IP 连接数限制（最多 5 个并发 SSE 连接）
  const ip = getClientId(request);
  if (!acquireConnection(ip)) {
    return new Response('Too Many Connections', {
      status: 503,
      headers: { 'Retry-After': '10' },
    });
  }

  const store = getGameEventStore();
  const encoder = new TextEncoder();

  const url = new URL(request.url);
  const lastEventId = request.headers.get('Last-Event-ID') || url.searchParams.get('since');

  let connectionReleased = false;
  function safeReleaseConnection() {
    if (!connectionReleased) {
      connectionReleased = true;
      releaseConnection(ip);
    }
  }

  let stream: ReadableStream;
  try {
    stream = new ReadableStream({
      start(controller) {
        const poller = getSessionPoller(store);
        if (!poller.isRunning()) {
          poller.start();
        }

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
            unsubscribe();
          }
        });

        const keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            clearInterval(keepalive);
            unsubscribe();
          }
        }, 30000);

        // 3. 断开时清理连接计数
        request.signal.addEventListener('abort', () => {
          clearInterval(keepalive);
          unsubscribe();
          safeReleaseConnection();
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
      },
      cancel() {
        // Ensure connection is released if the stream is cancelled for any reason
        safeReleaseConnection();
      },
    });
  } catch (err) {
    // If stream construction itself throws, release the acquired connection slot
    safeReleaseConnection();
    throw err;
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

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
