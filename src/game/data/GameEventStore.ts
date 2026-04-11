/**
 * GameEventStore — decoupled event bus for game events.
 *
 * Architecture:
 *   • In-process EventEmitter (default): works for single-instance Docker/dev deployments.
 *   • Redis Pub/Sub mode (opt-in): set REDIS_URL env var to enable cross-worker delivery.
 *     Required for Vercel multi-worker deployments where POST and SSE GET may land on
 *     different worker instances.
 *
 * ⚠️  Vercel Production:
 *   Without REDIS_URL, events published by Worker A will never reach SSE subscribers
 *   in Worker B. Set REDIS_URL (e.g. Upstash Redis or any Redis-compatible service) to
 *   enable cross-worker pub/sub.
 */

import { EventEmitter } from 'events';
import { GameEvent, GameEventType } from '../types/GameEvents';

// ── Internal in-memory ring buffer ──────────────────────────────────────────

class RingBuffer {
  private buffer: (GameEvent | undefined)[];
  private head = 0;
  private count = 0;
  private readonly maxEvents: number;

  constructor(maxEvents: number) {
    this.maxEvents = maxEvents;
    this.buffer = new Array(maxEvents);
  }

  push(event: GameEvent): void {
    this.buffer[this.head] = event;
    this.head = (this.head + 1) % this.maxEvents;
    if (this.count < this.maxEvents) this.count++;
  }

  toArray(): GameEvent[] {
    if (this.count === 0) return [];
    const result: GameEvent[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.maxEvents) % this.maxEvents;
      const item = this.buffer[idx];
      if (item !== undefined) result.push(item);
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer = new Array(this.maxEvents);
  }
}

// ── EventEmitter-based transport (single-instance fallback) ──────────────────

const EVENT_CHANNEL = 'game:event';

/**
 * Module-level emitter singleton — shared across all getGameEventStore() calls
 * within the same Node.js process (worker). This ensures SSE subscribers and
 * event publishers communicate through the same emitter even if called from
 * different request handlers in the same worker.
 */
const processEmitter = new EventEmitter();
processEmitter.setMaxListeners(500); // Allow many SSE connections

// ── Redis Pub/Sub transport (multi-worker, optional) ──────────────────────────

type RedisClient = {
  connect(): Promise<void>;
  subscribe(channel: string): Promise<unknown>;
  on(event: 'message', listener: (channel: string, message: string) => void): unknown;
  publish(channel: string, message: string): Promise<unknown>;
};

type RedisConstructor = new (
  url: string,
  options: { lazyConnect: boolean; enableReadyCheck: boolean }
) => RedisClient;

let redisPub: RedisClient | null = null;
let redisSub: RedisClient | null = null;
let redisReady = false;

async function loadRedisConstructor(): Promise<RedisConstructor> {
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<{ default: RedisConstructor }>;
  const module = await dynamicImport('ioredis');
  return module.default;
}

/**
 * Try to initialise Redis pub/sub. Silently skips if ioredis is not installed
 * or REDIS_URL is not set.
 */
async function maybeInitRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url || redisReady) return;
  try {
    const Redis = await loadRedisConstructor();
    redisPub = new Redis(url, { lazyConnect: true, enableReadyCheck: false });
    redisSub = new Redis(url, { lazyConnect: true, enableReadyCheck: false });
    await redisPub.connect();
    await redisSub.connect();
    await redisSub.subscribe(EVENT_CHANNEL);
    redisSub.on('message', (_channel: string, message: string) => {
      try {
        const event: GameEvent = JSON.parse(message);
        // Re-emit locally so SSE handlers in this worker pick it up
        processEmitter.emit(EVENT_CHANNEL, event);
      } catch {
        // malformed message — ignore
      }
    });
    redisReady = true;
  } catch {
    // ioredis not installed or Redis unreachable — fall back to in-process emitter
    redisPub = null;
    redisSub = null;
  }
}

// Kick off Redis init at module load time (fire-and-forget)
if (typeof process !== 'undefined' && process.env.REDIS_URL) {
  maybeInitRedis().catch(() => {});
}

// ── GameEventStore ───────────────────────────────────────────────────────────

type EventCallback = (event: GameEvent) => void;

export class GameEventStore {
  private ring: RingBuffer;

  constructor(maxEvents: number = 200) {
    this.ring = new RingBuffer(maxEvents);
  }

  /**
   * Publish an event.
   * - Always stored in local ring buffer (for catch-up on reconnect).
   * - Emits on processEmitter for in-process SSE subscribers.
   * - If Redis is ready, also publishes to Redis channel for cross-worker delivery.
   */
  push(event: GameEvent): void {
    this.ring.push(event);
    const listeners = processEmitter.listeners(EVENT_CHANNEL);
    for (const listener of listeners) {
      try {
        (listener as EventCallback)(event);
      } catch {}
    }
    if (redisReady && redisPub) {
      redisPub.publish(EVENT_CHANNEL, JSON.stringify(event)).catch(() => {});
    }
  }

  /**
   * Subscribe to new events. Returns an unsubscribe function.
   * Listeners are attached to the process-level EventEmitter so they receive
   * events from any code path in this worker (including Redis re-emits).
   */
  subscribe(callback: EventCallback): () => void {
    processEmitter.on(EVENT_CHANNEL, callback);
    return () => {
      processEmitter.off(EVENT_CHANNEL, callback);
    };
  }

  getEvents(since?: number): GameEvent[] {
    const all = this.ring.toArray();
    if (!since) return all;
    return all.filter(e => e.timestamp > since);
  }

  getEventsByType(type: GameEventType): GameEvent[] {
    return this.ring.toArray().filter(e => e.type === type);
  }

  getEventsByAgent(agentId: string): GameEvent[] {
    return this.ring.toArray().filter(e => e.agentId === agentId);
  }

  getLatestEvent(): GameEvent | undefined {
    const arr = this.ring.toArray();
    return arr[arr.length - 1];
  }

  getSubscriberCount(): number {
    return processEmitter.listenerCount(EVENT_CHANNEL);
  }

  clear(): void {
    this.ring.clear();
  }

  static clearAllSubscribers(): void {
    processEmitter.removeAllListeners(EVENT_CHANNEL);
  }
}

// ── Factory function (per-request instance) ────────────────────────────────────────────────

let defaultStore: GameEventStore | null = null;

export function createGameEventStore(maxEvents?: number): GameEventStore {
  return new GameEventStore(maxEvents);
}

export function getGameEventStore(): GameEventStore {
  if (!defaultStore) {
    defaultStore = createGameEventStore();
  }
  return defaultStore;
}

export function setGameEventStore(store: GameEventStore): void {
  defaultStore = store;
}

export function resetGameEventStore(): void {
  defaultStore = null;
}
