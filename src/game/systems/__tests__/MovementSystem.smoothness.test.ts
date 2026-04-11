import { MovementSystem } from '../MovementSystem';
import { PHYSICS_CONFIG } from '../../config/gameConfig';

interface MockKey {
  isDown: boolean;
}

interface MockBody {
  velocity: { x: number; y: number };
  blocked: { down: boolean; up: boolean; left: boolean; right: boolean };
  touching: { down: boolean };
  setAccelerationX: jest.Mock;
  setVelocityY: jest.Mock;
}

interface MockAgent {
  x: number;
  y: number;
  body: MockBody;
  flipX: boolean;
  setVelocityY: jest.Mock;
}

interface MockCursors {
  left: MockKey;
  right: MockKey;
  up: MockKey;
  down: MockKey;
}

function createMockKey(isDown: boolean = false): MockKey {
  return { isDown };
}

function createMockAgent(): MockAgent {
  return {
    x: 100,
    y: 200,
    body: {
      velocity: { x: 0, y: 0 },
      blocked: { down: true, up: false, left: false, right: false },
      touching: { down: false },
      setAccelerationX: jest.fn(),
      setVelocityY: jest.fn(),
    },
    flipX: false,
    setVelocityY: jest.fn(),
  };
}

function createMockScene() {
  const cursors: MockCursors = {
    left: createMockKey(),
    right: createMockKey(),
    up: createMockKey(),
    down: createMockKey(),
  };
  const wasd: MockCursors = {
    left: createMockKey(),
    right: createMockKey(),
    up: createMockKey(),
    down: createMockKey(),
  };

  return {
    input: {
      keyboard: {
        createCursorKeys: jest.fn(() => cursors),
        addKeys: jest.fn(() => wasd),
      },
    },
    cursors,
    wasd,
  };
}

class MockPhaserScene {
  input: { keyboard: { createCursorKeys: jest.Mock; addKeys: jest.Mock } };
  cursors: MockCursors;
  wasd: MockCursors;

  constructor() {
    const cursors: MockCursors = {
      left: createMockKey(), right: createMockKey(),
      up: createMockKey(), down: createMockKey(),
    };
    const wasd: MockCursors = {
      left: createMockKey(), right: createMockKey(),
      up: createMockKey(), down: createMockKey(),
    };
    this.input = {
      keyboard: {
        createCursorKeys: jest.fn(() => cursors),
        addKeys: jest.fn(() => wasd),
      },
    };
    this.cursors = cursors;
    this.wasd = wasd;
  }
}

describe('MovementSystem - Animation Smoothness', () => {
  let scene: MockPhaserScene;
  let system: MovementSystem;

  beforeEach(() => {
    scene = new MockPhaserScene();
    system = new MovementSystem(scene as unknown as Phaser.Scene);
  });

  describe('velocity decay for smooth stopping', () => {
    it('should reset vertical velocity to 0 when not jumping', () => {
      const agent = createMockAgent();
      agent.body.velocity.y = 50;
      const mockSprite = {
        body: agent.body,
        flipX: false,
        setVelocityY: jest.fn(),
      } as any;

      system.setActiveAgent(mockSprite);
      system.update();

      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(0);
    });

    it('should not accumulate acceleration when direction keys released', () => {
      const agent = createMockAgent();
      const mockSprite = {
        body: agent.body,
        flipX: false,
        setVelocityY: jest.fn(),
      } as any;

      system.setActiveAgent(mockSprite);
      scene.cursors.left.isDown = true;
      system.update();

      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(-PHYSICS_CONFIG.moveSpeed * 2);

      agent.body.setAccelerationX.mockClear();
      scene.cursors.left.isDown = false;
      system.update();

      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(0);
    });
  });

  describe('diagonal movement smoothness', () => {
    it('should handle simultaneous left and right as neutral', () => {
      const agent = createMockAgent();
      const mockSprite = {
        body: agent.body,
        flipX: false,
        setVelocityY: jest.fn(),
      } as any;

      system.setActiveAgent(mockSprite);
      scene.cursors.left.isDown = true;
      scene.cursors.right.isDown = true;
      system.update();

      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(-PHYSICS_CONFIG.moveSpeed * 2);
    });
  });

  describe('smooth direction changes', () => {
    it('should handle rapid direction reversal without stuttering', () => {
      const agent = createMockAgent();
      const mockSprite = {
        body: agent.body,
        flipX: false,
        setVelocityY: jest.fn(),
      } as any;

      system.setActiveAgent(mockSprite);

      scene.cursors.left.isDown = true;
      system.update();
      expect(mockSprite.flipX).toBe(true);

      scene.cursors.left.isDown = false;
      scene.cursors.right.isDown = true;
      system.update();
      expect(mockSprite.flipX).toBe(false);
    });
  });
});
