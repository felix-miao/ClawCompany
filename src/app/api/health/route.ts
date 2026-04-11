import { NextResponse } from 'next/server'
import { logger } from '@/lib/core/logger'
import { getRateLimiterStats } from '@/lib/security/rate-limiter'

interface HealthCheck {
  name: string
  status: 'healthy' | 'unhealthy'
  latency: number
  message?: string
}

async function checkWithTimeout(
  name: string,
  fn: () => Promise<void>,
  timeoutMs = 3000
): Promise<HealthCheck> {
  const start = Date.now()
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ])
    return {
      name,
      status: 'healthy',
      latency: Date.now() - start,
    }
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  return checkWithTimeout('database', async () => {
    const { StorageManager } = await import('@/lib/storage/manager')
    const storage = new StorageManager()
    await storage.listAgents()
  })
}

async function checkRateLimiter(): Promise<HealthCheck> {
  return checkWithTimeout('rate-limiter', () => {
    try {
      const stats = getRateLimiterStats()
      if (stats && typeof stats.activeIdentifiers === 'number') {
        return Promise.resolve()
      }
      throw new Error('Rate limiter stats unavailable')
    } catch (error) {
      throw error
    }
  })
}

async function checkLLMProvider(): Promise<HealthCheck> {
  return checkWithTimeout('llm-provider', async () => {
    const { getLLMProvider } = await import('@/lib/llm/factory')
    const provider = getLLMProvider()
    if (!provider) {
      throw new Error('No LLM provider configured')
    }
  })
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = Date.now()

const [databaseCheck, rateLimiterCheck, llmProviderCheck] = await Promise.all([
    checkDatabase(),
    checkRateLimiter(),
    checkLLMProvider(),
  ])

  const checks = [databaseCheck, rateLimiterCheck, llmProviderCheck]

  const isHealthy = checks.every((check) => check.status === 'healthy')

  const response = NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      totalLatency: Date.now() - startTime,
      checks,
      rateLimiter: getRateLimiterStats(),
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': isHealthy ? 'pass' : 'fail',
      },
    }
  )

  if (!isHealthy) {
    logger.warn('[Health Check] Unhealthy status detected', {
      checks: checks.filter((c) => c.status !== 'healthy'),
    })
  }

  return response
}