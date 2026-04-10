import { TinyTownLoader, TinyTownConfig } from '../TinyTownLoader';

jest.mock('phaser', () => {
  const mockGraphics = {
    clear: jest.fn(),
    fillStyle: jest.fn().mockReturnThis(),
    fillRect: jest.fn().mockReturnThis(),
    fillRoundedRect: jest.fn().mockReturnThis(),
    lineStyle: jest.fn().mockReturnThis(),
    strokeRect: jest.fn().mockReturnThis(),
    arc: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    generateTexture: jest.fn(),
    destroy: jest.fn(),
  };

  const mockText = {
    setOrigin: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };

  const mockScene = {
    add: {
      graphics: jest.fn(() => ({ ...mockGraphics })),
      text: jest.fn(() => ({ ...mockText })),
    },
    anims: {
      create: jest.fn(),
    },
  };

  return {
    default: {
      GameObjects: { Graphics: jest.fn() },
      GameObjects: { Text: jest.fn() },
    },
    __mocks: { mockScene, mockGraphics, mockText },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('TinyTownLoader', () => {
  let loader: TinyTownLoader;
  let config: TinyTownConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { prefix: 'tiny-town', tileSize: 32 };
    loader = new TinyTownLoader(mockScene as any, config);
  });

  describe('constructor', () => {
    it('should create TinyTownLoader with config', () => {
      expect(loader).toBeDefined();
    });

    it('should use default config values', () => {
      const loaderWithDefaults = new TinyTownLoader(mockScene as any);
      expect(loaderWithDefaults).toBeDefined();
    });

    it('should set custom prefix', () => {
      const customLoader = new TinyTownLoader(mockScene as any, { prefix: 'custom' });
      expect(customLoader).toBeDefined();
    });

    it('should set custom tileSize', () => {
      const customLoader = new TinyTownLoader(mockScene as any, { tileSize: 64 });
      expect(customLoader).toBeDefined();
    });
  });

  describe('loadResources', () => {
    it('should load resources without errors', async () => {
      await expect(loader.loadResources()).resolves.not.toThrow();
    });

    it('should resolve promise', async () => {
      await expect(loader.loadResources()).resolves.toBeUndefined();
    });
  });

  describe('getCharacterSprite', () => {
    it('should return character sprite for pm', () => {
      const sprite = loader.getCharacterSprite('pm');
      expect(sprite).toBe('character-pm');
    });

    it('should return character sprite for dev', () => {
      const sprite = loader.getCharacterSprite('dev');
      expect(sprite).toBe('character-dev');
    });

    it('should return character sprite for tester', () => {
      const sprite = loader.getCharacterSprite('tester');
      expect(sprite).toBe('character-tester');
    });

    it('should return character sprite for reviewer', () => {
      const sprite = loader.getCharacterSprite('reviewer');
      expect(sprite).toBe('character-reviewer');
    });

    it('should handle custom role names', () => {
      const sprite = loader.getCharacterSprite('custom-role');
      expect(sprite).toBe('character-custom-role');
    });
  });

  describe('getEnvironmentTile', () => {
    it('should return floor tile', () => {
      const tile = loader.getEnvironmentTile('floor');
      expect(tile).toBe('floor');
    });

    it('should return wall tile', () => {
      const tile = loader.getEnvironmentTile('wall');
      expect(tile).toBe('wall');
    });

    it('should return desk tile', () => {
      const tile = loader.getEnvironmentTile('desk');
      expect(tile).toBe('desk');
    });

    it('should return chair tile', () => {
      const tile = loader.getEnvironmentTile('chair');
      expect(tile).toBe('chair');
    });

    it('should return floor as default for unknown type', () => {
      const tile = loader.getEnvironmentTile('unknown');
      expect(tile).toBe('floor');
    });

    it('should accept variant parameter', () => {
      const tile1 = loader.getEnvironmentTile('floor', 0);
      const tile2 = loader.getEnvironmentTile('floor', 5);
      
      expect(tile1).toBe('floor');
      expect(tile2).toBe('floor');
    });
  });

  describe('isTinyTownAvailable', () => {
    it('should return false by default', () => {
      expect(loader.isTinyTownAvailable()).toBe(false);
    });
  });

  describe('internal resource generation', () => {
    it('should create default character sprites', async () => {
      await loader.loadResources();
      
      expect(mockScene.add.graphics).toHaveBeenCalled();
      expect(mockScene.anims.create).toHaveBeenCalled();
    });

    it('should create environment tiles', async () => {
      await loader.loadResources();
      
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });
  });

  describe('animation creation', () => {
    it('should create idle animation', async () => {
      await loader.loadResources();
      
      const idleCalls = mockScene.anims.create.mock.calls.filter(
        (call: any[]) => call[0].key?.includes('idle')
      );
      expect(idleCalls.length).toBeGreaterThan(0);
    });

    it('should create walk animation', async () => {
      await loader.loadResources();
      
      const walkCalls = mockScene.anims.create.mock.calls.filter(
        (call: any[]) => call[0].key?.includes('walk')
      );
      expect(walkCalls.length).toBeGreaterThan(0);
    });

    it('should create work animation', async () => {
      await loader.loadResources();
      
      const workCalls = mockScene.anims.create.mock.calls.filter(
        (call: any[]) => call[0].key?.includes('work')
      );
      expect(workCalls.length).toBeGreaterThan(0);
    });
  });

  describe('texture generation', () => {
    it('should generate character textures', async () => {
      await loader.loadResources();
      
      const graphicsCalls = mockScene.add.graphics.mock.calls;
      expect(graphicsCalls.length).toBeGreaterThan(0);
    });

    it('should generate floor texture', async () => {
      await loader.loadResources();
      
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty config', () => {
      expect(() => {
        new TinyTownLoader(mockScene as any, {});
      }).not.toThrow();
    });

    it('should handle loadResources called multiple times', async () => {
      await loader.loadResources();
      await loader.loadResources();
      
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });

    it('should handle empty role string', () => {
      const sprite = loader.getCharacterSprite('');
      expect(sprite).toBe('character-');
    });

    it('should handle empty tile type', () => {
      const tile = loader.getEnvironmentTile('');
      expect(tile).toBe('floor');
    });

    it('should resolve loadResources without requiring timer advancement', async () => {
      jest.useFakeTimers();
      const timerLoader = new TinyTownLoader(mockScene as any);
      const promise = timerLoader.loadResources();
      const result = await Promise.race([
        promise.then(() => 'resolved'),
        jest.advanceTimersByTimeAsync(0).then(() => 'pending'),
      ]);
      expect(result).toBe('resolved');
      jest.useRealTimers();
    });
  });
});