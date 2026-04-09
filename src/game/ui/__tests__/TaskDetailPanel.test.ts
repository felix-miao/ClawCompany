import { TaskDetailPanel } from '../TaskDetailPanel';
import { Task, TaskStatus } from '../../types/Task';
import { TaskArtifact } from '../../../lib/core/types';

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
  remove: jest.Mock;
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
    remove: jest.fn(),
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

  describe('artifacts', () => {
    it('should return empty artifacts when no metadata', () => {
      const task = createTestTask({ metadata: undefined });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getArtifacts()).toEqual([]);
    });

    it('should return empty artifacts when metadata has no artifacts', () => {
      const task = createTestTask({ metadata: { priority: 'high' } });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getArtifacts()).toEqual([]);
    });

    it('should return artifacts from task metadata', () => {
      const artifacts: TaskArtifact[] = [
        { type: 'html', name: 'report.html', path: '/output/report.html' },
        { type: 'code', name: 'main.ts', path: '/src/main.ts' },
      ];
      const task = createTestTask({
        metadata: { priority: 'high', artifacts },
      });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getArtifacts()).toHaveLength(2);
      expect(panel.getArtifacts()[0].type).toBe('html');
      expect(panel.getArtifacts()[1].type).toBe('code');
    });

    it('should use base panel height when no artifacts', () => {
      const task = createTestTask({ metadata: { priority: 'high' } });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getPanelHeight()).toBe(200);
    });

    it('should increase panel height when artifacts present', () => {
      const artifacts: TaskArtifact[] = [
        { type: 'html', name: 'report.html', path: '/output/report.html' },
      ];
      const task = createTestTask({
        metadata: { priority: 'high', artifacts },
      });
      panel = new TaskDetailPanel(mockScene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(panel.getPanelHeight()).toBeGreaterThan(200);
    });

    it('should scale height with more artifacts', () => {
      const singleArtifacts: TaskArtifact[] = [
        { type: 'file', name: 'a.txt', path: '/a.txt' },
      ];
      const task1 = createTestTask({
        metadata: { priority: 'high', artifacts: singleArtifacts },
      });
      panel = new TaskDetailPanel(mockScene, {
        task: task1,
        position: { x: 200, y: 100 },
        onClose,
      });
      const height1 = panel.getPanelHeight();

      const multiArtifacts: TaskArtifact[] = [
        { type: 'file', name: 'a.txt', path: '/a.txt' },
        { type: 'file', name: 'b.txt', path: '/b.txt' },
        { type: 'file', name: 'c.txt', path: '/c.txt' },
      ];
      const task2 = createTestTask({
        metadata: { priority: 'high', artifacts: multiArtifacts },
      });
      panel.update(task2);
      const height3 = panel.getPanelHeight();

      expect(height3).toBeGreaterThan(height1);
    });

    it('should render correctly without artifacts', () => {
      const task = createTestTask({ metadata: undefined });
      expect(() => {
        panel = new TaskDetailPanel(mockScene, {
          task,
          position: { x: 200, y: 100 },
          onClose,
        });
      }).not.toThrow();
    });

    it('should render correctly with artifacts', () => {
      const artifacts: TaskArtifact[] = [
        { type: 'html', name: 'page.html', path: '/output/page.html', preview: '<html></html>' },
        { type: 'code', name: 'app.ts', path: '/src/app.ts' },
        { type: 'image', name: 'img.png', path: '/output/img.png' },
        { type: 'file', name: 'data.json', path: '/output/data.json' },
      ];
      const task = createTestTask({
        metadata: { priority: 'medium', artifacts },
      });
      expect(() => {
        panel = new TaskDetailPanel(mockScene, {
          task,
          position: { x: 200, y: 100 },
          onClose,
        });
      }).not.toThrow();
      expect(panel.getArtifacts()).toHaveLength(4);
    });

    it('should emit events via eventBus when configured', () => {
      const emitMock = jest.fn();
      const artifacts: TaskArtifact[] = [
        { type: 'html', name: 'page.html', path: '/output/page.html' },
      ];
      const task = createTestTask({
        metadata: { priority: 'high', artifacts },
      });
      panel = new TaskDetailPanel(mockScene as unknown as import('phaser').Scene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
        eventBus: { emit: emitMock },
      });

      panel['emitArtifactEvent']('artifact-preview', artifacts[0]);
      expect(emitMock).toHaveBeenCalledWith('artifact-preview', expect.objectContaining({
        type: 'artifact-preview',
        artifact: artifacts[0],
      }));
    });

    it('should not throw when no eventBus configured', () => {
      const artifacts: TaskArtifact[] = [
        { type: 'html', name: 'page.html', path: '/output/page.html' },
      ];
      const task = createTestTask({
        metadata: { priority: 'high', artifacts },
      });
      panel = new TaskDetailPanel(mockScene as unknown as import('phaser').Scene, {
        task,
        position: { x: 200, y: 100 },
        onClose,
      });

      expect(() => {
        panel['emitArtifactEvent']('artifact-preview', artifacts[0]);
      }).not.toThrow();
    });
  });
});
