import { RenderOptimizer, CullingResult, LODLevel, RenderStats } from '../RenderOptimizer';

describe('RenderOptimizer', () => {
  let optimizer: RenderOptimizer;

  beforeEach(() => {
    optimizer = new RenderOptimizer({
      viewportWidth: 800,
      viewportHeight: 600,
      cullingMargin: 64,
      lodDistances: { near: 200, medium: 500, far: 800 },
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultOptimizer = new RenderOptimizer();
      expect(defaultOptimizer).toBeDefined();
    });
  });

  describe('viewport culling', () => {
    it('should mark objects inside viewport as visible', () => {
      const result = optimizer.cull({ x: 400, y: 300, width: 32, height: 32 }, 0, 0);
      expect(result).toBe('visible');
    });

    it('should mark objects outside viewport as culled', () => {
      const result = optimizer.cull({ x: 900, y: 300, width: 32, height: 32 }, 0, 0);
      expect(result).toBe('culled');
    });

    it('should mark objects partially inside viewport with margin as visible', () => {
      const result = optimizer.cull({ x: 770, y: 300, width: 32, height: 32 }, 0, 0);
      expect(result).toBe('visible');
    });

    it('should respect camera offset', () => {
      const result = optimizer.cull({ x: 400, y: 300, width: 32, height: 32 }, 800, 0);
      expect(result).toBe('culled');
    });

    it('should handle objects far off screen', () => {
      const result = optimizer.cull({ x: -500, y: -500, width: 32, height: 32 }, 0, 0);
      expect(result).toBe('culled');
    });

    it('should batch cull multiple objects', () => {
      const objects = [
        { x: 400, y: 300, width: 32, height: 32 },
        { x: 900, y: 300, width: 32, height: 32 },
        { x: 100, y: 100, width: 32, height: 32 },
      ];
      const results = optimizer.cullBatch(objects, 0, 0);
      expect(results.filter(r => r === 'visible')).toHaveLength(2);
      expect(results.filter(r => r === 'culled')).toHaveLength(1);
    });
  });

  describe('LOD selection', () => {
    it('should return near LOD for close objects', () => {
      const lod = optimizer.getLOD({ x: 400, y: 300 }, { x: 400, y: 200 });
      expect(lod).toBe('near');
    });

    it('should return medium LOD for moderate distance', () => {
      const lod = optimizer.getLOD({ x: 400, y: 300 }, { x: 400, y: 50 });
      expect(lod).toBe('medium');
    });

    it('should return far LOD for distant objects', () => {
      const lod = optimizer.getLOD({ x: 400, y: 300 }, { x: 400, y: -300 });
      expect(lod).toBe('far');
    });

    it('should return minimal for very distant objects', () => {
      const lod = optimizer.getLOD({ x: 400, y: 300 }, { x: 400, y: -700 });
      expect(lod).toBe('minimal');
    });
  });

  describe('render stats', () => {
    it('should track visible and culled counts', () => {
      const objects = [
        { x: 400, y: 300, width: 32, height: 32 },
        { x: 900, y: 300, width: 32, height: 32 },
        { x: 100, y: 100, width: 32, height: 32 },
      ];
      optimizer.cullBatch(objects, 0, 0);
      const stats = optimizer.getStats();
      expect(stats.visibleCount).toBe(2);
      expect(stats.culledCount).toBe(1);
    });

    it('should reset stats', () => {
      optimizer.cullBatch([{ x: 400, y: 300, width: 32, height: 32 }], 0, 0);
      optimizer.resetStats();
      const stats = optimizer.getStats();
      expect(stats.visibleCount).toBe(0);
      expect(stats.culledCount).toBe(0);
    });

    it('should accumulate stats across calls', () => {
      optimizer.cullBatch([{ x: 400, y: 300, width: 32, height: 32 }], 0, 0);
      optimizer.cullBatch([{ x: 900, y: 300, width: 32, height: 32 }], 0, 0);
      const stats = optimizer.getStats();
      expect(stats.visibleCount).toBe(1);
      expect(stats.culledCount).toBe(1);
    });
  });

  describe('update frequency', () => {
    it('should determine if update should be skipped for culled objects', () => {
      const result = optimizer.cull({ x: 2000, y: 2000, width: 32, height: 32 }, 0, 0);
      expect(result).toBe('culled');
      optimizer.setObjectState('distant_obj', 'culled');
      expect(optimizer.shouldUpdate('distant_obj', 0)).toBe(false);
    });

    it('should allow updates for visible objects', () => {
      optimizer.cull({ x: 400, y: 300, width: 32, height: 32 }, 0, 0);
      optimizer.setObjectState('visible_obj', 'visible');
      expect(optimizer.shouldUpdate('visible_obj', 16.67)).toBe(true);
    });

    it('should throttle updates for far LOD objects', () => {
      const frameTime = 16.67;
      optimizer.setObjectState('far_obj', 'visible');
      expect(optimizer.shouldUpdate('far_obj', frameTime * 4)).toBe(true);
      expect(optimizer.shouldUpdate('far_obj', frameTime * 0.5)).toBe(false);
    });
  });

  describe('viewport resize', () => {
    it('should handle viewport resize', () => {
      optimizer.setViewport(1920, 1080);
      const result = optimizer.cull({ x: 1000, y: 500, width: 32, height: 32 }, 0, 0);
      expect(result).toBe('visible');
    });
  });
});
