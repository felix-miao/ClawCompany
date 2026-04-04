import { TaskQueueIndicator } from '../TaskQueueIndicator';
import { TaskManager } from '../../systems/TaskManager';
import { EventBus } from '../../systems/EventBus';
import { Task, TaskStatus } from '../../types/Task';

jest.mock('phaser', () => {
  const createMockGraphics = () => {
    const g: any = {
      clear: jest.fn(),
      fillStyle: jest.fn(),
      fillRect: jest.fn(),
      fillRoundedRect: jest.fn(),
      setPosition: jest.fn(),
      setDepth: jest.fn(),
      setAlpha: jest.fn(),
      destroy: jest.fn(),
      setInteractive: jest.fn().mockReturnThis(),
      on: jest.fn(),
      alpha: 0,
    };
    return g;
  };

  const createMockText = () => {
    const t: any = {
      text: '',
      setText: jest.fn((val: string) => {
        t.text = val;
      }),
      setOrigin: jest.fn(),
      width: 80,
      height: 16,
      setPosition: jest.fn(),
      destroy: jest.fn(),
      setDepth: jest.fn(),
      setInteractive: jest.fn(),
      on: jest.fn(),
    };
    return t;
  };

  const createMockContainer = () => {
    const children: any[] = [];
    const c: any = {
      x: 0,
      y: 0,
      setDepth: jest.fn(),
      setAlpha: jest.fn(),
      add: jest.fn((item: any) => children.push(item)),
      remove: jest.fn((item: any) => {
        const idx = children.indexOf(item);
        if (idx >= 0) children.splice(idx, 1);
      }),
      destroy: jest.fn(),
      setPosition: jest.fn((x: number, y: number) => {
        c.x = x;
        c.y = y;
      }),
      setScrollFactor: jest.fn(),
      setInteractive: jest.fn(),
      on: jest.fn(),
      getBounds: jest.fn().mockReturnValue({ contains: () => false }),
      getChildren: jest.fn(() => children),
    };
    return c;
  };

  const mockScene: any = {
    add: {
      container: jest.fn(() => createMockContainer()),
      graphics: jest.fn(() => createMockGraphics()),
      text: jest.fn(() => createMockText()),
    },
    time: {
      delayedCall: jest.fn(),
    },
    tweens: {
      add: jest.fn((config: any) => {
        if (config.onComplete) {
          config.onComplete();
        }
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
      Geom: {
        Rectangle: {
          Contains: jest.fn(),
        },
      },
    },
    __mocks: { mockScene },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-' + Math.random().toString(36).slice(2, 8),
    agentId: 'alice',
    description: 'Test task description',
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

describe('TaskQueueIndicator', () => {
  let indicator: TaskQueueIndicator;
  let taskManager: TaskManager;
  let eventBus: EventBus;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = new EventBus();
    taskManager = new TaskManager(eventBus);
    indicator = new TaskQueueIndicator(mockScene, taskManager);
  });

  afterEach(() => {
    indicator.destroy();
  });

  describe('display', () => {
    it('should display queue items', () => {
      const tasks = [
        createTestTask({ id: '1', description: 'Task 1' }),
        createTestTask({ id: '2', description: 'Task 2' }),
      ];
      tasks.forEach(t => taskManager.enqueueTask(t));

      indicator.update();

      expect(indicator.getQueueLength()).toBe(2);
      expect(indicator.getVisibleItemCount()).toBe(2);
    });

    it('should limit display to 5 items', () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTestTask({ id: String(i), description: `Task ${i}` })
      );
      tasks.forEach(t => taskManager.enqueueTask(t));

      indicator.update();

      expect(indicator.getQueueLength()).toBe(10);
      expect(indicator.getVisibleItemCount()).toBe(5);
    });

    it('should show empty queue with zero items', () => {
      indicator.update();

      expect(indicator.getQueueLength()).toBe(0);
      expect(indicator.getVisibleItemCount()).toBe(0);
    });

    it('should display correct queue length text', () => {
      const tasks = [createTestTask(), createTestTask(), createTestTask()];
      tasks.forEach(t => taskManager.enqueueTask(t));

      indicator.update();

      expect(indicator.getQueueLengthText()).toBe('队列: 3 个任务');
    });

    it('should display singular queue length text for 1 item', () => {
      taskManager.enqueueTask(createTestTask());

      indicator.update();

      expect(indicator.getQueueLengthText()).toBe('队列: 1 个任务');
    });
  });

  describe('updateQueue', () => {
    it('should clear previous items before rendering new ones', () => {
      const tasks1 = [createTestTask({ id: '1' }), createTestTask({ id: '2' })];
      tasks1.forEach(t => taskManager.enqueueTask(t));
      indicator.update();
      expect(indicator.getVisibleItemCount()).toBe(2);

      taskManager.dequeueNextTask('alice');
      indicator.update();
      expect(indicator.getVisibleItemCount()).toBe(1);
    });

    it('should handle empty queue after items removed', () => {
      taskManager.enqueueTask(createTestTask());
      indicator.update();
      expect(indicator.getVisibleItemCount()).toBe(1);

      taskManager.dequeueNextTask('alice');
      indicator.update();
      expect(indicator.getVisibleItemCount()).toBe(0);
      expect(indicator.getQueueLengthText()).toBe('队列: 0 个任务');
    });
  });

  describe('setOnTaskClick', () => {
    it('should register click callback', () => {
      const callback = jest.fn();
      indicator.setOnTaskClick(callback);

      expect(indicator).toBeDefined();
    });
  });

  describe('setPosition', () => {
    it('should update container position', () => {
      indicator.setPosition(50, 100);

      const container = indicator.getContainer();
      expect(container.x).toBe(50);
      expect(container.y).toBe(100);
    });
  });

  describe('destroy', () => {
    it('should destroy cleanly', () => {
      const tasks = [createTestTask(), createTestTask()];
      tasks.forEach(t => taskManager.enqueueTask(t));
      indicator.update();

      expect(() => indicator.destroy()).not.toThrow();
      expect(indicator.isDestroyed()).toBe(true);
    });

    it('should not update after destroy', () => {
      indicator.destroy();

      taskManager.enqueueTask(createTestTask());
      expect(() => indicator.update()).not.toThrow();
      expect(indicator.getVisibleItemCount()).toBe(0);
    });

    it('should handle double destroy gracefully', () => {
      indicator.destroy();
      expect(() => indicator.destroy()).not.toThrow();
      expect(indicator.isDestroyed()).toBe(true);
    });
  });

  describe('priority ordering', () => {
    it('should reflect priority-based ordering from TaskManager', () => {
      const lowTask = createTestTask({ id: 'low', description: 'Low task', metadata: { priority: 'low' } });
      const highTask = createTestTask({ id: 'high', description: 'High task', metadata: { priority: 'high' } });
      const mediumTask = createTestTask({ id: 'medium', description: 'Medium task', metadata: { priority: 'medium' } });

      taskManager.enqueueTask(lowTask);
      taskManager.enqueueTask(highTask);
      taskManager.enqueueTask(mediumTask);

      indicator.update();

      const queue = taskManager.getQueue();
      expect(queue[0].id).toBe('high');
      expect(queue[1].id).toBe('medium');
      expect(queue[2].id).toBe('low');
    });
  });

  describe('queue changes', () => {
    it('should reflect enqueue operations', () => {
      indicator.update();
      expect(indicator.getQueueLength()).toBe(0);

      taskManager.enqueueTask(createTestTask());
      indicator.update();
      expect(indicator.getQueueLength()).toBe(1);

      taskManager.enqueueTask(createTestTask());
      indicator.update();
      expect(indicator.getQueueLength()).toBe(2);
    });

    it('should reflect dequeue operations', () => {
      taskManager.enqueueTask(createTestTask({ id: 't1' }));
      taskManager.enqueueTask(createTestTask({ id: 't2' }));
      indicator.update();
      expect(indicator.getQueueLength()).toBe(2);

      taskManager.dequeueNextTask('alice');
      indicator.update();
      expect(indicator.getQueueLength()).toBe(1);
    });
  });
});
