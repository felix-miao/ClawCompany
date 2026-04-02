import { OfficeDecorator, DecorationType } from '../OfficeDecorator';

describe('OfficeDecorator', () => {
  let decorator: OfficeDecorator;

  beforeEach(() => {
    decorator = new OfficeDecorator();
  });

  describe('constructor', () => {
    it('should initialize with no decorations', () => {
      expect(decorator.getDecorationCount()).toBe(0);
    });

    it('should have all decoration types available', () => {
      const types = decorator.getAvailableDecorationTypes();
      expect(types).toContain('plant');
      expect(types).toContain('monitor');
      expect(types).toContain('coffee-cup');
      expect(types).toContain('wall-art');
      expect(types).toContain('bookshelf');
      expect(types).toContain('lamp');
      expect(types).toContain('whiteboard');
      expect(types).toContain('poster');
    });
  });

  describe('getDecorationConfig', () => {
    it('should return config for each decoration type', () => {
      const types = decorator.getAvailableDecorationTypes();
      for (const type of types) {
        const config = decorator.getDecorationConfig(type as DecorationType);
        expect(config).toBeDefined();
        expect(config.width).toBeGreaterThan(0);
        expect(config.height).toBeGreaterThan(0);
      }
    });

    it('should return null for unknown type', () => {
      const config = decorator.getDecorationConfig('unknown' as DecorationType);
      expect(config).toBeNull();
    });
  });

  describe('createDecoration', () => {
    it('should create a decoration and return its id', () => {
      const id = decorator.createDecoration('plant', 100, 200);
      expect(id).toBeTruthy();
    });

    it('should track created decorations', () => {
      decorator.createDecoration('plant', 100, 200);
      decorator.createDecoration('monitor', 300, 400);
      expect(decorator.getDecorationCount()).toBe(2);
    });

    it('should return null for unknown type', () => {
      const id = decorator.createDecoration('unknown' as DecorationType, 0, 0);
      expect(id).toBeNull();
    });
  });

  describe('removeDecoration', () => {
    it('should remove a decoration by id', () => {
      const id = decorator.createDecoration('plant', 100, 200);
      decorator.removeDecoration(id!);
      expect(decorator.getDecorationCount()).toBe(0);
    });

    it('should handle removing non-existent id', () => {
      expect(() => decorator.removeDecoration('non-existent')).not.toThrow();
    });
  });

  describe('removeAllDecorations', () => {
    it('should remove all decorations', () => {
      decorator.createDecoration('plant', 100, 200);
      decorator.createDecoration('monitor', 300, 400);
      decorator.createDecoration('lamp', 500, 600);
      decorator.removeAllDecorations();
      expect(decorator.getDecorationCount()).toBe(0);
    });
  });

  describe('getDecorations', () => {
    it('should return all decorations with details', () => {
      decorator.createDecoration('plant', 100, 200);
      decorator.createDecoration('monitor', 300, 400);
      const decorations = decorator.getDecorations();
      expect(decorations).toHaveLength(2);
      expect(decorations[0].type).toBeDefined();
      expect(decorations[0].x).toBeDefined();
      expect(decorations[0].y).toBeDefined();
      expect(decorations[0].id).toBeTruthy();
    });
  });

  describe('getDecorationsByType', () => {
    it('should filter decorations by type', () => {
      decorator.createDecoration('plant', 100, 200);
      decorator.createDecoration('monitor', 300, 400);
      decorator.createDecoration('plant', 500, 600);
      const plants = decorator.getDecorationsByType('plant');
      expect(plants).toHaveLength(2);
    });

    it('should return empty array for type with no decorations', () => {
      const monitors = decorator.getDecorationsByType('monitor');
      expect(monitors).toHaveLength(0);
    });
  });

  describe('autoDecorate', () => {
    it('should generate decorations for a room layout', () => {
      const platforms = [
        { x: 0, y: 14, width: 20, height: 1, type: 'floor' },
        { x: 2, y: 9, width: 4, height: 0.5, type: 'desk' },
        { x: 6, y: 9, width: 4, height: 0.5, type: 'desk' },
      ];
      decorator.autoDecorate(platforms, 20, 15);
      expect(decorator.getDecorationCount()).toBeGreaterThan(0);
    });

    it('should place monitors on desks', () => {
      const platforms = [
        { x: 0, y: 14, width: 20, height: 1, type: 'floor' },
        { x: 2, y: 9, width: 4, height: 0.5, type: 'desk' },
      ];
      decorator.autoDecorate(platforms, 20, 15);
      const monitors = decorator.getDecorationsByType('monitor');
      expect(monitors.length).toBeGreaterThanOrEqual(1);
    });

    it('should place plants near walls', () => {
      const platforms = [
        { x: 0, y: 14, width: 20, height: 1, type: 'floor' },
        { x: 0, y: 0, width: 1, height: 14, type: 'wall_left' },
      ];
      decorator.autoDecorate(platforms, 20, 15);
      const plants = decorator.getDecorationsByType('plant');
      expect(plants.length).toBeGreaterThanOrEqual(1);
    });

    it('should not place decorations when there are no platforms', () => {
      decorator.autoDecorate([], 20, 15);
      expect(decorator.getDecorationCount()).toBe(0);
    });
  });

  describe('destruction', () => {
    it('should clean up on destroy', () => {
      decorator.createDecoration('plant', 100, 200);
      decorator.destroy();
      expect(decorator.getDecorationCount()).toBe(0);
    });
  });
});
