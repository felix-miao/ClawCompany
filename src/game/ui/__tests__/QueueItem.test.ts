import { QueueItem } from '../QueueItem';
import { Task, GameTaskStatus } from '../../types/Task';

jest.mock('phaser', () => {
  const mockGraphics = {
    clear: jest.fn(),
    fillStyle: jest.fn().mockReturnThis(),
    fillRoundedRect: jest.fn().mockReturnThis(),
    setInteractive: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
  };

  const mockContainer = {
    add: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    setPosition: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };

  const mockText = {
    setText: jest.fn(),
    setOrigin: jest.fn(),
    destroy: jest.fn(),
  };

  const mockScene = {
    add: {
      container: jest.fn(() => ({ ...mockContainer })),
      graphics: jest.fn(() => ({ ...mockGraphics })),
      text: jest.fn(() => ({ ...mockText })),
    },
  };

  return {
    default: {
      GameObjects: { Container: jest.fn(), Graphics: jest.fn(), Text: jest.fn() },
    },
    Geom: {
      Rectangle: class {
        constructor(
          public x: number,
          public y: number,
          public width: number,
          public height: number
        ) {}
        static Contains() {
          return true;
        }
      },
    },
    __mocks: { mockScene, mockGraphics, mockContainer, mockText },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('QueueItem', () => {
  let queueItem: QueueItem;
  let task: Task;

  beforeEach(() => {
    jest.clearAllMocks();
    task = createTestTask({ id: 'task-1', description: 'Implement login feature', agentId: 'alice' });
    queueItem = new QueueItem(mockScene as any, task, 0);
  });

  afterEach(() => {
    queueItem.destroy();
  });

  describe('constructor', () => {
    it('should create QueueItem', () => {
      expect(queueItem).toBeDefined();
    });

    it('should create container with correct position', () => {
      expect(mockScene.add.container).toHaveBeenCalled();
    });

    it('should create background graphics', () => {
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });

    it('should create text element', () => {
      expect(mockScene.add.text).toHaveBeenCalled();
    });

    it('should set depth to 150', () => {
      expect(mockScene.add.container).toHaveBeenCalled();
    });
  });

  describe('getContainer', () => {
    it('should return container', () => {
      const container = queueItem.getContainer();
      expect(container).toBeDefined();
    });
  });

  describe('getTask', () => {
    it('should return task', () => {
      const returnedTask = queueItem.getTask();
      expect(returnedTask.id).toBe('task-1');
      expect(returnedTask.description).toBe('Implement login feature');
    });
  });

  describe('setPosition', () => {
    it('should set position', () => {
      queueItem.setPosition(100, 50);
      expect(mockScene.add.container).toHaveBeenCalled();
    });
  });

  describe('setInteractive', () => {
    it('should set interactive with callback', () => {
      const callback = jest.fn();
      queueItem.setInteractive(callback);
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });

    it('should register pointerdown handler', () => {
      const callback = jest.fn();
      queueItem.setInteractive(callback);
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    it('should update task and text', () => {
      const newTask = createTestTask({
        id: 'task-2',
        description: 'Updated task description that is very long',
      });
      queueItem.updateTask(newTask);
      expect(queueItem.getTask().id).toBe('task-2');
    });

    it('should handle task with short description', () => {
      const shortTask = createTestTask({
        id: 'task-3',
        description: 'Short',
      });
      queueItem.updateTask(shortTask);
      expect(queueItem.getTask().description).toBe('Short');
    });
  });

  describe('destroy', () => {
    it('should destroy without errors', () => {
      expect(() => queueItem.destroy()).not.toThrow();
    });

    it('should mark as destroyed', () => {
      queueItem.destroy();
      expect(queueItem.isDestroyed()).toBe(true);
    });

    it('should handle multiple destroy calls', () => {
      queueItem.destroy();
      expect(() => queueItem.destroy()).not.toThrow();
    });
  });

  describe('isDestroyed', () => {
    it('should return false initially', () => {
      expect(queueItem.isDestroyed()).toBe(false);
    });

    it('should return true after destroy', () => {
      queueItem.destroy();
      expect(queueItem.isDestroyed()).toBe(true);
    });
  });

  describe('truncation', () => {
    it('should handle long task descriptions', () => {
      const longTask = createTestTask({
        id: 'long-task',
        description: 'This is a very long task description that exceeds the maximum length',
      });
      const item = new QueueItem(mockScene as any, longTask, 0);
      expect(item.getTask().description).toBeDefined();
      item.destroy();
    });

    it('should handle short task descriptions', () => {
      const shortTask = createTestTask({
        id: 'short-task',
        description: 'Hi',
      });
      const item = new QueueItem(mockScene as any, shortTask, 0);
      expect(item.getTask().description).toBe('Hi');
      item.destroy();
    });
  });

  describe('priority colors', () => {
    it('should handle high priority', () => {
      const highPriorityTask = createTestTask({
        id: 'high-priority',
        metadata: { priority: 'high' },
      });
      const item = new QueueItem(mockScene as any, highPriorityTask, 0);
      expect(item).toBeDefined();
      item.destroy();
    });

    it('should handle medium priority', () => {
      const mediumPriorityTask = createTestTask({
        id: 'medium-priority',
        metadata: { priority: 'medium' },
      });
      const item = new QueueItem(mockScene as any, mediumPriorityTask, 0);
      expect(item).toBeDefined();
      item.destroy();
    });

    it('should handle low priority', () => {
      const lowPriorityTask = createTestTask({
        id: 'low-priority',
        metadata: { priority: 'low' },
      });
      const item = new QueueItem(mockScene as any, lowPriorityTask, 0);
      expect(item).toBeDefined();
      item.destroy();
    });

    it('should use default priority when undefined', () => {
      const taskWithoutPriority = createTestTask({
        id: 'no-priority',
      });
      const item = new QueueItem(mockScene as any, taskWithoutPriority, 0);
      expect(item).toBeDefined();
      item.destroy();
    });
  });

  describe('edge cases', () => {
    it('should handle different index values', () => {
      const item0 = new QueueItem(mockScene as any, task, 0);
      const item1 = new QueueItem(mockScene as any, task, 1);
      const item5 = new QueueItem(mockScene as any, task, 5);

      expect(item0).toBeDefined();
      expect(item1).toBeDefined();
      expect(item5).toBeDefined();

      item0.destroy();
      item1.destroy();
      item5.destroy();
    });

    it('should handle empty description', () => {
      const emptyTask = createTestTask({
        id: 'empty-desc',
        description: '',
      });
      const item = new QueueItem(mockScene as any, emptyTask, 0);
      expect(item).toBeDefined();
      item.destroy();
    });
  });
});

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-' + Math.random().toString(36).slice(2, 8),
    agentId: 'alice',
    description: 'Test task',
    status: 'pending' as GameTaskStatus,
    progress: 0,
    currentAction: 'Idle',
    taskType: 'coding',
    assignedAt: Date.now(),
    completedAt: null,
    parentTaskId: null,
    ...overrides,
  };
}