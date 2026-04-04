import { TaskVisualizer } from '../TaskVisualizer';
import { TaskManager } from '../../systems/TaskManager';
import { EventBus } from '../../systems/EventBus';
import { Task, TaskStatus } from '../../types/Task';

jest.mock('phaser', () => {
  const createMockGraphics = () => ({
    clear: jest.fn(),
    fillStyle: jest.fn(),
    fillRect: jest.fn(),
    fillRoundedRect: jest.fn(),
    lineStyle: jest.fn(),
    strokeRoundedRect: jest.fn(),
    setPosition: jest.fn(),
    setDepth: jest.fn(),
    setAlpha: jest.fn(),
    destroy: jest.fn(),
    alpha: 0,
  });

  const createMockText = () => ({
    setText: jest.fn(),
    setOrigin: jest.fn(),
    width: 80,
    height: 16,
    setPosition: jest.fn(),
    destroy: jest.fn(),
    setInteractive: jest.fn(),
    on: jest.fn(),
  });

  const createMockContainer = () => {
    const c = {
      x: 0,
      y: 0,
      setDepth: jest.fn(),
      setAlpha: jest.fn(),
      add: jest.fn(),
      destroy: jest.fn(),
      setPosition: jest.fn((x: number, y: number) => {
        c.x = x;
        c.y = y;
      }),
      setScale: jest.fn(),
      getBounds: jest.fn().mockReturnValue({ contains: () => false }),
    };
    return c;
  };

  const mockTimerEvent = {
    remove: jest.fn(),
  };

  const mockScene = {
    add: {
      container: jest.fn(() => createMockContainer()),
      graphics: jest.fn(() => createMockGraphics()),
      text: jest.fn(() => createMockText()),
    },
    time: {
      delayedCall: jest.fn().mockReturnValue(mockTimerEvent),
    },
    tweens: {
      add: jest.fn((config: any) => {
        if (config.onComplete) config.onComplete();
      }),
    },
    input: {
      on: jest.fn(),
      off: jest.fn(),
    },
  };

  return {
    default: {
      GameObjects: {
        Container: jest.fn(),
        Graphics: jest.fn(),
        Text: jest.fn(),
      },
    },
    __mocks: { mockScene, mockTimerEvent },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('TaskVisualizer', () => {
  let visualizer: TaskVisualizer;
  let taskManager: TaskManager;
  let eventBus: EventBus;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = new EventBus();
    taskManager = new TaskManager(eventBus);
    visualizer = new TaskVisualizer(mockScene as any, taskManager);
  });

  afterEach(() => {
    visualizer.destroy();
  });

  describe('showTask', () => {
    it('should create a task bubble for the agent', () => {
      const task = createTestTask({ agentId: 'alice', status: 'working' });
      visualizer.showTask('alice', task);

      expect(visualizer.getTaskBubble('alice')).toBeDefined();
      expect(visualizer.getProgressBar('alice')).toBeDefined();
    });

    it('should reuse existing bubble when showing new task for same agent', () => {
      const task1 = createTestTask({ agentId: 'alice', description: 'Task 1' });
      const task2 = createTestTask({ agentId: 'alice', description: 'Task 2' });

      visualizer.showTask('alice', task1);
      const bubble1 = visualizer.getTaskBubble('alice');

      visualizer.showTask('alice', task2);
      const bubble2 = visualizer.getTaskBubble('alice');

      expect(bubble1).toBe(bubble2);
    });
  });

  describe('hideTask', () => {
    it('should remove task bubble after delay', () => {
      const task = createTestTask({ agentId: 'alice' });
      visualizer.showTask('alice', task);

      visualizer.hideTask('alice');

      expect(mockScene.time.delayedCall).toHaveBeenCalled();
    });
  });

  describe('updateAgentPosition', () => {
    it('should store agent position', () => {
      visualizer.updateAgentPosition('alice', 100, 200);
      visualizer.updateAgentPosition('alice', 150, 250);

      const bubble = visualizer.getTaskBubble('alice');
      expect(bubble).toBeUndefined();
    });
  });

  describe('updateProgress', () => {
    it('should update progress bar when it exists', () => {
      const task = createTestTask({ agentId: 'alice', progress: 0 });
      visualizer.showTask('alice', task);

      const bar = visualizer.getProgressBar('alice');
      expect(bar).toBeDefined();

      visualizer.updateProgress('alice', 75);
      bar!.update();
      expect(bar!.getProgress()).toBeGreaterThan(0);
    });

    it('should handle missing progress bar gracefully', () => {
      expect(() => visualizer.updateProgress('unknown', 50)).not.toThrow();
    });
  });

  describe('update', () => {
    it('should create bubbles for active tasks', () => {
      const task = createTestTask({ agentId: 'alice', status: 'working' });
      taskManager.assignTask('alice', task);
      visualizer.updateAgentPosition('alice', 100, 200);

      visualizer.update();

      expect(visualizer.getTaskBubble('alice')).toBeDefined();
    });

    it('should handle no active tasks', () => {
      expect(() => visualizer.update()).not.toThrow();
    });

    it('should clean up bubbles for completed agents', () => {
      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);
      visualizer.updateAgentPosition('alice', 100, 200);
      visualizer.update();

      const bubble = visualizer.getTaskBubble('alice');
      expect(bubble).toBeDefined();

      const isActiveSpy = jest.spyOn(bubble!, 'isActive').mockReturnValue(true);

      taskManager.completeTask('alice', 'success');
      visualizer.update();

      expect(mockScene.time.delayedCall).toHaveBeenCalled();
      isActiveSpy.mockRestore();
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      const task = createTestTask({ agentId: 'alice' });
      visualizer.showTask('alice', task);

      visualizer.destroy();

      expect(visualizer.getTaskBubble('alice')).toBeUndefined();
      expect(visualizer.getProgressBar('alice')).toBeUndefined();
    });

    it('should handle destroy when empty', () => {
      expect(() => visualizer.destroy()).not.toThrow();
    });
  });

  describe('Phase 2: multi-agent rendering', () => {
    it('should create bubbles for 4 agents simultaneously', () => {
      const agents = ['alice', 'bob', 'charlie', 'diana'];
      agents.forEach(agent => {
        const task = createTestTask({ agentId: agent, status: 'working' });
        taskManager.assignTask(agent, task);
        visualizer.updateAgentPosition(agent, agents.indexOf(agent) * 100, 200);
      });

      visualizer.update();

      agents.forEach(agent => {
        expect(visualizer.getTaskBubble(agent)).toBeDefined();
        expect(visualizer.getProgressBar(agent)).toBeDefined();
      });
    });

    it('should position bubbles at different locations based on agent positions', () => {
      const positions = [
        { agent: 'alice', x: 100, y: 100 },
        { agent: 'bob', x: 300, y: 100 },
        { agent: 'charlie', x: 500, y: 100 },
        { agent: 'diana', x: 700, y: 100 },
      ];

      positions.forEach(({ agent, x, y }) => {
        const task = createTestTask({ agentId: agent, status: 'working' });
        taskManager.assignTask(agent, task);
        visualizer.updateAgentPosition(agent, x, y);
      });

      visualizer.update();

      const bubblePositions = positions.map(({ agent }) =>
        visualizer.getTaskBubble(agent)!.getPosition()
      );

      const xCoords = bubblePositions.map(p => p.x);
      const uniqueX = new Set(xCoords);
      expect(uniqueX.size).toBe(4);
    });

    it('should update bubble positions when agents move', () => {
      const task = createTestTask({ agentId: 'alice', status: 'working' });
      taskManager.assignTask('alice', task);
      visualizer.updateAgentPosition('alice', 100, 200);
      visualizer.update();

      const pos1 = visualizer.getTaskBubble('alice')!.getPosition();
      expect(pos1.x).toBe(100);

      visualizer.updateAgentPosition('alice', 250, 300);
      visualizer.update();

      const pos2 = visualizer.getTaskBubble('alice')!.getPosition();
      expect(pos2.x).toBe(250);
    });

    it('should schedule hide for completed agents while others remain', () => {
      ['alice', 'bob', 'charlie', 'diana'].forEach(agent => {
        const task = createTestTask({ agentId: agent, status: 'working' });
        taskManager.assignTask(agent, task);
        visualizer.updateAgentPosition(agent, 100, 200);
      });
      visualizer.update();

      const aliceBubble = visualizer.getTaskBubble('alice');
      const isActiveSpy = jest.spyOn(aliceBubble!, 'isActive').mockReturnValue(true);

      taskManager.completeTask('alice', 'success');
      visualizer.update();

      expect(visualizer.getTaskBubble('bob')).toBeDefined();
      expect(visualizer.getTaskBubble('charlie')).toBeDefined();
      expect(visualizer.getTaskBubble('diana')).toBeDefined();
      expect(mockScene.time.delayedCall).toHaveBeenCalled();

      isActiveSpy.mockRestore();
    });

    it('should recreate bubble when agent gets new task after completion', () => {
      const task1 = createTestTask({ agentId: 'alice', id: 't1' });
      taskManager.assignTask('alice', task1);
      visualizer.updateAgentPosition('alice', 100, 200);
      visualizer.update();

      taskManager.completeTask('alice', 'success');

      const task2 = createTestTask({ agentId: 'alice', id: 't2' });
      taskManager.assignTask('alice', task2);
      visualizer.update();

      expect(visualizer.getTaskBubble('alice')).toBeDefined();
    });
  });

  describe('Phase 2: performance stress test', () => {
    it('should handle rapid update cycles with 4 agents', () => {
      const agents = ['alice', 'bob', 'charlie', 'diana'];
      agents.forEach(agent => {
        const task = createTestTask({ agentId: agent, status: 'working' });
        taskManager.assignTask(agent, task);
        visualizer.updateAgentPosition(agent, 100, 200);
      });

      for (let i = 0; i < 100; i++) {
        agents.forEach(agent => {
          taskManager.updateProgress(agent, i + 1, `Processing ${i + 1}%`);
        });
        visualizer.update();
      }

      agents.forEach(agent => {
        expect(visualizer.getTaskBubble(agent)).toBeDefined();
        expect(visualizer.getProgressBar(agent)).toBeDefined();
      });
    });

    it('should destroy all 4 agents resources cleanly', () => {
      ['alice', 'bob', 'charlie', 'diana'].forEach(agent => {
        const task = createTestTask({ agentId: agent });
        visualizer.showTask(agent, task);
      });

      visualizer.destroy();

      ['alice', 'bob', 'charlie', 'diana'].forEach(agent => {
        expect(visualizer.getTaskBubble(agent)).toBeUndefined();
        expect(visualizer.getProgressBar(agent)).toBeUndefined();
      });
    });
  });

  describe('Phase 4.1: TaskDetailPanel integration', () => {
    it('should show detail panel for an agent', () => {
      const task = createTestTask({ agentId: 'alice', status: 'working' });
      visualizer.showTaskDetailPanel('alice', task);

      expect(visualizer.getDetailPanel()).toBeDefined();
      expect(visualizer.getDetailPanel()).not.toBeNull();
    });

    it('should hide detail panel when hideTaskDetailPanel is called', () => {
      const task = createTestTask({ agentId: 'alice' });
      visualizer.showTaskDetailPanel('alice', task);
      expect(visualizer.getDetailPanel()).not.toBeNull();

      visualizer.hideTaskDetailPanel();
      expect(visualizer.getDetailPanel()).toBeNull();
    });

    it('should replace existing detail panel when showing another', () => {
      const task1 = createTestTask({ agentId: 'alice' });
      const task2 = createTestTask({ agentId: 'bob' });
      visualizer.showTaskDetailPanel('alice', task1);
      const panel1 = visualizer.getDetailPanel();

      visualizer.showTaskDetailPanel('bob', task2);
      const panel2 = visualizer.getDetailPanel();

      expect(panel2).not.toBe(panel1);
    });

    it('should update detail panel when task changes', () => {
      const task = createTestTask({ agentId: 'alice', status: 'working', progress: 30 });
      taskManager.assignTask('alice', task);
      visualizer.updateAgentPosition('alice', 100, 200);
      visualizer.showTaskDetailPanel('alice', task);

      taskManager.updateProgress('alice', 75, 'Almost done');
      visualizer.update();

      const panel = visualizer.getDetailPanel();
      expect(panel!.getProgress()).toBe(75);
    });

    it('should clean up detail panel on destroy', () => {
      const task = createTestTask({ agentId: 'alice' });
      visualizer.showTaskDetailPanel('alice', task);

      visualizer.destroy();

      expect(visualizer.getDetailPanel()).toBeNull();
    });
  });
});

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-' + Math.random().toString(36).slice(2, 8),
    agentId: 'alice',
    description: 'Test task',
    status: 'pending' as TaskStatus,
    progress: 0,
    currentAction: 'Idle',
    taskType: 'coding',
    assignedAt: Date.now(),
    completedAt: null,
    parentTaskId: null,
    ...overrides,
  };
}
