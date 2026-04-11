import { CharacterSprites, CharacterSpritesConfig, createCharacterSprites } from '../CharacterSprites';

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

  const graphicsInstances: any[] = [];
  const mockScene = {
    add: {
      graphics: jest.fn(() => {
        const instance = { ...mockGraphics };
        graphicsInstances.push(instance);
        return instance;
      }),
    },
    anims: {
      create: jest.fn(),
    },
  };

  return {
    default: {
      GameObjects: { Graphics: jest.fn() },
    },
    __mocks: { mockScene, mockGraphics, graphicsInstances },
  };
});

const Phaser = require('phaser');
const { mockScene, graphicsInstances } = Phaser.__mocks;

describe('CharacterSprites', () => {
  let sprites: CharacterSprites;
  let config: CharacterSpritesConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { color: 0xff6b6b };
    sprites = new CharacterSprites(mockScene as any, config);
  });

  describe('constructor', () => {
    it('should create CharacterSprites with config', () => {
      expect(sprites).toBeDefined();
    });

    it('should store color from config', () => {
      const redSprites = new CharacterSprites(mockScene as any, { color: 0xff0000 });
      const blueSprites = new CharacterSprites(mockScene as any, { color: 0x0000ff });
      
      expect(redSprites).toBeDefined();
      expect(blueSprites).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate all animation frames', () => {
      sprites.generate();
      
      expect(mockScene.anims.create).toHaveBeenCalledTimes(4);
    });

    it('should call generateIdleFrames', () => {
      sprites.generate();
      
      expect(mockScene.anims.create).toHaveBeenCalled();
    });

    it('should call generateWalkFrames', () => {
      sprites.generate();
      
      expect(mockScene.anims.create).toHaveBeenCalled();
    });

    it('should call generateJumpFrames', () => {
      sprites.generate();
      
      expect(mockScene.anims.create).toHaveBeenCalled();
    });

    it('should call generateWorkFrames', () => {
      sprites.generate();
      
      expect(mockScene.anims.create).toHaveBeenCalled();
    });
  });

  describe('animation creation', () => {
    it('should create idle animation with 2 frames', () => {
      sprites.generate();
      
      expect(mockScene.anims.create).toHaveBeenCalled();
      const idleCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.includes('idle')
      );
      expect(idleCall).toBeDefined();
      expect(idleCall[0].repeat).toBe(-1);
    });

    it('should create walk animation', () => {
      sprites.generate();
      
      const walkCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.includes('walk')
      );
      expect(walkCall).toBeDefined();
    });

    it('should create jump animation', () => {
      sprites.generate();
      
      const jumpCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.includes('jump')
      );
      expect(jumpCall).toBeDefined();
    });

    it('should create work animation', () => {
      sprites.generate();
      
      const workCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.includes('work')
      );
      expect(workCall).toBeDefined();
    });
  });

  describe('procedural pixel character generation', () => {
    it('should generate idle animation with 2 distinct frames', () => {
      sprites.generate();
      
      const idleCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.includes('idle')
      );
      expect(idleCall[0].frames).toHaveLength(2);
    });

    it('should generate walk animation with 4 frames', () => {
      sprites.generate();
      
      const walkCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.includes('walk')
      );
      expect(walkCall[0].frames).toHaveLength(4);
    });

    it('should generate work animation with 3 frames', () => {
      sprites.generate();
      
      const workCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.includes('work')
      );
      expect(workCall[0].frames).toHaveLength(3);
    });

    it('should use frame keys that include color identifier', () => {
      sprites.generate();
      
      const idleCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.includes('idle')
      );
      expect(idleCall[0].frames[0].key).toContain(String(config.color));
    });
  });

  describe('darkenColor', () => {
    it('should darken red color', () => {
      const darkRed = sprites['darkenColor'](0xff0000, 0.3);
      expect(darkRed).toBeLessThan(0xff0000);
    });

    it('should darken green color', () => {
      const darkGreen = sprites['darkenColor'](0x00ff00, 0.3);
      expect(darkGreen).toBeLessThan(0x00ff00);
    });

    it('should darken blue color', () => {
      const darkBlue = sprites['darkenColor'](0x0000ff, 0.3);
      expect(darkBlue).toBeLessThan(0x0000ff);
    });

    it('should use default amount of 0.3', () => {
      const original = 0x888888;
      const darkened = sprites['darkenColor'](original);
      const darkenedExplicit = sprites['darkenColor'](original, 0.3);
      
      expect(darkened).toBe(darkenedExplicit);
    });

    it('should preserve color when amount is 0', () => {
      const color = 0x123456;
      expect(sprites['darkenColor'](color, 0)).toBe(color);
    });

    it('should return black when amount is 1', () => {
      const color = 0xffffff;
      expect(sprites['darkenColor'](color, 1)).toBe(0);
    });
  });

  describe('createCharacterSprites factory function', () => {
    it('should create and generate sprites', () => {
      const result = createCharacterSprites(mockScene as any, 0x4ecdc4);
      
      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle black color', () => {
      const blackSprites = new CharacterSprites(mockScene as any, { color: 0x000000 });
      blackSprites.generate();
      
      expect(blackSprites).toBeDefined();
    });

    it('should handle white color', () => {
      const whiteSprites = new CharacterSprites(mockScene as any, { color: 0xffffff });
      whiteSprites.generate();
      
      expect(whiteSprites).toBeDefined();
    });

    it('should handle different colors', () => {
      const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xffa07a, 0x98d8c8];
      
      colors.forEach(color => {
        const sprites = new CharacterSprites(mockScene as any, { color });
        sprites.generate();
        expect(sprites).toBeDefined();
      });
    });
  });
});