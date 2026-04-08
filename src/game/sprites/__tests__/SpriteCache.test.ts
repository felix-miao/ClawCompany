import { SpriteCache, SpriteCacheEntry, SpriteCacheConfig } from '../SpriteCache';
import { MemoryManager } from '../../systems/MemoryManager';

describe('SpriteCache', () => {
  let cache: SpriteCache;
  let memoryManager: MemoryManager;

  const mockCreateFn = jest.fn((role: string) => ({
    textureKey: `character_${role}`,
    width: 64,
    height: 64,
    frames: 4,
  }));

  const mockDestroyFn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    memoryManager = new MemoryManager({ maxTrackedResources: 100, memoryBudgetMB: 10 });
    cache = new SpriteCache(memoryManager, {
      maxEntries: 50,
      ttlMs: 60000,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultCache = new SpriteCache(memoryManager);
      expect(defaultCache.getStats().size).toBe(0);
      expect(defaultCache.getStats().hits).toBe(0);
      expect(defaultCache.getStats().misses).toBe(0);
    });

    it('should accept custom config', () => {
      const customCache = new SpriteCache(memoryManager, {
        maxEntries: 10,
        ttlMs: 30000,
      });
      expect(customCache.getStats().size).toBe(0);
    });
  });

  describe('getOrCreate', () => {
    it('should create and cache a new sprite', () => {
      const entry = cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      expect(entry.textureKey).toBe('character_pm');
      expect(mockCreateFn).toHaveBeenCalledTimes(1);
      expect(cache.getStats().size).toBe(1);
    });

    it('should return cached sprite on subsequent calls (no duplicate creation)', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);

      expect(mockCreateFn).toHaveBeenCalledTimes(1);
      expect(cache.getStats().size).toBe(1);
      expect(cache.getStats().hits).toBe(2);
      expect(cache.getStats().misses).toBe(1);
    });

    it('should create separate entries for different roles', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('dev', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('tester', mockCreateFn, mockDestroyFn);

      expect(mockCreateFn).toHaveBeenCalledTimes(3);
      expect(cache.getStats().size).toBe(3);
    });

    it('should track memory for each created sprite', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      expect(memoryManager.getTrackedCount()).toBe(1);
    });

    it('should not track memory for cached hits', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      expect(memoryManager.getTrackedCount()).toBe(1);
    });
  });

  describe('has', () => {
    it('should return false for non-existent entry', () => {
      expect(cache.has('pm')).toBe(false);
    });

    it('should return true for cached entry', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      expect(cache.has('pm')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent entry', () => {
      expect(cache.get('pm')).toBeUndefined();
    });

    it('should return the cached entry', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      const entry = cache.get('pm');
      expect(entry).toBeDefined();
      expect(entry!.textureKey).toBe('character_pm');
    });
  });

  describe('invalidate', () => {
    it('should remove entry and call destroy', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.invalidate('pm');

      expect(mockDestroyFn).toHaveBeenCalledTimes(1);
      expect(cache.has('pm')).toBe(false);
      expect(cache.getStats().size).toBe(0);
    });

    it('should untrack memory', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      expect(memoryManager.getTrackedCount()).toBe(1);

      cache.invalidate('pm');
      expect(memoryManager.getTrackedCount()).toBe(0);
    });

    it('should handle invalidating non-existent key gracefully', () => {
      expect(() => cache.invalidate('nonexistent')).not.toThrow();
    });
  });

  describe('invalidateAll', () => {
    it('should remove all entries and call destroy for each', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('dev', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('tester', mockCreateFn, mockDestroyFn);

      cache.invalidateAll();

      expect(mockDestroyFn).toHaveBeenCalledTimes(3);
      expect(cache.getStats().size).toBe(0);
      expect(memoryManager.getTrackedCount()).toBe(0);
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should not return expired entries', () => {
      const shortTtlCache = new SpriteCache(memoryManager, { ttlMs: 50 });

      shortTtlCache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      expect(shortTtlCache.has('pm')).toBe(true);

      jest.advanceTimersByTime(100);

      const entry = shortTtlCache.get('pm');
      expect(entry).toBeUndefined();
    });

    it('should recreate expired entries on getOrCreate', () => {
      const shortTtlCache = new SpriteCache(memoryManager, { ttlMs: 50 });

      shortTtlCache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      jest.advanceTimersByTime(100);

      shortTtlCache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      expect(mockCreateFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('max entries / eviction', () => {
    it('should evict oldest entry when maxEntries exceeded', () => {
      const smallCache = new SpriteCache(memoryManager, { maxEntries: 2 });

      smallCache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      smallCache.getOrCreate('dev', mockCreateFn, mockDestroyFn);
      smallCache.getOrCreate('tester', mockCreateFn, mockDestroyFn);

      expect(smallCache.getStats().size).toBe(2);
      expect(smallCache.has('pm')).toBe(false);
      expect(smallCache.has('dev')).toBe(true);
      expect(smallCache.has('tester')).toBe(true);
      expect(mockDestroyFn).toHaveBeenCalledTimes(1);
    });

    it('should not evict recently accessed entries', () => {
      const smallCache = new SpriteCache(memoryManager, { maxEntries: 2 });

      smallCache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      smallCache.getOrCreate('dev', mockCreateFn, mockDestroyFn);

      smallCache.getOrCreate('pm', mockCreateFn, mockDestroyFn);

      smallCache.getOrCreate('tester', mockCreateFn, mockDestroyFn);

      expect(smallCache.has('pm')).toBe(true);
      expect(smallCache.has('dev')).toBe(false);
      expect(smallCache.has('tester')).toBe(true);
    });
  });

  describe('memory budget', () => {
    it('should report memory usage via memory manager', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('dev', mockCreateFn, mockDestroyFn);

      const usage = memoryManager.getEstimatedMemoryUsage();
      expect(usage).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should track hit/miss/eviction stats', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('dev', mockCreateFn, mockDestroyFn);

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.evictions).toBe(0);
    });

    it('should track eviction count', () => {
      const smallCache = new SpriteCache(memoryManager, { maxEntries: 1 });
      smallCache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      smallCache.getOrCreate('dev', mockCreateFn, mockDestroyFn);

      expect(smallCache.getStats().evictions).toBe(1);
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      cache.getOrCreate('pm', mockCreateFn, mockDestroyFn);
      cache.getOrCreate('dev', mockCreateFn, mockDestroyFn);

      cache.destroy();

      expect(mockDestroyFn).toHaveBeenCalledTimes(2);
      expect(cache.getStats().size).toBe(0);
      expect(memoryManager.getTrackedCount()).toBe(0);
    });
  });
});
