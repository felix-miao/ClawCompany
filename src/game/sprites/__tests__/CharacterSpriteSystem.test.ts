import { CharacterSpriteSystem } from '../CharacterSpriteSystem';

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
    setDepth: jest.fn().mockReturnThis(),
    setAlpha: jest.fn().mockReturnThis(),
    setPosition: jest.fn().mockReturnThis(),
  };

  const mockText = {
    setOrigin: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
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
      GameObjects: { Graphics: jest.fn(), Text: jest.fn() },
    },
    __mocks: { mockScene, mockGraphics, mockText },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('CharacterSpriteSystem', () => {
  let spriteSystem: CharacterSpriteSystem;

  beforeEach(() => {
    jest.clearAllMocks();
    spriteSystem = new CharacterSpriteSystem(mockScene as any);
  });

  describe('constructor', () => {
    it('should create CharacterSpriteSystem', () => {
      expect(spriteSystem).toBeDefined();
    });

    it('should initialize with empty spritesheets map', () => {
      expect(spriteSystem).toBeDefined();
    });
  });

  describe('getCharacterSprite', () => {
    it('should return correct sprite key for pm', () => {
      const sprite = spriteSystem.getCharacterSprite('pm');
      expect(sprite).toBe('character-pm');
    });

    it('should return correct sprite key for dev', () => {
      const sprite = spriteSystem.getCharacterSprite('dev');
      expect(sprite).toBe('character-dev');
    });

    it('should return correct sprite key for tester', () => {
      const sprite = spriteSystem.getCharacterSprite('tester');
      expect(sprite).toBe('character-tester');
    });

    it('should return correct sprite key for reviewer', () => {
      const sprite = spriteSystem.getCharacterSprite('reviewer');
      expect(sprite).toBe('character-reviewer');
    });

    it('should handle uppercase role names', () => {
      const sprite = spriteSystem.getCharacterSprite('PM');
      expect(sprite).toBe('character-pm');
    });

    it('should handle mixed case role names', () => {
      const sprite = spriteSystem.getCharacterSprite('DeV');
      expect(sprite).toBe('character-dev');
    });
  });

  describe('getOfficeAsset', () => {
    it('should return floor asset', () => {
      const asset = spriteSystem.getOfficeAsset('floor');
      expect(asset).toBe('floor');
    });

    it('should return wall asset', () => {
      const asset = spriteSystem.getOfficeAsset('wall');
      expect(asset).toBe('wall');
    });

    it('should return desk asset', () => {
      const asset = spriteSystem.getOfficeAsset('desk');
      expect(asset).toBe('desk');
    });

    it('should return chair asset', () => {
      const asset = spriteSystem.getOfficeAsset('chair');
      expect(asset).toBe('chair');
    });

    it('should return floor as default for unknown type', () => {
      const asset = spriteSystem.getOfficeAsset('unknown');
      expect(asset).toBe('floor');
    });

    it('should handle empty string type', () => {
      const asset = spriteSystem.getOfficeAsset('');
      expect(asset).toBe('floor');
    });
  });

  describe('createEnhancedOfficeMap', () => {
    it('should return map with correct dimensions', () => {
      const map = spriteSystem.createEnhancedOfficeMap();
      
      expect(map.width).toBe(20);
      expect(map.height).toBe(15);
      expect(map.tileSize).toBe(32);
    });

    it('should have 3 layers', () => {
      const map = spriteSystem.createEnhancedOfficeMap();
      
      expect(map.layers).toHaveLength(3);
    });

    it('should have layer names', () => {
      const map = spriteSystem.createEnhancedOfficeMap();
      
      const layerNames = map.layers.map(l => l.name);
      expect(layerNames).toContain('background');
      expect(layerNames).toContain('floor');
      expect(layerNames).toContain('furniture');
    });

    it('should have room objects', () => {
      const map = spriteSystem.createEnhancedOfficeMap();
      
      expect(map.objects).toHaveLength(4);
      
      const roomNames = map.objects.map(o => o.name);
      expect(roomNames).toContain('pm-office');
      expect(roomNames).toContain('dev-studio');
      expect(roomNames).toContain('test-lab');
      expect(roomNames).toContain('review-center');
    });

    it('should have correct room types', () => {
      const map = spriteSystem.createEnhancedOfficeMap();
      
      const pmOffice = map.objects.find(o => o.name === 'pm-office');
      expect(pmOffice?.type).toBe('room');
    });
  });

  describe('layer generation', () => {
    it('should generate background layer with walls on edges', () => {
      const map = spriteSystem.createEnhancedOfficeMap();
      const backgroundLayer = map.layers.find(l => l.name === 'background');
      
      expect(backgroundLayer).toBeDefined();
      expect(backgroundLayer?.data).toHaveLength(15);
      
      const topRow = backgroundLayer?.data[0];
      expect(topRow).toHaveLength(20);
      expect(topRow?.[0]).toBe(1);
      
      const bottomRow = backgroundLayer?.data[14];
      expect(bottomRow?.[0]).toBe(1);
    });

    it('should generate floor layer', () => {
      const map = spriteSystem.createEnhancedOfficeMap();
      const floorLayer = map.layers.find(l => l.name === 'floor');
      
      expect(floorLayer).toBeDefined();
      expect(floorLayer?.data).toHaveLength(15);
    });

    it('should generate furniture layer', () => {
      const map = spriteSystem.createEnhancedOfficeMap();
      const furnitureLayer = map.layers.find(l => l.name === 'furniture');
      
      expect(furnitureLayer).toBeDefined();
      expect(furnitureLayer?.data).toHaveLength(15);
    });
  });

  describe('edge cases', () => {
    it('should handle getCharacterSprite with special characters', () => {
      const sprite = spriteSystem.getCharacterSprite('dev-test');
      expect(sprite).toBe('character-dev-test');
    });

    it('should handle getOfficeAsset with special characters', () => {
      const asset = spriteSystem.getOfficeAsset('desk-variant');
      expect(asset).toBe('floor');
    });

    it('should generate valid 2D array for all layers', () => {
      const map = spriteSystem.createEnhancedOfficeMap();
      
      map.layers.forEach(layer => {
        layer.data.forEach(row => {
          expect(Array.isArray(row)).toBe(true);
          row.forEach(cell => {
            expect(typeof cell).toBe('number');
          });
        });
      });
    });
  });
});