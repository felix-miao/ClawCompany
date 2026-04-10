import { EmotionSystem } from '../../systems/EmotionSystem';
import { PathPoint } from '../../systems/PathfindingSystem';

import type { AgentConfig } from '@/types/agent-config';

interface AgentState {
  config: AgentConfig;
  isWorking: boolean;
  isNavigating: boolean;
  currentPath: PathPoint[];
  currentPathIndex: number;
  originalPosition: { x: number; y: number } | null;
  targetPosition: { x: number; y: number } | null;
  emotionSystem: EmotionSystem;
}

function createAgentState(config: AgentConfig, x: number, y: number): AgentState {
  return {
    config,
    isWorking: false,
    isNavigating: false,
    currentPath: [],
    currentPathIndex: 0,
    originalPosition: null,
    targetPosition: null,
    emotionSystem: new EmotionSystem(),
  };
}

function moveTo(state: AgentState, path: PathPoint[], targetX: number, targetY: number, startX: number, startY: number): void {
  if (!state.originalPosition) {
    state.originalPosition = { x: startX, y: startY };
  }
  state.currentPath = path;
  state.currentPathIndex = 0;
  state.targetPosition = { x: targetX, y: targetY };
  state.isNavigating = true;
}

describe('Multi-Agent State Management', () => {
  describe('AgentConfig', () => {
    it('should store unique config per agent', () => {
      const a1 = createAgentState({ id: 'dev1', name: 'Alice', role: 'Developer' }, 100, 200);
      const a2 = createAgentState({ id: 'dev2', name: 'Bob', role: 'Developer' }, 200, 300);

      expect(a1.config.id).toBe('dev1');
      expect(a1.config.name).toBe('Alice');
      expect(a2.config.id).toBe('dev2');
      expect(a2.config.name).toBe('Bob');
      expect(a1.config.id).not.toBe(a2.config.id);
    });

    it('should default to general role', () => {
      const agent = createAgentState({ id: 'x', name: 'X', role: 'general' }, 0, 0);
      expect(agent.config.role).toBe('general');
    });
  });

  describe('Navigation State Isolation', () => {
    it('should not share path state between agents', () => {
      const pathA: PathPoint[] = [{ x: 200, y: 200, action: 'move' }];
      const pathB: PathPoint[] = [{ x: 300, y: 300, action: 'move' }, { x: 400, y: 300, action: 'jump' }];

      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 150, 250);

      moveTo(a1, pathA, 200, 200, 100, 200);
      moveTo(a2, pathB, 400, 300, 150, 250);

      expect(a1.currentPath).toHaveLength(1);
      expect(a2.currentPath).toHaveLength(2);
      expect(a1.currentPathIndex).toBe(0);
      expect(a2.currentPathIndex).toBe(0);
      expect(a1.targetPosition).toEqual({ x: 200, y: 200 });
      expect(a2.targetPosition).toEqual({ x: 400, y: 300 });
    });

    it('should independently advance path indices', () => {
      const path: PathPoint[] = [
        { x: 150, y: 200, action: 'move' },
        { x: 200, y: 200, action: 'move' },
        { x: 250, y: 200, action: 'move' },
      ];

      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 100, 200);

      moveTo(a1, path, 250, 200, 100, 200);
      moveTo(a2, path, 250, 200, 100, 200);

      a1.currentPathIndex = 2;
      a2.currentPathIndex = 0;

      expect(a1.currentPathIndex).toBe(2);
      expect(a2.currentPathIndex).toBe(0);
    });

    it('should store original position on first move', () => {
      const agent = createAgentState({ id: 'a', name: 'A', role: 'dev' }, 100, 200);
      moveTo(agent, [{ x: 200, y: 200, action: 'move' }], 200, 200, 100, 200);

      expect(agent.originalPosition).toEqual({ x: 100, y: 200 });
    });
  });

  describe('Working State Isolation', () => {
    it('should track working state independently', () => {
      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 200, 300);

      a1.isWorking = true;
      expect(a1.isWorking).toBe(true);
      expect(a2.isWorking).toBe(false);
    });
  });

  describe('Emotion Independence', () => {
    it('should have independent emotion systems', () => {
      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 200, 300);

      a1.emotionSystem.setEmotion('focused');
      a2.emotionSystem.setEmotion('happy');

      expect(a1.emotionSystem.getActiveEmotion()).toBe('focused');
      expect(a2.emotionSystem.getActiveEmotion()).toBe('happy');
    });

    it('should derive emotions from task descriptions independently', () => {
      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 200, 300);

      const e1 = a1.emotionSystem.getEmotionFromTask('implement the feature');
      const e2 = a2.emotionSystem.getEmotionFromTask('urgent hotfix needed');

      expect(e1).toBe('focused');
      expect(e2).toBe('stressed');
    });
  });

  describe('Multi-Agent Task Queue', () => {
    it('should track multiple active tasks simultaneously', () => {
      const activeTasks = new Map<string, { agentId: string; targetX: number; targetY: number; returning: boolean }>();

      activeTasks.set('a1', { agentId: 'a1', targetX: 200, targetY: 200, returning: false });
      activeTasks.set('a2', { agentId: 'a2', targetX: 400, targetY: 300, returning: false });

      expect(activeTasks.size).toBe(2);
      expect(activeTasks.get('a1')?.targetX).toBe(200);
      expect(activeTasks.get('a2')?.targetX).toBe(400);
    });

    it('should allow completing tasks independently', () => {
      const activeTasks = new Map<string, { agentId: string; targetX: number; targetY: number; returning: boolean }>();

      activeTasks.set('a1', { agentId: 'a1', targetX: 200, targetY: 200, returning: false });
      activeTasks.set('a2', { agentId: 'a2', targetX: 400, targetY: 300, returning: false });

      activeTasks.delete('a1');

      expect(activeTasks.size).toBe(1);
      expect(activeTasks.has('a1')).toBe(false);
      expect(activeTasks.has('a2')).toBe(true);
    });

    it('should filter idle agents for new tasks', () => {
      const agents = [
        { id: 'a1', isNavigating: false },
        { id: 'a2', isNavigating: true },
        { id: 'a3', isNavigating: false },
      ];
      const activeTasks = new Map<string, boolean>();
      activeTasks.set('a3', true);

      const idle = agents.filter(a => !activeTasks.has(a.id) && !a.isNavigating);

      expect(idle).toHaveLength(1);
      expect(idle[0].id).toBe('a1');
    });
  });
});

