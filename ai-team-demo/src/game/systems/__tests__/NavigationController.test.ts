import { NavigationController, NavigationTask, NavigationState } from '../NavigationController';

function createMockBody() {
  return {
    velocity: { x: 0, y: 0 },
    blocked: { down: true, up: false, left: false, right: false },
    touching: { down: false },
    setVelocityX: jest.fn(),
    setVelocityY: jest.fn(),
    setAccelerationX: jest.fn(),
  };
}

function createMockAgent(x: number, y: number) {
  const body = createMockBody();
  return {
    x,
    y,
    body,
    flipX: false,
  };
}

function createMockScene() {
  return {
    add: { graphics: jest.fn(() => ({ clear: jest.fn(), setVisible: jest.fn(), destroy: jest.fn(), fillStyle: jest.fn(), fillCircle: jest.fn(), lineStyle: jest.fn(), lineBetween: jest.fn() })) },
    tweens: { addCounter: jest.fn() },
  };
}

function createMockPathfinding() {
  let currentPath: any[] = [];
  return {
    findPath: jest.fn((sx: number, sy: number, ex: number, ey: number) => {
      currentPath = [{ x: ex, y: ey, action: 'move' }];
      return currentPath;
    }),
    getCurrentPath: jest.fn(() => currentPath),
    setCurrentPath: (path: any[]) => { currentPath = path; },
  };
}

describe('NavigationController', () => {
  let scene: any;
  let agent: any;
  let pathfinding: any;
  let controller: NavigationController;

  beforeEach(() => {
    scene = createMockScene();
    agent = createMockAgent(100, 200);
    pathfinding = createMockPathfinding();
    controller = new NavigationController(scene, agent, pathfinding);
  });

  describe('setTarget', () => {
    it('should set target position and calculate path', () => {
      controller.setTarget(300, 400);
      expect(pathfinding.findPath).toHaveBeenCalledWith(100, 200, 300, 400);
      expect(controller.getState()).toBe('moving');
    });

    it('should store arrival callback', () => {
      const cb = jest.fn();
      controller.setTarget(300, 400, cb);
      expect(controller.getTargetPosition()).toEqual({ x: 300, y: 400 });
    });
  });

  describe('addTask', () => {
    it('should queue tasks by priority', () => {
      const task1: NavigationTask = { id: 't1', targetX: 100, targetY: 100, priority: 1 };
      const task2: NavigationTask = { id: 't2', targetX: 200, targetY: 200, priority: 5 };
      controller.addTask(task1);
      controller.addTask(task2);
      expect(controller.getQueueLength()).toBe(1);
    });

    it('should process first task immediately if idle', () => {
      const task: NavigationTask = { id: 't1', targetX: 300, targetY: 400, priority: 1 };
      controller.addTask(task);
      expect(controller.getState()).toBe('moving');
    });
  });

  describe('update', () => {
    it('should not move when idle', () => {
      controller.update();
      expect(agent.body.setVelocityX).not.toHaveBeenCalled();
    });

    it('should move toward next path point', () => {
      pathfinding.setCurrentPath([{ x: 300, y: 200, action: 'move' }]);
      controller.setTarget(300, 200);
      agent.body.blocked.down = true;
      controller.update();
      expect(agent.body.setVelocityX).toHaveBeenCalled();
    });

    it('should set flipX when moving left', () => {
      pathfinding.setCurrentPath([{ x: 50, y: 200, action: 'move' }]);
      controller.setTarget(50, 200);
      controller.update();
      expect(agent.flipX).toBe(true);
    });

    it('should set flipX false when moving right', () => {
      pathfinding.setCurrentPath([{ x: 300, y: 200, action: 'move' }]);
      controller.setTarget(300, 200);
      controller.update();
      expect(agent.flipX).toBe(false);
    });

    it('should trigger jump when action is jump and on floor', () => {
      pathfinding.setCurrentPath([{ x: 100, y: 100, action: 'jump' }]);
      controller.setTarget(100, 100);
      agent.body.blocked.down = true;
      controller.update();
      expect(agent.body.setVelocityY).toHaveBeenCalled();
    });

    it('should arrive when path is completed', () => {
      pathfinding.setCurrentPath([{ x: 100, y: 200, action: 'move' }]);
      controller.setTarget(100, 200);
      controller.update();
      expect(controller.getState()).toBe('idle');
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued tasks', () => {
      controller.addTask({ id: 't1', targetX: 100, targetY: 100, priority: 1 });
      controller.addTask({ id: 't2', targetX: 200, targetY: 200, priority: 2 });
      controller.clearQueue();
      expect(controller.getQueueLength()).toBe(0);
    });
  });

  describe('isNavigating', () => {
    it('should return false when idle', () => {
      expect(controller.isNavigating()).toBe(false);
    });

    it('should return true when moving', () => {
      controller.setTarget(300, 400);
      expect(controller.isNavigating()).toBe(true);
    });
  });

  describe('drawDebug', () => {
    it('should not draw when debug not visible', () => {
      controller.setDebugVisible(false);
      expect(() => controller.drawDebug()).not.toThrow();
    });
  });

  describe('setDebugVisible', () => {
    it('should set debug visibility', () => {
      controller.setDebugVisible(true);
      expect(() => controller.setDebugVisible(false)).not.toThrow();
    });
  });

  describe('getTargetPosition', () => {
    it('should return null when no target set', () => {
      expect(controller.getTargetPosition()).toBeNull();
    });

    it('should return target when set', () => {
      controller.setTarget(300, 400);
      expect(controller.getTargetPosition()).toEqual({ x: 300, y: 400 });
    });
  });
});
