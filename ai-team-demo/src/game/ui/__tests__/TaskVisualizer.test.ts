import { TaskVisualizer } from '../TaskVisualizer';
import { TaskManager } from '../../systems/TaskManager';
import { EventBus } from '../../systems/EventBus';
import { Task, TaskStatus } from '../../types/Task';

jest.mock('phaser', () => {
  const mockGraphics = {
    clear: jest.fn(),
    fillStyle: jest.fn(),
    fillRect: jest.fn(),
    fillRoundedRect: jest.fn(),
    setPosition: jest.fn(),
    setDepth: jest.fn(),
    setAlpha: jest.fn(),
    destroy: jest.fn(),
    alpha: 0,
  };

  const mockText = {
    setText: jest.fn(),
    setOrigin: jest.fn(),
    width: 80,
    height: 16,
    setPosition: jest.fn(),
    destroy: jest.fn(),
  };

  const mockContainer = {
    setPosition: jest.fn(),
    setDepth: jest.fn(),
    setAlpha: jest.fn(),
    add: jest.fn(),
    destroy: jest.fn(),
    x: 0,
    y: 0,
  };

  const mockTimerEvent = {
    remove: jest.fn(),
  };

  const mockScene = {
    add: {
      container: jest.fn().mockReturnValue(mockContainer),
      graphics: jest.fn().mockReturnValue(mockGraphics),
      text: jest.fn().mockReturnValue(mockText),
    },
    time: {
      delayedCall: jest.fn().mockReturnValue(mockTimerEvent),
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
    __mocks: { mockScene, mockGraphics, mockText, mockContainer, mockTimerEvent },
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
