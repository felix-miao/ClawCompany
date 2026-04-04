import { TaskHistoryPanel } from '../TaskHistoryPanel';
import { TaskHistoryStore } from '../../data/TaskHistoryStore';
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
      width: 0,
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
      setVisible: jest.fn((val: boolean) => {
        c._visible = val;
      }),
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
      _visible: true,
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

describe('TaskHistoryPanel', () => {
  let panel: TaskHistoryPanel;
  let store: TaskHistoryStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new TaskHistoryStore();
    panel = new TaskHistoryPanel(mockScene, store);
  });

  afterEach(() => {
    panel.destroy();
  });

  describe('show and hide', () => {
    it('should show panel', () => {
      panel.show();
      expect(panel.isVisible()).toBe(true);
    });

    it('should hide panel', () => {
      panel.show();
      panel.hide();
      expect(panel.isVisible()).toBe(false);
    });

    it('should toggle visibility', () => {
      expect(panel.isVisible()).toBe(false);
      panel.show();
      expect(panel.isVisible()).toBe(true);
      panel.hide();
      expect(panel.isVisible()).toBe(false);
    });
  });

  describe('display records', () => {
    it('should display records from store', () => {
      store.addRecord(createTestTask({ id: '1' }));
      store.addRecord(createTestTask({ id: '2' }));

      panel.show();

      expect(panel.getRecordCount()).toBe(2);
    });

    it('should show empty panel with zero records', () => {
      panel.show();
      expect(panel.getRecordCount()).toBe(0);
    });

    it('should update records on update()', () => {
      panel.show();
      expect(panel.getRecordCount()).toBe(0);

      store.addRecord(createTestTask());
      panel.update();

      expect(panel.getRecordCount()).toBe(1);
    });

    it('should not update when hidden', () => {
      store.addRecord(createTestTask());
      panel.update();

      expect(panel.getRecordCount()).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(TaskHistoryPanel.formatDuration(1000)).toBe('1秒');
    });

    it('should format minutes and seconds', () => {
      expect(TaskHistoryPanel.formatDuration(65000)).toBe('1分5秒');
    });

    it('should format zero', () => {
      expect(TaskHistoryPanel.formatDuration(0)).toBe('0秒');
    });

    it('should format large durations', () => {
      expect(TaskHistoryPanel.formatDuration(3661000)).toBe('61分1秒');
    });
  });

  describe('scrolling', () => {
    it('should scroll down', () => {
      for (let i = 0; i < 15; i++) {
        store.addRecord(createTestTask({ id: String(i) }));
      }

      panel.show();
      panel.scrollDown();

      expect(panel.getRecordCount()).toBe(15);
    });

    it('should scroll up after scrolling down', () => {
      for (let i = 0; i < 15; i++) {
        store.addRecord(createTestTask({ id: String(i) }));
      }

      panel.show();
      panel.scrollDown();
      panel.scrollUp();

      expect(panel.getRecordCount()).toBe(15);
    });

    it('should not scroll up past the beginning', () => {
      panel.show();
      panel.scrollUp();
    });

    it('should not scroll down past the end', () => {
      store.addRecord(createTestTask());
      panel.show();
      panel.scrollDown();
    });
  });

  describe('setPosition', () => {
    it('should set panel position', () => {
      panel.setPosition(100, 200);
    });
  });

  describe('destroy', () => {
    it('should destroy cleanly', () => {
      store.addRecord(createTestTask());
      panel.show();

      expect(() => panel.destroy()).not.toThrow();
      expect(panel.isDestroyed()).toBe(true);
    });

    it('should handle double destroy', () => {
      panel.destroy();
      expect(() => panel.destroy()).not.toThrow();
      expect(panel.isDestroyed()).toBe(true);
    });

    it('should not show after destroy', () => {
      panel.destroy();
      panel.show();
      expect(panel.isVisible()).toBe(false);
    });
  });
});
