import { gameConfig, PHYSICS_CONFIG, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../gameConfig';

describe('gameConfig', () => {
  describe('gameConfig object', () => {
    it('should have correct type', () => {
      expect(gameConfig.type).toBeDefined();
    });

    it('should have correct width', () => {
      expect(gameConfig.width).toBe(1200);
    });

    it('should have correct height', () => {
      expect(gameConfig.height).toBe(700);
    });

    it('should have background color', () => {
      expect(gameConfig.backgroundColor).toBe('#1a1a2e');
    });

    it('should have parent container', () => {
      expect(gameConfig.parent).toBe('game-container');
    });

    it('should have scale configuration', () => {
      expect(gameConfig.scale).toBeDefined();
      expect(gameConfig.scale.mode).toBeDefined();
      expect(gameConfig.scale.autoCenter).toBeDefined();
    });

    it('should have physics configuration', () => {
      expect(gameConfig.physics).toBeDefined();
      expect(gameConfig.physics.default).toBe('arcade');
      expect(gameConfig.physics.arcade).toBeDefined();
    });

    it('should have empty scene array', () => {
      expect(gameConfig.scene).toEqual([]);
    });

    it('should have arcade physics with no gravity', () => {
      expect(gameConfig.physics.arcade.gravity).toEqual({ x: 0, y: 0 });
    });

    it('should have debug set to false', () => {
      expect(gameConfig.physics.arcade.debug).toBe(false);
    });
  });

  describe('PHYSICS_CONFIG', () => {
    it('should have zero gravity', () => {
      expect(PHYSICS_CONFIG.gravity).toBe(0);
    });

    it('should have zero jump force', () => {
      expect(PHYSICS_CONFIG.jumpForce).toBe(0);
    });

    it('should have move speed of 150', () => {
      expect(PHYSICS_CONFIG.moveSpeed).toBe(150);
    });

    it('should have max velocity of 200', () => {
      expect(PHYSICS_CONFIG.maxVelocity).toBe(200);
    });

    it('should have drag of 600', () => {
      expect(PHYSICS_CONFIG.drag).toBe(600);
    });
  });

  describe('constants', () => {
    it('should have TILE_SIZE of 32', () => {
      expect(TILE_SIZE).toBe(32);
    });

    it('should have MAP_WIDTH of 38', () => {
      expect(MAP_WIDTH).toBe(38);
    });

    it('should have MAP_HEIGHT of 22', () => {
      expect(MAP_HEIGHT).toBe(22);
    });
  });

  describe('edge cases', () => {
    it('should have valid game dimensions', () => {
      expect(gameConfig.width).toBeGreaterThan(0);
      expect(gameConfig.height).toBeGreaterThan(0);
    });

    it('should have valid tile size', () => {
      expect(TILE_SIZE).toBeGreaterThan(0);
      expect(TILE_SIZE % 2).toBe(0);
    });

    it('should have valid map dimensions', () => {
      expect(MAP_WIDTH).toBeGreaterThan(0);
      expect(MAP_HEIGHT).toBeGreaterThan(0);
    });

    it('should have valid physics values', () => {
      expect(PHYSICS_CONFIG.moveSpeed).toBeGreaterThan(0);
      expect(PHYSICS_CONFIG.maxVelocity).toBeGreaterThan(PHYSICS_CONFIG.moveSpeed);
      expect(PHYSICS_CONFIG.drag).toBeGreaterThan(0);
    });

    it('should use Phaser scale modes', () => {
      expect(gameConfig.scale.mode).toBeDefined();
      expect(gameConfig.scale.autoCenter).toBeDefined();
    });
  });
});