import { TaskDetailPanel } from '../TaskDetailPanel';
import { Task, TaskStatus } from '../../types/Task';

interface MockGraphics {
  clear: jest.Mock;
  fillStyle: jest.Mock;
  fillRect: jest.Mock;
  fillRoundedRect: jest.Mock;
  setPosition: jest.Mock;
  setDepth: jest.Mock;
  setAlpha: jest.Mock;
  destroy: jest.Mock;
  lineStyle: jest.Mock;
  strokeRoundedRect: jest.Mock;
  alpha: number;
}

interface MockText {
  setText: jest.Mock;
  setOrigin: jest.Mock;
  width: number;
  height: number;
  setPosition: jest.Mock;
  destroy: jest.Mock;
  setDepth: jest.Mock;
  setFontSize: jest.Mock;
  setColor: jest.Mock;
  setInteractive: jest.Mock;
  on: jest.Mock;
}

interface MockContainer {
  x: number;
  y: number;
  setDepth: jest.Mock;
  setAlpha: jest.Mock;
  add: jest.Mock;
  destroy: jest.Mock;
  setPosition: jest.Mock<(x: number, y: number) => void>;
  setScrollFactor: jest.Mock;
  setInteractive: jest.Mock;
  on: jest.Mock;
  getBounds: jest.Mock<() => { contains: (x: number, y: number) => boolean }>;
}

interface MockTweens {
  add: jest.Mock<(config: { onComplete?: () => void }) => void>;
}

interface MockScene {
  add: {
    container: jest.Mock<() => MockContainer>;
    graphics: jest.Mock<() => MockGraphics>;
    text: jest.Mock<() => MockText>;
  };
  time: {
    delayedCall: jest.Mock;
  };
  tweens: MockTweens;
  input: {
    on: jest.Mock;
    off: jest.Mock;
  };
}

interface MockTweenConfig {
  onComplete?: () => void;
}

jest.mock('phaser', () => {
  const createMockGraphics = (): MockGraphics => ({
    clear: jest.fn(),
    fillStyle: jest.fn(),
    fillRect: jest.fn(),
    fillRoundedRect: jest.fn(),
    setPosition: jest.fn(),
    setDepth: jest.fn(),
    setAlpha: jest.fn(),
    destroy: jest.fn(),
    lineStyle: jest.fn(),
    strokeRoundedRect: jest.fn(),
    alpha: 0,
  });

  const createMockText = (): MockText => ({
    setText: jest.fn(),
    setOrigin: jest.fn(),
    width: 80,
    height: 16,
    setPosition: jest.fn(),
    destroy: jest.fn(),
    setDepth: jest.fn(),
    setFontSize: jest.fn(),
    setColor: jest.fn(),
    setInteractive: jest.fn(),
    on: jest.fn(),
  });

  const createMockContainer = (): MockContainer => ({
    x: 0,
    y: 0,
    setDepth: jest.fn(),
    setAlpha: jest.fn(),
    add: jest.fn(),
    destroy: jest.fn(),
    setPosition: jest.fn((x: number, y: number) => {
      (this as MockContainer).x = x;
      (this as MockContainer).y = y;
    }),
    setScrollFactor: jest.fn(),
    setInteractive: jest.fn(),
    on: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ contains: () => false }),
  });

  const mockScene: MockScene = {
    add: {
      container: jest.fn(() => createMockContainer()),
      graphics: jest.fn(() => createMockGraphics()),
      text: jest.fn(() => createMockText()),
    },
    time: {
      delayedCall: jest.fn(),
    },
    tweens: {
      add: jest.fn((config: MockTweenConfig) => {
        if (config.onComplete) {
          config.onComplete();
        }
        return { stop: jest.fn() };
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
    __mocks: { mockScene },
  };
});

interface PhaserMock {
  default: {
    GameObjects: {
      Container: jest.Mock;
      Graphics: jest.Mock;
      Text: jest.Mock;
    };
  };
  __mocks: {
    mockScene: MockScene;
  };
}

const Phaser = require('phaser') as PhaserMock;
const { mockScene } = Phaser.__mocks;

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-' + Math.random().toString(36).slice(2, 8),
    agentId: 'alice',
    description: 'Implement user authentication',
    status: 'working' as TaskStatus,
    progress: 45,
    currentAction: 'Writing login component',
    taskType: 'coding',
    assignedAt: Date.now() - 60000,
    completedAt: null,
    parentTaskId: null,
    metadata: {
      priority: 'high' as const,
      files: ['src/auth/login.ts'],
      estimatedDuration: 120,
    },
    ...overrides,
  };
}

