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
import { randomUUID } from 'crypto';
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

// ── 进程级 EventEmitter（HMR 安全）──────────────────────────────────────────
//
// Next.js dev 热重载会重新执行本模块，module-level 变量被丢弃，旧 emitter 上
// 已注册的 listeners 永远无法 unsubscribe，导致 async_hooks Map 无限增长。
// 将 emitter 存在 globalThis 上，确保 HMR 后复用同一个 emitter 实例。
//
declare global {
  // eslint-disable-next-line no-var
  var __gameEventEmitter: EventEmitter | undefined
  // eslint-disable-next-line no-var
  var __diagTimerStarted: boolean | undefined
}

if (!globalThis.__gameEventEmitter) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(200);
  globalThis.__gameEventEmitter = emitter;
}

// 本地引用，类型安全
const processEmitter: EventEmitter = globalThis.__gameEventEmitter!;

// ── [DIAG] 周期性打印 async_hooks Map 大小，追踪泄漏趋势 ─────────────────────
// async_hooks 内部用一个 Map 追踪每个 async context，Map 无限增长会触发
// "RangeError: Map maximum size exceeded"。
// 这里每 60 秒打印一次，帮助确认崩溃前增长曲线和哪类 async 操作是来源。
if (process.env.NODE_ENV === 'development' && typeof process !== 'undefined') {
  if (!globalThis.__diagTimerStarted) {
    globalThis.__diagTimerStarted = true;
    const diagTimer = setInterval(() => {
      const listenerCount = processEmitter.listenerCount(EVENT_CHANNEL);
      // process._getActiveHandles() 返回活跃句柄（timers/sockets 等）数量
      const activeHandles = (process as NodeJS.Process & { _getActiveHandles?: () => unknown[] })
        ._getActiveHandles?.()?.length ?? -1;
      const activeRequests = (process as NodeJS.Process & { _getActiveRequests?: () => unknown[] })
        ._getActiveRequests?.()?.length ?? -1;
      const mem = process.memoryUsage();
      console.log(
        `[DIAG] emitter.listeners=${listenerCount}` +
        ` activeHandles=${activeHandles}` +
        ` activeRequests=${activeRequests}` +
        ` heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB` +
        ` heapTotal=${Math.round(mem.heapTotal / 1024 / 1024)}MB`
      );
    }, 60_000);
    // unref 不阻止进程退出
    if (typeof diagTimer === 'object' && diagTimer !== null && 'unref' in diagTimer) {
      (diagTimer as { unref(): void }).unref();
    }
  }
}

// ── Redis Pub/Sub transport (multi-worker, optional) ──────────────────────────

type RedisClient = {
  connect(): Promise<void>;
  subscribe(channel: string): Promise<unknown>;
  on(event: 'message', listener: (channel: string, message: string) => void): unknown;
  publish(channel: string, message: string): Promise<unknown>;
  disconnect?: () => Promise<void> | void;
};

type RedisConstructor = new (
  url: string,
  options: { lazyConnect: boolean; enableReadyCheck: boolean }
) => RedisClient;

let redisPub: RedisClient | null = null;
let redisSub: RedisClient | null = null;
let redisReady = false;
let redisInitPromise: Promise<void> | null = null;
let redisLoader: () => Promise<RedisConstructor> = loadRedisConstructor;
let redisTransportMode: 'local' | 'redis-bridge' = 'local';
const redisBridgeId = randomUUID();

