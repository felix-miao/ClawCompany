import { NextRequest } from 'next/server'

import { withAuth } from '@/lib/api/route-utils'
import { getCachedOpenClawSnapshot } from '@/lib/gateway/snapshot-cache'
import { computeOpenClawSnapshotDiff } from '@/lib/gateway/snapshot-diff'
import { SessionSyncService } from '@/lib/gateway/session-sync'
import type { OpenClawSnapshot } from '@/lib/gateway/openclaw-snapshot'

const SNAPSHOT_CHECK_INTERVAL_MS = 5000
const KEEPALIVE_INTERVAL_MS = 30000

function unrefTimer(timer: ReturnType<typeof setInterval>): void {
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
    ;(timer as { unref(): void }).unref()
  }
}

function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

async function handleGet(request: NextRequest): Promise<Response> {
  const encoder = new TextEncoder()
  const sync = new SessionSyncService()

  const stream = new ReadableStream({
    start(controller) {
      let latestSnapshot: OpenClawSnapshot | null = null
      let cleanedUp = false

      const enqueue = (message: string) => {
        controller.enqueue(encoder.encode(message))
      }

      const cleanup = () => {
        if (cleanedUp) return
        cleanedUp = true
        clearInterval(checkTimer)
        clearInterval(keepaliveTimer)
        try {
          controller.close()
        } catch {
          // Stream may already be closed by the client.
        }
      }

      const sendInitialSnapshot = async () => {
        try {
          latestSnapshot = await getCachedOpenClawSnapshot(sync)
          if (!cleanedUp) {
            enqueue(formatSseEvent('snapshot-full', latestSnapshot))
          }
        } catch (error) {
          if (!cleanedUp) {
            controller.error(error)
            cleanup()
          }
        }
      }

      const checkForDiff = async () => {
        if (cleanedUp || !latestSnapshot) return

        try {
          const nextSnapshot = await getCachedOpenClawSnapshot(sync)
          const diff = computeOpenClawSnapshotDiff(latestSnapshot, nextSnapshot)
          latestSnapshot = nextSnapshot
          if (diff && !cleanedUp) {
            enqueue(formatSseEvent('snapshot-diff', diff))
          }
        } catch (error) {
          if (!cleanedUp) {
            controller.error(error)
            cleanup()
          }
        }
      }

      const checkTimer = setInterval(() => {
        void checkForDiff()
      }, SNAPSHOT_CHECK_INTERVAL_MS)
      unrefTimer(checkTimer)

      const keepaliveTimer = setInterval(() => {
        try {
          enqueue(': keepalive\n\n')
        } catch {
          cleanup()
        }
      }, KEEPALIVE_INTERVAL_MS)
      unrefTimer(keepaliveTimer)

      request.signal.addEventListener('abort', cleanup, { once: true })
      void sendInitialSnapshot()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export const GET = withAuth(handleGet, 'OpenClaw Snapshot Stream API')
