import { MovementSystem } from '../MovementSystem';
import { PHYSICS_CONFIG } from '../../config/gameConfig';

function createMockKey(isDown: boolean = false) {
  return { isDown };
}

function createMockAgent() {
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
  const cursors = {
    left: createMockKey(),
    right: createMockKey(),
    up: createMockKey(),
    down: createMockKey(),
  };
  const wasd = {
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
  let scene: any;
  let system: MovementSystem;

  beforeEach(() => {
    scene = createMockScene();
    system = new MovementSystem(scene as any);
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
      system.setActiveAgent(agent as any);
      expect(() => system.update()).not.toThrow();
    });
  });

  describe('update', () => {
    it('should not do anything without active agent', () => {
      expect(() => system.update()).not.toThrow();
    });

    it('should move left when left key pressed', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as any);
      scene.cursors.left.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(-PHYSICS_CONFIG.moveSpeed * 2);
      expect(agent.flipX).toBe(true);
    });

    it('should move right when right key pressed', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as any);
      scene.cursors.right.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(PHYSICS_CONFIG.moveSpeed * 2);
      expect(agent.flipX).toBe(false);
    });

    it('should respond to WASD keys', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as any);
      scene.wasd.left.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(-PHYSICS_CONFIG.moveSpeed * 2);
    });

    it('should jump when up key pressed and on floor', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as any);
      scene.cursors.up.isDown = true;
      agent.body.blocked.down = true;
      system.update();
      expect(agent.setVelocityY).toHaveBeenCalledWith(PHYSICS_CONFIG.jumpForce);
    });

    it('should not jump when not on floor', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as any);
      scene.cursors.up.isDown = true;
      agent.body.blocked.down = false;
      agent.body.touching.down = false;
      system.update();
      expect(agent.setVelocityY).not.toHaveBeenCalled();
    });

    it('should set zero acceleration when no keys pressed', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as any);
      system.update();
      expect(agent.body.setAccelerationX).toHaveBeenCalledWith(0);
    });

    it('should respect max velocity for left movement', () => {
      const agent = createMockAgent();
      agent.body.velocity.x = -PHYSICS_CONFIG.maxVelocity - 10;
      system.setActiveAgent(agent as any);
      scene.cursors.left.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).not.toHaveBeenCalled();
    });

    it('should respect max velocity for right movement', () => {
      const agent = createMockAgent();
      agent.body.velocity.x = PHYSICS_CONFIG.maxVelocity + 10;
      system.setActiveAgent(agent as any);
      scene.cursors.right.isDown = true;
      system.update();
      expect(agent.body.setAccelerationX).not.toHaveBeenCalled();
    });

    it('should jump with touching.down as well', () => {
      const agent = createMockAgent();
      system.setActiveAgent(agent as any);
      scene.wasd.up.isDown = true;
      agent.body.blocked.down = false;
      agent.body.touching.down = true;
      system.update();
      expect(agent.setVelocityY).toHaveBeenCalledWith(PHYSICS_CONFIG.jumpForce);
    });
  });
});
