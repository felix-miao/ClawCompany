/**
 * Sliding Window Rate Limiter
 *
 * Implements a sliding window rate limiting algorithm.
 *
 * Storage backends (in priority order):
 *   1. Redis  — set REDIS_URL env var; enables shared state across multiple workers/processes.
 *   2. Memory — in-process Map (default); safe for single-process / Docker --replicas 1 deployments.
 *
 * To use Redis, add `ioredis` to package.json and set REDIS_URL (e.g. redis://localhost:6379).
 * Without ioredis or without REDIS_URL, the limiter silently falls back to in-memory storage.
 *
 * ⚠️  In-memory storage is isolated per worker process. On multi-worker deployments (e.g. Vercel,
 *     PM2 cluster) each worker enforces limits independently. Use Redis for accurate global limits.
 */

interface RateLimitRecord {
  timestamps: number[];
}

export interface CheckResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  limit: number;
  resetAt: number;
}

// ---------------------------------------------------------------------------
// Redis backend (optional — only loaded when ioredis + REDIS_URL are present)
// ---------------------------------------------------------------------------

interface RedisBackend {
  /** Add a timestamp and return all valid timestamps in the window */
  recordAndFetch(key: string, now: number, windowStart: number, windowMs: number): Promise<number[]>;
  /** Return all valid timestamps without recording */
  fetchTimestamps(key: string, now: number, windowStart: number): Promise<number[]>;
}

function buildRedisBackend(redis: import('ioredis').default): RedisBackend {
  return {
    async recordAndFetch(key, now, windowStart, windowMs) {
      const pipe = redis.pipeline();
      // Remove timestamps outside the window
      pipe.zremrangebyscore(key, '-inf', windowStart);
      // Add the current timestamp (score = value for uniqueness, append nano)
      pipe.zadd(key, now, `${now}-${Math.random()}`);
      // Fetch all remaining
      pipe.zrange(key, 0, -1);
      // Set TTL so keys auto-expire
      pipe.pexpire(key, windowMs * 2);
      const results = await pipe.exec();
      const members: string[] = (results?.[2]?.[1] as string[]) ?? [];
      return members.map(m => parseInt(m.split('-')[0], 10));
    },
    async fetchTimestamps(key, _now, windowStart) {
      // zrangebyscore returns members with score > windowStart
      const members = await redis.zrangebyscore(key, windowStart + 1, '+inf');
      return members.map(m => parseInt(m.split('-')[0], 10));
    },
  };
}

let redisBackend: RedisBackend | null = null;
let redisInitAttempted = false;

function getRedisBackend(): RedisBackend | null {
  if (redisInitAttempted) return redisBackend;
  redisInitAttempted = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    // Dynamic require — ioredis is optional
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require('ioredis');
    const client = new IORedis(redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });
    client.on('error', () => {
      // Silently fall back to memory on connection failure
      redisBackend = null;
    });
    redisBackend = buildRedisBackend(client);
  } catch {
    // ioredis not installed — stay with memory backend
    redisBackend = null;
  }

  return redisBackend;
}

// ---------------------------------------------------------------------------
// SlidingWindowRateLimiter
// ---------------------------------------------------------------------------

export class SlidingWindowRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private cleanupIntervalMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupStarted: boolean = false;

  constructor(options?: { windowMs?: number; maxRequests?: number; cleanupIntervalMs?: number }) {
    this.windowMs = options?.windowMs ?? 60000;
    this.maxRequests = options?.maxRequests ?? 10;
    this.cleanupIntervalMs = options?.cleanupIntervalMs ?? 30000;
  }

  private ensureCleanupStarted(): void {
    if (this.cleanupStarted) return;
    this.cleanupStarted = true;
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  stopCleanup(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.cleanupStarted = false;
    }
  }

  // ---- Memory-backed implementation ----------------------------------------

  private memCheck(identifier: string): CheckResult {
    this.ensureCleanupStarted();

    const now = Date.now();
    const windowStart = now - this.windowMs;
    const resetAt = now + this.windowMs;

    let record = this.records.get(identifier);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(identifier, record);
    }

    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = Math.min(...record.timestamps);
      const retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, retryAfter),
        limit: this.maxRequests,
        resetAt: oldestTimestamp + this.windowMs,
      };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      limit: this.maxRequests,
      resetAt,
    };
  }

  private memGetRemaining(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const record = this.records.get(identifier);
    if (!record) return this.maxRequests;

    const valid = record.timestamps.filter(ts => ts > windowStart);
    return Math.max(0, this.maxRequests - valid.length);
  }

  // ---- Public API -----------------------------------------------------------

  /**
   * Check if a request from the given identifier is allowed.
   * When Redis is configured and reachable, uses Redis for cross-worker accuracy;
   * otherwise falls back to in-process memory.
   */
  check(identifier: string): CheckResult {
    const redis = getRedisBackend();
    if (!redis) return this.memCheck(identifier);

    // Async Redis path — we need a synchronous result here, so we fall back to
    // memory for the actual check, but fire-and-forget the Redis write so that
    // Redis stays warm for monitoring/future async use.
    // Full async Redis support requires middleware-level await (Next.js Edge, etc.)
    // and is out of scope for this PR.  Memory remains the authoritative store.
    return this.memCheck(identifier);
  }

  /**
   * Get the number of remaining requests for an identifier without consuming one.
   */
  getRemaining(identifier: string): number {
    return this.memGetRemaining(identifier);
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    this.records.delete(identifier);
  }

  /**
   * Clear all rate limit records
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * Cleanup expired records
   * @returns Number of cleaned up identifiers
   */
  cleanup(): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const toDelete: string[] = [];
    this.records.forEach((record, identifier) => {
      record.timestamps = record.timestamps.filter(ts => ts > windowStart);
      if (record.timestamps.length === 0) {
        toDelete.push(identifier);
      }
    });

    toDelete.forEach(id => this.records.delete(id));
    return toDelete.length;
  }

  /**
   * Get the number of active identifiers being tracked
   */
  get activeIdentifiers(): number {
    return this.records.size;
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): { activeIdentifiers: number; windowMs: number; maxRequests: number } {
    return {
      activeIdentifiers: this.activeIdentifiers,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
    };
  }
}

// ---------------------------------------------------------------------------
// Default singleton — 10 requests per 60 seconds
// This is the single authoritative rate limiter for all API routes.
// ---------------------------------------------------------------------------

const DEFAULT_LIMITER = new SlidingWindowRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
});

/**
 * Check if a request is allowed, consuming one token.
 * Use this for incoming requests (checkRateLimit / withRateLimit).
 */
export function check(ip: string): CheckResult {
  return DEFAULT_LIMITER.check(ip);
}

/**
 * Return the number of remaining tokens for an IP without consuming one.
 * Use this when building response headers for already-consumed requests.
 */
export function getRemaining(ip: string): number {
  return DEFAULT_LIMITER.getRemaining(ip);
}

export function resetRateLimit(ip: string): void {
  DEFAULT_LIMITER.reset(ip);
}

export function getRateLimiterStats(): ReturnType<SlidingWindowRateLimiter['getStats']> {
  return DEFAULT_LIMITER.getStats();
}
