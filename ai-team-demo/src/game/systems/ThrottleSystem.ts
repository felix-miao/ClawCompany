export interface RateLimitConfig {
  maxCalls: number;
  windowMs: number;
}

interface ThrottleEntry {
  lastCall: number;
  minInterval: number;
}

interface DebounceEntry {
  timer: ReturnType<typeof setTimeout> | null;
  fn: (...args: unknown[]) => void;
  lastArgs: unknown[];
}

interface RateLimitEntry {
  fn: (...args: unknown[]) => void;
  timestamps: number[];
  maxCalls: number;
  windowMs: number;
}

export class ThrottleSystem {
  private throttles: Map<string, ThrottleEntry> = new Map();
  private debounces: Map<string, DebounceEntry> = new Map();
  private rateLimits: Map<string, RateLimitEntry> = new Map();

  throttle<T extends (...args: unknown[]) => void>(
    key: string,
    fn: T,
    intervalMs: number
  ): (...args: Parameters<T>) => void {
    this.throttles.set(key, { lastCall: 0, minInterval: intervalMs });

    return (...args: Parameters<T>) => {
      if (!this.throttles.has(key)) {
        this.throttles.set(key, { lastCall: 0, minInterval: intervalMs });
      }
      const entry = this.throttles.get(key)!;
      const now = Date.now();
      if (now - entry.lastCall >= entry.minInterval) {
        entry.lastCall = now;
        fn(...args);
      }
    };
  }

  debounce<T extends (...args: unknown[]) => void>(
    key: string,
    fn: T,
    delayMs: number
  ): (...args: Parameters<T>) => void {
    if (!this.debounces.has(key)) {
      this.debounces.set(key, { timer: null, fn: fn as (...args: unknown[]) => void, lastArgs: [] });
    }

    return (...args: Parameters<T>) => {
      const entry = this.debounces.get(key)!;
      entry.lastArgs = args as unknown[];
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.timer = setTimeout(() => {
        entry.fn(...entry.lastArgs);
        entry.timer = null;
      }, delayMs);
    };
  }

  rateLimit<T extends (...args: unknown[]) => void>(
    key: string,
    fn: T,
    config: RateLimitConfig
  ): (...args: Parameters<T>) => void {
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, {
        fn: fn as (...args: unknown[]) => void,
        timestamps: [],
        maxCalls: config.maxCalls,
        windowMs: config.windowMs,
      });
    }

    return (...args: Parameters<T>) => {
      const entry = this.rateLimits.get(key)!;
      const now = Date.now();
      entry.timestamps = entry.timestamps.filter(t => now - t < entry.windowMs);

      if (entry.timestamps.length < entry.maxCalls) {
        entry.timestamps.push(now);
        entry.fn(...(args as unknown[]));
      }
    };
  }

  cancel(key: string): void {
    this.throttles.delete(key);
    const debounce = this.debounces.get(key);
    if (debounce?.timer) {
      clearTimeout(debounce.timer);
    }
    this.debounces.delete(key);
    this.rateLimits.delete(key);
  }

  cancelAll(): void {
    this.debounces.forEach(entry => {
      if (entry.timer) clearTimeout(entry.timer);
    });
    this.throttles.clear();
    this.debounces.clear();
    this.rateLimits.clear();
  }

  getActiveCount(): number {
    return this.throttles.size + this.debounces.size + this.rateLimits.size;
  }
}
