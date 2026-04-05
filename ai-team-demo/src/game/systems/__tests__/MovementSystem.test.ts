import { MovementSystem } from '../MovementSystem';
import { PHYSICS_CONFIG } from '../../config/gameConfig';

interface MockKey { isDown: boolean; }
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
interface MockScene {
  input: {
    keyboard: {
      createCursorKeys: jest.Mock;
      addKeys: jest.Mock;
    };
  };
  cursors: MockCursors;
  wasd: MockCursors;
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

function createMockScene(): MockScene {
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

describe('MovementSystem', () => {
  let scene: MockScene;
  let system: MovementSystem;

  beforeEach(() => {
    scene = createMockScene();
    system = new MovementSystem(scene as unknown as Phaser.Scene);
  });

  describe('constructor', () => {
    it('should create cursor keys and wasd keys', () => {
      expect(scene.input.keyboard.createCursorKeys).toHaveBeenCalled();
      expect(scene.input.keyboard.addKeys).toHaveBeenCalled();
    });
  });

  describe('setActiveAgent', () => {
    it('should set the active agent', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      expect(() => system.update()).not.toThrow();
    });
  });

  describe('update', () => {
    it('should not do anything without active agent', () => {
      expect(() => system.update()).not.toThrow();
    });

    it('should move left when left key pressed', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      scene.cursors.left.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(-PHYSICS_CONFIG.moveSpeed * 2);
      expect(agent.flipX).toBe(true);
    });

    it('should move right when right key pressed', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      scene.cursors.right.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(PHYSICS_CONFIG.moveSpeed * 2);
      expect(agent.flipX).toBe(false);
    });

    it('should respond to WASD keys', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      scene.wasd.left.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(-PHYSICS_CONFIG.moveSpeed * 2);
    });

    it('should jump when up key pressed and on floor', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      scene.cursors.up.isDown = true;
      agent.body.blocked.down = true;
      system.update();
      expect(agent.setVelocityY).toHaveBeenCalledWith(PHYSICS_CONFIG.jumpForce);
    });

    it('should not jump when not on floor', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      scene.cursors.up.isDown = true;
      agent.body.blocked.down = false;
      agent.body.touching.down = false;
      system.update();
      expect(agent.setVelocityY).not.toHaveBeenCalled();
    });

    it('should set zero acceleration when no keys pressed', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      system.update();
      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(0);
    });

    it('should respect max velocity for left movement', () => {
      const agent = createMockAgent();
      agent.body.velocity.x = -PHYSICS_CONFIG.maxVelocity - 10;
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      scene.cursors.left.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).not.toHaveBeenCalled();
    });

    it('should respect max velocity for right movement', () => {
      const agent = createMockAgent();
      agent.body.velocity.x = PHYSICS_CONFIG.maxVelocity + 10;
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      scene.cursors.right.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).not.toHaveBeenCalled();
    });

    it('should jump with touching.down as well', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as unknown as Phaser.Physics.Arcade.Sprite);
      scene.wasd.up.isDown = true;
      agent.body.blocked.down = false;
      agent.body.touching.down = true;
      system.update();
      expect(agent.setVelocityY).toHaveBeenCalledWith(PHYSICS_CONFIG.jumpForce);
    });
  });
});
