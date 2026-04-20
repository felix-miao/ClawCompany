export const MAX_SSE_CONNECTIONS = 100
export const MAX_SSE_PER_IP = 5

const activeConnections = new Map<string, number>()
let totalConnections = 0
let _sseSubscriberCount = 0

export let sseSubscriberCount = 0

export function setSseSubscriberCount(count: number): void {
  _sseSubscriberCount = count
  sseSubscriberCount = count
}

export function acquireConnection(ip: string): boolean {
  if (totalConnections >= MAX_SSE_CONNECTIONS) return false
  const ipCount = activeConnections.get(ip) ?? 0
  if (ipCount >= MAX_SSE_PER_IP) return false
  activeConnections.set(ip, ipCount + 1)
  totalConnections++
  return true
}

export function releaseConnection(ip: string): void {
  const ipCount = activeConnections.get(ip) ?? 0
  if (ipCount <= 1) {
    activeConnections.delete(ip)
  } else {
    activeConnections.set(ip, ipCount - 1)
  }
  totalConnections = Math.max(0, totalConnections - 1)
}

export function resetConnectionCounters(): void {
  activeConnections.clear()
  totalConnections = 0
  _sseSubscriberCount = 0
  sseSubscriberCount = 0
}

export function getConnectionStats() {
  return {
    totalConnections,
    sseSubscriberCount,
    activeConnections: new Map(activeConnections),
  }
}