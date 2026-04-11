import { AgentHistoryPanel } from '../AgentHistoryPanel';
import { TaskHistoryStore } from '../../data/TaskHistoryStore';
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
  setInteractive: jest.Mock<() => MockGraphics>;
  on: jest.Mock;
  alpha: number;
  width: number;
  lineStyle: jest.Mock;
  strokeRoundedRect: jest.Mock;
  fillCircle: jest.Mock;
  lineBetween: jest.Mock;
  strokeCircle: jest.Mock;
}

interface MockText {
  text: string;
  setText: jest.Mock<(val: string) => void>;
  setOrigin: jest.Mock;
  width: number;
  height: number;
  setPosition: jest.Mock;
  destroy: jest.Mock;
  setDepth: jest.Mock;
  setInteractive: jest.Mock;
  on: jest.Mock;
}

interface MockContainer {
  x: number;
  y: number;
  setDepth: jest.Mock;
  setAlpha: jest.Mock;
  setVisible: jest.Mock<(val: boolean) => void>;
  add: jest.Mock<(child: any) => void>;
  remove: jest.Mock<(child: any) => void>;
  setScrollFactor: jest.Mock;
  setInteractive: jest.Mock;
  on: jest.Mock;
  getBounds: jest.Mock<() => { contains: (x: number, y: number) => boolean }>;
  destroy: jest.Mock;
  _visible: boolean;
}