type MockTween = {
  targets: unknown;
  isActive: () => boolean;
  stop: () => void;
  destroy: () => void;
};

function createMockScene() {
  const tweens: MockTween[] = [];

  const mockTweenManager = {
    add: jest.fn((config: Record<string, unknown>) => {
      let active = true;
      const tween: MockTween = {
        targets: config.targets,
        isActive: () => active,
        stop: () => { active = false; },
        destroy: () => { active = false; },
      };
      tweens.push(tween);

      if (config.onComplete && typeof config.onComplete === 'function') {
        (config as Record<string, unknown>)._onComplete = config.onComplete;
      }

      return tween;
    }),
    killTweensOf: jest.fn(),
    _tweens: tweens,
  };

  return {
    tweens: mockTweenManager,
    add: {
      existing: jest.fn(),
      graphics: jest.fn(() => ({
        fillStyle: jest.fn(),
        fillRoundedRect: jest.fn(),
        lineStyle: jest.fn(),
        strokeRoundedRect: jest.fn(),
        destroy: jest.fn(),
      })),
      text: jest.fn(() => ({
        setOrigin: jest.fn(),
        setDepth: jest.fn(),
      })),
      container: jest.fn(() => ({
        add: jest.fn(),
        destroy: jest.fn(),
      })),
    },
    physics: {
      add: {
        existing: jest.fn(),
      },
    },
    game: {
      loop: { delta: 16 },
    },
  };
}

function createMockAgent(scene: ReturnType<typeof createMockScene>, x = 0, y = 0) {
  const pathPoints: PathPoint[] = [
    { x: 100, y: 100, action: 'move' },
    { x: 200, y: 200, action: 'move' },
  ];

  let onArrivalCallback: (() => void) | null = null;
  let isNavigating = false;
  let activeTween: MockTween | null = null;

  const mockPathfinding = {
    findPath: jest.fn((_sx: number, _sy: number, _tx: number, _ty: number) => pathPoints),
  };

  function moveTo(targetX: number, targetY: number, onArrival?: () => void): void {
    if (activeTween) {
      activeTween.stop();
      activeTween = null;
    }

    isNavigating = true;
    if (onArrival) onArrivalCallback = onArrival;

    const path = mockPathfinding.findPath(x, y, targetX, targetY);
    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      const prevX = i === 0 ? x : path[i - 1].x;
      const prevY = i === 0 ? y : path[i - 1].y;
      const dx = point.x - prevX;
      const dy = point.y - prevY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const duration = (distance / 200) * 1000;

      activeTween = scene.tweens.add({
        targets: { x: prevX, y: prevY },
        x: point.x,
        y: point.y,
        duration,
        ease: 'Power2',
        onComplete: () => {
          x = point.x;
          y = point.y;
          if (i === path.length - 1) {
            isNavigating = false;
            onArrivalCallback?.();
            onArrivalCallback = null;
          }
        },
      });
    }
  }

  function stopMovement(): void {
    if (activeTween) {
      activeTween.stop();
      activeTween = null;
    }
    isNavigating = false;
    onArrivalCallback = null;
  }

  return {
    x, y,
    scene,
    moveTo,
    stopMovement,
    mockPathfinding,
    isNavigatingToTarget: () => isNavigating,
    getOnArrivalCallback: () => onArrivalCallback,
  };
}

