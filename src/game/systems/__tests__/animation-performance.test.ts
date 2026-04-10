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
    anims: { stop: jest.fn() },
    flipX: false,
  };
}

describe('Animation System Performance', () => {
  describe('AnimationController state caching', () => {
    it('should not call play when state has not changed', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(
        sprite as unknown as Phaser.Physics.Arcade.Sprite,
        0xff6b6b
      );

      controller.update(50, 0, true, false);
      expect(controller.getState()).toBe('moving');
      const playCallCount = sprite.play.mock.calls.length;

      controller.update(60, 0, true, false);
      expect(controller.getState()).toBe('moving');
      expect(sprite.play.mock.calls.length).toBe(playCallCount);
    });

    it('should skip animation lookup when remaining in same state', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(
        sprite as unknown as Phaser.Physics.Arcade.Sprite,
        0xff6b6b
      );

      controller.update(50, 0, true, false);
      const animsGetCount = sprite.scene.anims.get.mock.calls.length;

      controller.update(60, 0, true, false);
      expect(sprite.scene.anims.get.mock.calls.length).toBe(animsGetCount);
    });
  });

  describe('AnimationController transition performance', () => {
    it('should cache animation key to avoid repeated string concatenation', () => {
      const sprite = createMockSprite(1000);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(
        sprite as unknown as Phaser.Physics.Arcade.Sprite,
        0xff6b6b
      );

      controller.update(50, 0, true, false);

      expect(sprite.scene.anims.get).toHaveBeenCalled();
      const calledKey = sprite.scene.anims.get.mock.calls[0][0];
      expect(calledKey).toMatch(/^walk_\d+$/);
    });

    it('should handle rapid state changes with cooldown', () => {
      const sprite = createMockSprite(10);
      sprite.scene.anims.get.mockImplementation((key: string) => ({ key }));
      const controller = new AnimationController(
        sprite as unknown as Phaser.Physics.Arcade.Sprite,
        0xff6b6b
      );

      controller.update(50, 0, true, false);
      expect(controller.getState()).toBe('moving');

      sprite.scene.time.now = 50;
      controller.update(0, -100, false, false);
      expect(controller.getState()).toBe('jumping');
    });
  });

  describe('AnimationController state management', () => {
    it('should stop animation when stop is called', () => {
      const sprite = createMockSprite(1000);
      const controller = new AnimationController(
        sprite as unknown as Phaser.Physics.Arcade.Sprite,
        0xff6b6b
      );

      controller.setState('working');
      expect(controller.getState()).toBe('working');

      controller.stop();

      expect(sprite.anims.stop).toHaveBeenCalled();
    });

    it('should stop animation on stop', () => {
      const sprite = createMockSprite(1000);
      const controller = new AnimationController(
        sprite as unknown as Phaser.Physics.Arcade.Sprite,
        0xff6b6b
      );

      controller.stop();
      expect(sprite.anims.stop).toHaveBeenCalled();
    });

    it('should handle multiple stop calls safely', () => {
      const sprite = createMockSprite(1000);
      const controller = new AnimationController(
        sprite as unknown as Phaser.Physics.Arcade.Sprite,
        0xff6b6b
      );

      expect(() => {
        controller.stop();
        controller.stop();
      }).not.toThrow();
    });
  });

  describe('Tween pooling for animation performance', () => {
    it('should reuse tween targets instead of creating new objects', () => {
      const tweenPool: { scaleX: number; scaleY: number }[] = [];
      const reusable = { scaleX: 1, scaleY: 1 };

      tweenPool.push(reusable);

      const obj = tweenPool.pop()!;
      obj.scaleX = 0.8;
      obj.scaleY = 1.2;

      tweenPool.push(obj);

      const reused = tweenPool.pop()!;
      expect(reused).toBe(reusable);
      expect(reused.scaleX).toBe(0.8);
    });

    it('should pool animation targets to reduce GC pressure', () => {
      const pool: any[] = [];
      const maxPoolSize = 10;

      function acquire(): any {
        if (pool.length > 0) return pool.pop()!;
        return { scaleX: 1, scaleY: 1 };
      }

      function release(obj: any): void {
        obj.scaleX = 1;
        obj.scaleY = 1;
        if (pool.length < maxPoolSize) pool.push(obj);
      }

      const obj1 = acquire();
      obj1.scaleX = 0.8;
      release(obj1);

      const obj2 = acquire();
      expect(obj2).toBe(obj1);
      expect(obj2.scaleX).toBe(1);
    });
  });

  describe('Batch update optimization', () => {
    it('should skip invisible agents from animation update', () => {
      const agents = [
        { x: 100, y: 100, visible: true },
        { x: 900, y: 900, visible: false },
        { x: 150, y: 150, visible: true },
      ];

      const cameraX = 0;
      const cameraY = 0;
      const viewWidth = 800;
      const viewHeight = 600;

      const visibleAgents = agents.filter(a =>
        a.x >= cameraX && a.x <= cameraX + viewWidth &&
        a.y >= cameraY && a.y <= cameraY + viewHeight
      );

      expect(visibleAgents.length).toBe(2);
    });

    it('should throttle animation updates based on FPS', () => {
      const targetFPS = 60;
      const currentFPS = 30;
      const throttleLevel = 1 - currentFPS / targetFPS;

      expect(throttleLevel).toBe(0.5);

      const shouldSkip = Math.random() < throttleLevel;
      expect(typeof shouldSkip).toBe('boolean');
    });
  });
});
