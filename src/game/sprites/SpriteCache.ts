import { MemoryManager } from '../systems/MemoryManager';

export interface SpriteCacheEntry {
  textureKey: string;
  width: number;
  height: number;
  frames: number;
  createdAt: number;
  lastAccessed: number;
  destroy: () => void;
  accessSequence?: number;
}

export interface SpriteCacheConfig {
  maxEntries?: number;
  ttlMs?: number;
}

export interface SpriteCacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

export class SpriteCache {
  private cache = new Map<string, SpriteCacheEntry>();
  private config: Required<SpriteCacheConfig>;
  private stats: SpriteCacheStats = {
    size: 0,
    hits: 0,
    misses: 0,
    evictions: 0
  };
  private accessSequence = 0;

  constructor(
    private memoryManager: MemoryManager,
    config: SpriteCacheConfig = {}
  ) {
    this.config = {
      maxEntries: 50,
      ttlMs: 60000,
      ...config
    };
  }

  getStats(): SpriteCacheStats {
    return { ...this.stats };
  }

  get(role: string): SpriteCacheEntry | undefined {
    const entry = this.cache.get(role);
    if (!entry) {
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.removeEntry(role);
      return undefined;
    }

    entry.lastAccessed = Date.now();
    entry.accessSequence = ++this.accessSequence;
    this.stats.hits++;
    return entry;
  }

  has(role: string): boolean {
    const entry = this.cache.get(role);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.removeEntry(role);
      return false;
    }

    return true;
  }

  getOrCreate(
    role: string,
    createFn: (role: string) => { textureKey: string; width: number; height: number; frames: number },
    destroyFn: () => void
  ): SpriteCacheEntry {
    const existing = this.get(role);
    if (existing) {
      return existing;
    }

    this.evictIfNeeded();

    const spriteData = createFn(role);
    const entry: SpriteCacheEntry = {
      ...spriteData,
      destroy: destroyFn,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessSequence: ++this.accessSequence
    };

    this.cache.set(role, entry);
    this.memoryManager.track({
      type: 'sprite',
      id: `sprite_${role}`,
      estimatedSize: spriteData.width * spriteData.height * 4
    });
    this.stats.size = this.cache.size;
    this.stats.misses++;

    return entry;
  }

  invalidate(role: string): void {
    this.removeEntry(role);
  }

  invalidateAll(): void {
    for (const [role] of this.cache) {
      this.removeEntry(role);
    }
    this.cache.clear();
    this.stats.size = 0;
  }

  destroy(): void {
    this.invalidateAll();
  }

  private removeEntry(role: string): void {
    const entry = this.cache.get(role);
    if (entry) {
      entry.destroy();
      this.memoryManager.untrack(`sprite_${role}`);
      this.cache.delete(role);
      this.stats.size = this.cache.size;
    }
  }

  private isExpired(entry: SpriteCacheEntry): boolean {
    return Date.now() - entry.lastAccessed > this.config.ttlMs;
  }

  private evictIfNeeded(): void {
    if (this.cache.size < this.config.maxEntries) {
      return;
    }

    let oldestKey: string | null = null;
    let oldestSequence = Infinity;

    for (const [key, entry] of this.cache) {
      const seq = entry.accessSequence ?? 0;
      if (seq < oldestSequence) {
        oldestSequence = seq;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.removeEntry(oldestKey);
      this.stats.evictions++;
    }
  }
}