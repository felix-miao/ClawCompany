import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/api/route-utils';
import { getGameEventStore } from '@/game/data/GameEventStore';

export async function GET(request: NextRequest) {
  const store = getGameEventStore();
  const encoder = new TextEncoder();

  const url = new URL(request.url);
  const lastEventId = request.headers.get('Last-Event-ID') || url.searchParams.get('since');

  const stream = new ReadableStream({
    start(controller) {
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

      request.signal.addEventListener('abort', () => {
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
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
}

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();

    if (!body || !body.type) {
      return NextResponse.json(
        { success: false, error: 'Event type is required' },
        { status: 400 }
      );
    }

    const store = getGameEventStore();

    const event = {
      ...body,
      timestamp: body.timestamp ?? Date.now(),
    };

    store.push(event);

    return NextResponse.json({ success: true, event }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid request body',
      },
      { status: 400 }
    );
  }
});

