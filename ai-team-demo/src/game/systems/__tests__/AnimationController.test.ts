import { AnimationController, AnimationState } from '../AnimationController';

function createMockSprite(timeNow: number = 0) {
  const animations = new Map<string, { key: string }>();
  return {
    scene: {
      time: { now: timeNow },
      anims: {
        get: jest.fn((key: string) => animations.get(key)),
        create: jest.fn(),
      },
    },
    play: jest.fn(),
    setFlipX: jest.fn(),
    anims_stop: jest.fn(),
    flipX: false,
  };
}

describe('AnimationController', () => {
  describe('constructor', () => {
    it('should initialize with idle state', () => {
      const sprite = createMockSprite();
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      expect(controller.getState()).toBe('idle');
    });
  });

  describe('setState / getState', () => {
    it('should set and get state', () => {
      const sprite = createMockSprite();
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.setState('working');
      expect(controller.getState()).toBe('working');
    });
  });

  describe('update', () => {
    it('should transition to working when isWorking is true', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockReturnValue({ key: 'working_0xff6b6b' });
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.update(0, 0, true, true);
      expect(controller.getState()).toBe('working');
    });

    it('should transition to jumping when not on floor and velocityY < -50', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.update(0, -100, false, false);
      expect(controller.getState()).toBe('jumping');
    });

    it('should transition to moving when velocityX > 10', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.update(50, 0, true, false);
      expect(controller.getState()).toBe('moving');
    });

    it('should set flipX false when moving right', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.update(50, 0, true, false);
      expect(sprite.setFlipX).toHaveBeenCalledWith(false);
    });

    it('should set flipX true when moving left', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.update(-50, 0, true, false);
      expect(sprite.setFlipX).toHaveBeenCalledWith(true);
    });

    it('should transition to idle when nearly stationary', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.setState('moving');
      controller.update(5, 0, true, false);
      expect(controller.getState()).toBe('idle');
    });

    it('should not transition if animation key not found', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockReturnValue(undefined);
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.update(50, 0, true, true);
      expect(controller.getState()).toBe('idle');
    });
  });

  describe('forcePlay', () => {
    it('should force play animation state', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.forcePlay('jumping');
      expect(controller.getState()).toBe('jumping');
    });

    it('should override transition cooldown', () => {
      const sprite = createMockSprite(100);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(sprite as any, 0xff6b6b);

      controller.update(50, 0, true, false);
      controller.update(-50, 0, true, false);

      controller.forcePlay('working');
      expect(controller.getState()).toBe('working');
    });
  });

  describe('stop', () => {
    it('should call stop on sprite anims', () => {
      const sprite = createMockSprite(1000);
      sprite.anims = { stop: jest.fn() };
      const controller = new AnimationController(sprite as any, 0xff6b6b);
      controller.stop();
      expect(sprite.anims.stop).toHaveBeenCalled();
    });
  });

  describe('transition cooldown', () => {
    it('should respect transition cooldown', () => {
      const sprite = createMockSprite(10);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(sprite as any, 0xff6b6b);

      controller.update(50, 0, true, false);

      (sprite.scene.time as any).now = 50;
      controller.update(0, -100, false, false);

      expect(controller.getState()).toBe('jumping');
    });

    it('should allow transition after cooldown expires', () => {
      const sprite = createMockSprite(10);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(sprite as any, 0xff6b6b);

      controller.update(50, 0, true, false);

      (sprite.scene.time as any).now = 200;
      controller.update(0, -100, false, false);

      expect(controller.getState()).toBe('jumping');
    });
  });
});