type RedisEnvelope = {
  origin: string;
  event: GameEvent;
};

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
  if (redisInitPromise) return redisInitPromise;
  redisInitPromise = (async () => {
  try {
    const Redis = await redisLoader();
    redisPub = new Redis(url, { lazyConnect: true, enableReadyCheck: false });
    redisSub = new Redis(url, { lazyConnect: true, enableReadyCheck: false });
    await redisPub.connect();
    await redisSub.connect();
    await redisSub.subscribe(EVENT_CHANNEL);
    redisSub.on('message', (_channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as GameEvent | RedisEnvelope;
        const event = 'event' in parsed ? parsed.event : parsed;
        const origin = 'origin' in parsed ? parsed.origin : undefined;
        if (origin && origin === redisBridgeId) return;
        // Re-emit locally so SSE handlers in this worker pick it up
        processEmitter.emit(EVENT_CHANNEL, event);
      } catch {
        // malformed message — ignore
      }
    });
    redisReady = true;
    redisTransportMode = 'redis-bridge';
  } catch {
    // ioredis not installed or Redis unreachable — fall back to in-process emitter
    redisPub = null;
    redisSub = null;
    redisReady = false;
    redisTransportMode = 'local';
  } finally {
    redisInitPromise = null;
  }
  })();
  return redisInitPromise;
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
      } catch { /* intentionally empty */ }
    }
    if (redisReady && redisPub) {
      const envelope: RedisEnvelope = { origin: redisBridgeId, event };
      redisPub.publish(EVENT_CHANNEL, JSON.stringify(envelope)).catch(() => {});
    }
  }

  /**
   * Subscribe to new events. Returns an unsubscribe function.
   * Listeners are attached to the process-level EventEmitter so they receive
   * events from any code path in this worker (including Redis re-emits).
   */
  subscribe(callback: EventCallback): () => void {
    processEmitter.on(EVENT_CHANNEL, callback);
    const countAfter = processEmitter.listenerCount(EVENT_CHANNEL);
    // [DIAG] 每次 subscribe 打印当前 listener 数，帮助发现泄漏
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GameEventStore] subscribe → listenerCount=${countAfter}`);
    }
    return () => {
      processEmitter.off(EVENT_CHANNEL, callback);
      const countAfterUnsub = processEmitter.listenerCount(EVENT_CHANNEL);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[GameEventStore] unsubscribe → listenerCount=${countAfterUnsub}`);
      }
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

export function getGameEventStoreTransportState(): {
  mode: 'local' | 'redis-bridge';
  redisReady: boolean;
  redisConfigured: boolean;
} {
  return {
    mode: redisTransportMode,
    redisReady,
    redisConfigured: Boolean(process.env.REDIS_URL),
  };
}

export async function __initGameEventStoreRedisTransportForTest(): Promise<void> {
  await maybeInitRedis();
}

export function __setGameEventStoreRedisLoaderForTest(loader: () => Promise<RedisConstructor>): void {
  redisLoader = loader;
}

export async function __resetGameEventStoreRedisTransportForTest(): Promise<void> {
  if (redisSub?.disconnect) await redisSub.disconnect();
  if (redisPub?.disconnect) await redisPub.disconnect();
  redisPub = null;
  redisSub = null;
  redisReady = false;
  redisInitPromise = null;
  redisLoader = loadRedisConstructor;
  redisTransportMode = 'local';
}

// ── Factory function ────────────────────────────────────────────────────────

export function createGameEventStore(maxEvents?: number): GameEventStore {
  return new GameEventStore(maxEvents);
}

// ── 进程级单例（HMR 安全）──────────────────────────────────────────────────────
//
// Next.js dev 热重载会重新执行本模块，module-level 变量被丢弃。
// 将 defaultStore 存在 globalThis 上，HMR 后仍能复用同一个 store，
// 避免新旧两个 store 同时持有 processEmitter listeners 造成无限堆积。
//
declare global {
  // eslint-disable-next-line no-var
  var __gameEventStore: GameEventStore | undefined
}

export function getGameEventStore(): GameEventStore {
  if (!globalThis.__gameEventStore) {
    globalThis.__gameEventStore = createGameEventStore();
  }
  return globalThis.__gameEventStore;
}

export function setGameEventStore(store: GameEventStore): void {
  globalThis.__gameEventStore = store;
}

export function resetGameEventStore(): void {
  globalThis.__gameEventStore = undefined;
}
