import { getConnectionStats as gcs, acquireConnection as ac, releaseConnection as rc, resetConnectionCounters as rcc } from '@/lib/gateway/sse-connections'
import { createLogger } from '@/lib/core/logger'

let sseSubscriberCount = 0
const logger = createLogger('game-events-route-helpers')

export function acquireConnection(ip: string): boolean {
  const result = ac(ip)
  if (result && process.env.NODE_ENV === 'development') {
    const stats = gcs()
    logger.debug('[SSE] acquireConnection', { ip, totalConnections: stats.totalConnections, sseSubscriberCount })
  }
  return result
}

export function releaseConnection(ip: string): void {
  rc(ip)
  if (process.env.NODE_ENV === 'development') {
    const stats = gcs()
    logger.debug('[SSE] releaseConnection', { ip, totalConnections: stats.totalConnections, sseSubscriberCount })
  }
}

export function resetSseSubscriberCount(): void {
  sseSubscriberCount = 0
}

export function incrementSseSubscriberCount(): number {
  sseSubscriberCount += 1
  return sseSubscriberCount
}

export function decrementSseSubscriberCount(): number {
  sseSubscriberCount = Math.max(0, sseSubscriberCount - 1)
  return sseSubscriberCount
}

export function getSseSubscriberCount(): number {
  return sseSubscriberCount
}

export function resetConnectionCounters(): void {
  rcc()
  resetSseSubscriberCount()
}

export function getConnectionStats() {
  return {
    ...gcs(),
    sseSubscriberCount,
  }
}
