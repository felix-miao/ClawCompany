import { CharacterSprites } from '../sprites/CharacterSprites';
import { AnimationController, AnimationState } from '../systems/AnimationController';

const animationsMap = new Map([
  ['idle_0xff6b6b', { key: 'idle_0xff6b6b' }],
  ['walk_0xff6b6b', { key: 'walk_0xff6b6b' }],
  ['moving_0xff6b6b', { key: 'walk_0xff6b6b' }],
  ['jump_0xff6b6b', { key: 'jump_0xff6b6b' }],
  ['work_0xff6b6b', { key: 'work_0xff6b6b' }],
  ['working_0xff6b6b', { key: 'work_0xff6b6b' }],
]);

const mockScene = {
  add: {
    graphics: jest.fn(() => ({
      clear: jest.fn(),
      fillStyle: jest.fn().mockReturnThis(),
      fillRect: jest.fn().mockReturnThis(),
      generateTexture: jest.fn(),
      destroy: jest.fn(),
    })),
  },
  anims: {
    create: jest.fn((config) => {
      animationsMap.set(config.key, { key: config.key });
    }),
  },
};

const mockSprite = {
  scene: {
    time: { now: 1000 },
    anims: {
      get: jest.fn((key: string) => animationsMap.get(key)),
    },
  },
  play: jest.fn(),
  setFlipX: jest.fn(),
  anims: { stop: jest.fn() },
  flipX: false,
};

describe('Character Animation Integration', () => {
  const color = 0xff6b6b;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CharacterSprites generates animations with correct keys', () => {
    it('should generate walk animation with key walk_COLOR', () => {
      const sprites = new CharacterSprites(mockScene as any, { color });
      sprites.generate();

      const walkCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.startsWith('walk')
      );
      expect(walkCall).toBeDefined();
      expect(walkCall[0].key).toBe(`walk_${color}`);
    });

    it('should generate idle animation', () => {
      const sprites = new CharacterSprites(mockScene as any, { color });
      sprites.generate();

      const idleCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.startsWith('idle')
      );
      expect(idleCall).toBeDefined();
    });

    it('should generate work animation', () => {
      const sprites = new CharacterSprites(mockScene as any, { color });
      sprites.generate();

      const workCall = mockScene.anims.create.mock.calls.find(
        (call: any[]) => call[0].key && call[0].key.startsWith('work')
      );
      expect(workCall).toBeDefined();
    });
  });

  describe('AnimationController expects matching animation keys', () => {
    it('should play walking animation when velocityX > 10', () => {
      const controller = new AnimationController(
        mockSprite as any,
        color
      );
      controller.update(50, 0, true, false);
      expect(controller.getState()).toBe('moving');
    });

    it('should play working animation when isWorking is true', () => {
      const controller = new AnimationController(
        mockSprite as any,
        color
      );
      controller.update(0, 0, true, true);
      expect(controller.getState()).toBe('working');
    });
  });

  describe('INTEGRATION: CharacterSprites and AnimationController keys must match', () => {
    it('should have matching keys for walk/moving animation', () => {
      const sprites = new CharacterSprites(mockScene as any, { color });
      sprites.generate();

      const walkKey = `walk_${color}`;
      const spriteAnim = mockSprite.scene.anims.get(walkKey);

      const controller = new AnimationController(mockSprite as any, color);
      controller.update(50, 0, true, false);

      expect(spriteAnim).toBeDefined();
      expect(controller.getState()).toBe('moving');
      expect(mockSprite.play).toHaveBeenCalledWith(walkKey);
    });

    it('should have matching keys for work/working animation', () => {
      const sprites = new CharacterSprites(mockScene as any, { color });
      sprites.generate();

      const workKey = `work_${color}`;
      const spriteAnim = mockSprite.scene.anims.get(workKey);

      const controller = new AnimationController(mockSprite as any, color);
      controller.update(0, 0, true, true);

      expect(spriteAnim).toBeDefined();
      expect(controller.getState()).toBe('working');
      expect(mockSprite.play).toHaveBeenCalledWith(workKey);
    });
  });
});