interface MockScene {
  add: {
    container: jest.Mock<() => MockContainer>;
    graphics: jest.Mock<() => MockGraphics>;
    text: jest.Mock<() => MockText>;
  };
  time: {
    delayedCall: jest.Mock<(delay: number, callback: () => void) => { destroy: jest.Mock }>;
  };
  tweens: {
    add: jest.Mock<(config: any) => { stop: jest.Mock }>;
  };
  input: {
    on: jest.Mock;
    off: jest.Mock;
  };
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
    setInteractive: jest.fn().mockReturnThis(),
    on: jest.fn(),
    alpha: 0,
    width: 0,
    lineStyle: jest.fn(),
    strokeRoundedRect: jest.fn(),
    fillCircle: jest.fn(),
    lineBetween: jest.fn(),
    strokeCircle: jest.fn(),
  });

  const createMockText = (): MockText => {
    const textObj: MockText = {
      text: '',
      setText: jest.fn((val: string) => {
        textObj.text = val;
      }) as any,
      setOrigin: jest.fn() as any,
      width: 80,
      height: 16,
      setPosition: jest.fn() as any,
      destroy: jest.fn() as any,
      setDepth: jest.fn() as any,
      setInteractive: jest.fn() as any,
      on: jest.fn() as any,
    };
    return textObj;
  };

  const createMockContainer = (): MockContainer => {
    const children: any[] = [];
    const c: MockContainer = {
      x: 0,
      y: 0,
      setDepth: jest.fn() as any,
      setAlpha: jest.fn() as any,
      setVisible: jest.fn((val: boolean) => {
        c._visible = val;
      }) as any,
      add: jest.fn((item: any) => children.push(item)) as any,
      remove: jest.fn((item: any) => {
        const idx = children.indexOf(item);
        if (idx >= 0) children.splice(idx, 1);
      }) as any,
      destroy: jest.fn() as any,
      setPosition: jest.fn((x: number, y: number) => {
        c.x = x;
        c.y = y;
      }) as any,
      setScrollFactor: jest.fn() as any,
      setInteractive: jest.fn() as any,
      on: jest.fn() as any,
      getBounds: jest.fn().mockReturnValue({ contains: () => false }) as any,
      getChildren: jest.fn(() => children) as any,
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
      Geom: {
        Rectangle: {
          Contains: jest.fn(),
        },
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
    Geom: {
      Rectangle: {
        Contains: jest.Mock;
      };
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

describe('AgentHistoryPanel', () => {
  let panel: AgentHistoryPanel;
  let store: TaskHistoryStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new TaskHistoryStore();
    panel = new AgentHistoryPanel(mockScene as unknown as import('phaser').Scene, store);
  });

  afterEach(() => {
    panel.destroy();
  });

  describe('showForAgent and hide', () => {
    it('should show panel for a specific agent', () => {
      panel.showForAgent('alice', 'Alice');
      expect(panel.isVisible()).toBe(true);
    });

    it('should hide panel', () => {
      panel.showForAgent('alice', 'Alice');
      panel.hide();
      expect(panel.isVisible()).toBe(false);
    });

    it('should not show after destroy', () => {
      panel.destroy();
      panel.showForAgent('alice', 'Alice');
      expect(panel.isVisible()).toBe(false);
    });
  });

  describe('agent filtering', () => {
    it('should only show records for the selected agent', () => {
      store.addRecord(createTestTask({ id: '1', agentId: 'alice' }));
      store.addRecord(createTestTask({ id: '2', agentId: 'bob' }));
      store.addRecord(createTestTask({ id: '3', agentId: 'alice' }));

      panel.showForAgent('alice', 'Alice');

      expect(panel.getRecordCount()).toBe(2);
    });

    it('should include records where agent appears in handoffs', () => {
      const task = createTestTask({ id: '1', agentId: 'bob' });
      store.recordHandoff('1', 'alice', 'bob');
      store.addRecord(task);

      panel.showForAgent('alice', 'Alice');

      expect(panel.getRecordCount()).toBe(1);
    });

    it('should show zero records for agent with no history', () => {
      store.addRecord(createTestTask({ id: '1', agentId: 'alice' }));

      panel.showForAgent('bob', 'Bob');

      expect(panel.getRecordCount()).toBe(0);
    });

    it('should update records when switching agents', () => {
      store.addRecord(createTestTask({ id: '1', agentId: 'alice' }));
      store.addRecord(createTestTask({ id: '2', agentId: 'bob' }));

      panel.showForAgent('alice', 'Alice');
      expect(panel.getRecordCount()).toBe(1);

      panel.showForAgent('bob', 'Bob');
      expect(panel.getRecordCount()).toBe(1);
    });
  });

  describe('current agent', () => {
    it('should track current agent id', () => {
      panel.showForAgent('alice', 'Alice');
      expect(panel.getCurrentAgentId()).toBe('alice');
    });

    it('should return null when not shown', () => {
      expect(panel.getCurrentAgentId()).toBeNull();
    });
  });

  describe('scrolling', () => {
    it('should scroll down', () => {
      for (let i = 0; i < 15; i++) {
        store.addRecord(createTestTask({ id: String(i), agentId: 'alice' }));
      }

      panel.showForAgent('alice', 'Alice');
      panel.scrollDown();

      expect(panel.getRecordCount()).toBe(15);
    });

    it('should scroll up after scrolling down', () => {
      for (let i = 0; i < 15; i++) {
        store.addRecord(createTestTask({ id: String(i), agentId: 'alice' }));
      }

      panel.showForAgent('alice', 'Alice');
      panel.scrollDown();
      panel.scrollUp();

      expect(panel.getRecordCount()).toBe(15);
    });

    it('should not scroll up past the beginning', () => {
      panel.showForAgent('alice', 'Alice');
      panel.scrollUp();
    });

    it('should not scroll down past the end', () => {
      store.addRecord(createTestTask({ agentId: 'alice' }));
      panel.showForAgent('alice', 'Alice');
      panel.scrollDown();
    });
  });

  describe('update', () => {
    it('should refresh records on update', () => {
      panel.showForAgent('alice', 'Alice');
      expect(panel.getRecordCount()).toBe(0);

      store.addRecord(createTestTask({ agentId: 'alice' }));
      panel.update();

      expect(panel.getRecordCount()).toBe(1);
    });

    it('should not update when hidden', () => {
      store.addRecord(createTestTask({ agentId: 'alice' }));
      panel.update();

      expect(panel.getRecordCount()).toBe(0);
    });
  });

  describe('setPosition', () => {
    it('should set panel position', () => {
      panel.setPosition(100, 200);
    });
  });

  describe('destroy', () => {
    it('should destroy cleanly', () => {
      store.addRecord(createTestTask({ agentId: 'alice' }));
      panel.showForAgent('alice', 'Alice');

      expect(() => panel.destroy()).not.toThrow();
      expect(panel.isDestroyed()).toBe(true);
    });

    it('should handle double destroy', () => {
      panel.destroy();
      expect(() => panel.destroy()).not.toThrow();
      expect(panel.isDestroyed()).toBe(true);
    });
  });
});