describe('TaskDetailPanel', () => {
  let panel: TaskDetailPanel;
  let onClose: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onClose = jest.fn();
  });

  afterEach(() => {
    if (panel) {
      panel.destroy();
    }
  });

  describe('display', () => {
    it('should display task description', () => {
      const task = createTestTask({ description: 'Fix login bug' });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      const description = panel.getDescriptionText();
      expect(description).toBe('Fix login bug');
    });

    it('should show progress bar with correct progress', () => {
      const task = createTestTask({ progress: 65 });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getProgress()).toBe(65);
    });

    it('should display task status', () => {
      const task = createTestTask({ status: 'working' });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getStatus()).toBe('working');
    });

    it('should display task type and current action', () => {
      const task = createTestTask({ taskType: 'coding', currentAction: 'Refactoring module' });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getTaskType()).toBe('coding');
      expect(panel.getCurrentAction()).toBe('Refactoring module');
    });

    it('should display priority level', () => {
      const task = createTestTask({ metadata: { priority: 'high' } });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getPriority()).toBe('high');
    });
  });

  describe('update', () => {
    it('should update when task changes', () => {
      const task = createTestTask({ progress: 30, status: 'working' });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getProgress()).toBe(30);
      expect(panel.getStatus()).toBe('working');

      const updatedTask = { ...task, progress: 80, status: 'reviewing' as TaskStatus, currentAction: 'Code review' };
      panel.update(updatedTask);

      expect(panel.getProgress()).toBe(80);
      expect(panel.getStatus()).toBe('reviewing');
      expect(panel.getCurrentAction()).toBe('Code review');
    });

    it('should recalculate elapsed time on update', () => {
      const task = createTestTask({ assignedAt: Date.now() - 120000 });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      const elapsed1 = panel.getElapsedTime();
      panel.update({ ...task, assignedAt: task.assignedAt - 60000 });
      const elapsed2 = panel.getElapsedTime();

      expect(elapsed2).toBeGreaterThan(elapsed1);
    });
  });

  describe('close', () => {
    it('should call onClose callback', () => {
      const task = createTestTask();
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      panel.close();

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should destroy cleanly', () => {
      const task = createTestTask();
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(() => panel.destroy()).not.toThrow();
    });
  });

  describe('priority-based styling', () => {
    it('should apply red border for high priority', () => {
      const task = createTestTask({ metadata: { priority: 'high' } });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getBorderColor()).toBe(TaskDetailPanel.PRIORITY_COLORS.high);
    });

    it('should apply yellow border for medium priority', () => {
      const task = createTestTask({ metadata: { priority: 'medium' } });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getBorderColor()).toBe(TaskDetailPanel.PRIORITY_COLORS.medium);
    });

    it('should apply green border for low priority', () => {
      const task = createTestTask({ metadata: { priority: 'low' } });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getBorderColor()).toBe(TaskDetailPanel.PRIORITY_COLORS.low);
    });

    it('should default to medium when no priority', () => {
      const task = createTestTask({ metadata: undefined });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getBorderColor()).toBe(TaskDetailPanel.PRIORITY_COLORS.medium);
    });
  });

  describe('animation', () => {
    it('should fade in on creation', () => {
      const task = createTestTask();
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should fade out on close', () => {
      const task = createTestTask();
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      mockScene.tweens.add.mockClear();
      panel.close();

      expect(mockScene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('multi-task', () => {
    it('should handle task without metadata gracefully', () => {
      const task = createTestTask({ metadata: undefined });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getPriority()).toBe('medium');
      expect(panel.getElapsedTime()).toBeGreaterThanOrEqual(0);
    });
  });
});