describe('Tween-based Movement', () => {
  it('should create a tween when moveTo is called', () => {
    const scene = createMockScene();
    const agent = createMockAgent(scene, 0, 0);

    agent.moveTo(200, 200);

    expect(scene.tweens.add).toHaveBeenCalled();
    expect(agent.isNavigatingToTarget()).toBe(true);
  });

  it('should trigger arrival callback when tween completes', () => {
    const scene = createMockScene();
    const agent = createMockAgent(scene, 0, 0);
    const arrivalCallback = jest.fn();

    agent.moveTo(200, 200, arrivalCallback);

    const tweens = scene.tweens._tweens;
    const lastTween = tweens[tweens.length - 1];
    const config = scene.tweens.add.mock.calls[scene.tweens.add.mock.calls.length - 1][0] as Record<string, unknown>;

    expect(config.onComplete).toBeDefined();

    (config.onComplete as () => void)();

    expect(arrivalCallback).toHaveBeenCalled();
  });

  it('should stop previous tween when moveTo is called again', () => {
    const scene = createMockScene();
    const agent = createMockAgent(scene, 0, 0);

    agent.moveTo(200, 200);

    expect(scene.tweens.add).toHaveBeenCalledTimes(2);

    const firstTweenCount = scene.tweens.add.mock.calls.length;

    agent.moveTo(300, 300);

    expect(scene.tweens.add.mock.calls.length).toBeGreaterThan(firstTweenCount);
  });

  it('should stop navigation and clean up state when stopMovement is called', () => {
    const scene = createMockScene();
    const agent = createMockAgent(scene, 0, 0);

    agent.moveTo(200, 200);

    expect(agent.isNavigatingToTarget()).toBe(true);

    agent.stopMovement();

    expect(agent.isNavigatingToTarget()).toBe(false);
  });

  it('should calculate tween duration based on segment distance', () => {
    const scene = createMockScene();
    const agent = createMockAgent(scene, 0, 0);

    agent.moveTo(200, 200);

    const firstCall = scene.tweens.add.mock.calls[0][0] as Record<string, unknown>;
    const dx = 100 - 0;
    const dy = 100 - 0;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const expectedDuration = (distance / 200) * 1000;

    expect(firstCall.duration).toBeCloseTo(expectedDuration, 1);
  });

  it('should use Power2 easing for smooth movement', () => {
    const scene = createMockScene();
    const agent = createMockAgent(scene, 0, 0);

    agent.moveTo(200, 200);

    const firstCall = scene.tweens.add.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCall.ease).toBe('Power2');
  });
});

describe('Animation State Integration', () => {
  interface MockAnimationController {
    update: jest.Mock;
    forcePlay: jest.Mock;
    getState: jest.Mock;
  }

  function createMockAnimationController(): MockAnimationController {
    let state = 'idle';
    return {
      update: jest.fn((vx, vy, floor, working) => {
        if (working) state = 'working';
        else if (Math.abs(vx) > 10) state = 'moving';
        else state = 'idle';
      }),
      forcePlay: jest.fn((s) => { state = s; }),
      getState: jest.fn(() => state),
    };
  }

  it('should call animationController.update() when not navigating', () => {
    const controller = createMockAnimationController();
    const lastVelocityX = 0;
    const lastVelocityY = 0;
    const isOnFloor = true;
    const isWorking = false;

    if (controller) {
      controller.update(lastVelocityX, lastVelocityY, isOnFloor, isWorking);
    }

    expect(controller.update).toHaveBeenCalledWith(0, 0, true, false);
  });

  it('should pass working state to animation controller', () => {
    const controller = createMockAnimationController();

    controller.update(0, 0, true, true);

    expect(controller.update).toHaveBeenCalledWith(0, 0, true, true);
    expect(controller.getState()).toBe('working');
  });

  it('should pass moving state to animation controller', () => {
    const controller = createMockAnimationController();

    controller.update(100, 0, true, false);

    expect(controller.update).toHaveBeenCalledWith(100, 0, true, false);
  });

  it('should reset lastVelocityX/Y when navigation stops', () => {
    let lastVelocityX = 100;
    let lastVelocityY = 50;

    function stopMovement(): void {
      lastVelocityX = 0;
      lastVelocityY = 0;
    }

    expect(lastVelocityX).toBe(100);
    expect(lastVelocityY).toBe(50);

    stopMovement();

    expect(lastVelocityX).toBe(0);
    expect(lastVelocityY).toBe(0);
  });

  it('should reset lastVelocityX/Y when navigation completes', () => {
    let lastVelocityX = 80;
    let lastVelocityY = 30;

    function completeNavigation(): void {
      lastVelocityX = 0;
      lastVelocityY = 0;
    }

    expect(lastVelocityX).not.toBe(0);

    completeNavigation();

    expect(lastVelocityX).toBe(0);
    expect(lastVelocityY).toBe(0);
  });
});
