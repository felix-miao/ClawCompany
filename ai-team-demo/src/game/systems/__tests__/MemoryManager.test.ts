import { MemoryManager, TrackedResource, MemorySnapshot } from '../MemoryManager';

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager({
      maxTrackedResources: 100,
      cleanupInterval: 1000,
      warningThresholdMB: 50,
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultManager = new MemoryManager();
      expect(defaultManager.getTrackedCount()).toBe(0);
    });
  });

  describe('track/untrack', () => {
    it('should track a resource', () => {
      const resource = { type: 'sprite', id: 's1', estimatedSize: 1024 };
      manager.track(resource);
      expect(manager.getTrackedCount()).toBe(1);
    });

    it('should untrack a resource', () => {
      const resource = { type: 'sprite', id: 's1', estimatedSize: 1024 };
      manager.track(resource);
      manager.untrack('s1');
      expect(manager.getTrackedCount()).toBe(0);
    });

    it('should handle untracking non-existent resource', () => {
      expect(() => manager.untrack('nonexistent')).not.toThrow();
    });

    it('should track multiple resources', () => {
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 1024 });
      manager.track({ type: 'texture', id: 't1', estimatedSize: 2048 });
      manager.track({ type: 'tween', id: 'tw1', estimatedSize: 128 });
      expect(manager.getTrackedCount()).toBe(3);
    });

    it('should prevent tracking duplicate ids', () => {
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 1024 });
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 2048 });
      expect(manager.getTrackedCount()).toBe(1);
    });
  });

  describe('memory estimation', () => {
    it('should estimate total memory usage', () => {
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 1024 });
      manager.track({ type: 'texture', id: 't1', estimatedSize: 2048 });
      expect(manager.getEstimatedMemoryUsage()).toBe(3072);
    });

    it('should return 0 when no resources tracked', () => {
      expect(manager.getEstimatedMemoryUsage()).toBe(0);
    });

    it('should group memory by type', () => {
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 1024 });
      manager.track({ type: 'sprite', id: 's2', estimatedSize: 1024 });
      manager.track({ type: 'texture', id: 't1', estimatedSize: 2048 });
      const byType = manager.getMemoryByType();
      expect(byType.get('sprite')).toBe(2048);
      expect(byType.get('texture')).toBe(2048);
    });
  });

  describe('resource lifecycle', () => {
    it('should track resource age', () => {
      const now = Date.now();
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 1024, createdAt: now - 5000 });
      const resources = manager.getResources();
      expect(resources[0].age).toBeGreaterThanOrEqual(5000);
    });

    it('should find stale resources', () => {
      const now = Date.now();
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 1024, createdAt: now - 60000 });
      manager.track({ type: 'sprite', id: 's2', estimatedSize: 1024, createdAt: now });
      const stale = manager.getStaleResources(30000);
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe('s1');
    });

    it('should find no stale resources when none exist', () => {
      const now = Date.now();
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 1024, createdAt: now });
      const stale = manager.getStaleResources(60000);
      expect(stale).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources with destroy callback', () => {
      let destroyed = false;
      manager.track({
        type: 'sprite',
        id: 's1',
        estimatedSize: 1024,
        createdAt: Date.now() - 60000,
        destroy: () => { destroyed = true; },
      });

      manager.cleanupStale(30000);
      expect(destroyed).toBe(true);
      expect(manager.getTrackedCount()).toBe(0);
    });

    it('should cleanup by type', () => {
      let spriteDestroyed = false;
      let textureDestroyed = false;
      manager.track({
        type: 'sprite',
        id: 's1',
        estimatedSize: 1024,
        createdAt: Date.now(),
        destroy: () => { spriteDestroyed = true; },
      });
      manager.track({
        type: 'texture',
        id: 't1',
        estimatedSize: 2048,
        createdAt: Date.now(),
        destroy: () => { textureDestroyed = true; },
      });

      manager.cleanupByType('sprite');
      expect(spriteDestroyed).toBe(true);
      expect(textureDestroyed).toBe(false);
      expect(manager.getTrackedCount()).toBe(1);
    });

    it('should cleanup all resources', () => {
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 1024 });
      manager.track({ type: 'texture', id: 't1', estimatedSize: 2048 });
      manager.cleanupAll();
      expect(manager.getTrackedCount()).toBe(0);
    });
  });

  describe('memory snapshot', () => {
    it('should create a memory snapshot', () => {
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 1024 });
      manager.track({ type: 'texture', id: 't1', estimatedSize: 2048 });
      const snapshot = manager.takeSnapshot();
      expect(snapshot.totalBytes).toBe(3072);
      expect(snapshot.resourceCount).toBe(2);
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.byType.size).toBe(2);
    });
  });

  describe('memory budget', () => {
    it('should warn when exceeding budget', () => {
      const smallManager = new MemoryManager({ memoryBudgetMB: 0.001 });
      smallManager.track({ type: 'texture', id: 't1', estimatedSize: 1024 * 1024 });
      expect(smallManager.isOverBudget()).toBe(true);
    });

    it('should not warn when under budget', () => {
      manager.track({ type: 'sprite', id: 's1', estimatedSize: 512 });
      expect(manager.isOverBudget()).toBe(false);
    });

    it('should calculate budget usage percentage', () => {
      const budgetManager = new MemoryManager({ memoryBudgetMB: 0.001 });
      budgetManager.track({ type: 'sprite', id: 's1', estimatedSize: 512 });
      const pct = budgetManager.getBudgetUsedPercent();
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });
  });

  describe('resource limits', () => {
    it('should enforce max tracked resources', () => {
      const limited = new MemoryManager({ maxTrackedResources: 3 });
      for (let i = 0; i < 5; i++) {
        limited.track({ type: 'sprite', id: `s${i}`, estimatedSize: 100 });
      }
      expect(limited.getTrackedCount()).toBe(3);
    });
  });
});
