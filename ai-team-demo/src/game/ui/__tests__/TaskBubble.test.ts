import { TaskBubble } from '../TaskBubble';

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
  });

  const createMockContainer = () => {
    const c: any = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      setDepth: jest.fn(),
      setAlpha: jest.fn(),
      add: jest.fn(),
      destroy: jest.fn(),
      setPosition: jest.fn((x: number, y: number) => {
        c.x = x;
        c.y = y;
      }),
      setScale: jest.fn(function (this: any, sx: number, sy?: number) {
        c.scaleX = sx;
        c.scaleY = sy ?? sx;
      }),
    };
    return c;
  };

  const mockScene = {
    add: {
      container: jest.fn(() => createMockContainer()),
      graphics: jest.fn(() => createMockGraphics()),
      text: jest.fn(() => createMockText()),
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

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('TaskBubble', () => {
  let bubble: TaskBubble;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (bubble) {
      bubble.destroy();
    }
  });

  describe('basic functionality', () => {
    it('should create without error', () => {
      expect(() => {
        bubble = new TaskBubble(mockScene);
      }).not.toThrow();
    });

    it('should set and get status', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setStatus('working');
      expect(bubble.getStatus()).toBe('working');
    });

    it('should report active after show', () => {
      bubble = new TaskBubble(mockScene);
      bubble.show(100, 200, 'working', 'Coding...');
      bubble.update();
      expect(bubble.isActive()).toBe(true);
    });

    it('should report inactive after hide', () => {
      bubble = new TaskBubble(mockScene);
      bubble.show(100, 200, 'working', 'Coding...');
      bubble.update();
      bubble.hide();
      for (let i = 0; i < 50; i++) bubble.update();
      expect(bubble.isActive()).toBe(false);
    });

    it('should return position', () => {
      bubble = new TaskBubble(mockScene);
      bubble.show(50, 75, 'pending', 'Waiting...');
      const pos = bubble.getPosition();
      expect(pos.x).toBe(50);
      expect(pos.y).toBe(75);
    });
  });

  describe('priority styling', () => {
    it('should default to medium priority', () => {
      bubble = new TaskBubble(mockScene);
      expect(bubble.getPriority()).toBe('medium');
    });

    it('should set and get priority', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('high');
      expect(bubble.getPriority()).toBe('high');
    });

    it('should return red border color for high priority', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('high');
      expect(bubble.getBorderColor()).toBe(0xEF4444);
    });

    it('should return yellow border color for medium priority', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('medium');
      expect(bubble.getBorderColor()).toBe(0xF59E0B);
    });

    it('should return green border color for low priority', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('low');
      expect(bubble.getBorderColor()).toBe(0x10B981);
    });

    it('should default to yellow border color for unknown priority', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('unknown');
      expect(bubble.getBorderColor()).toBe(0xF59E0B);
    });

    it('should scale up for high priority', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('high');
      expect(bubble.getScale()).toBe(1.1);
    });

    it('should have normal scale for medium priority', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('medium');
      expect(bubble.getScale()).toBe(1.0);
    });

    it('should scale down for low priority', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('low');
      expect(bubble.getScale()).toBe(0.9);
    });

    it('should apply scale to container on setPriority', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('high');
      const container = mockScene.add.container.mock.results[0].value;
      expect(container.setScale).toHaveBeenCalledWith(1.1);
    });

    it('should draw border with priority color on redraw', () => {
      bubble = new TaskBubble(mockScene);
      bubble.setPriority('high');
      bubble.show(100, 200, 'working', 'Coding...');
      bubble.update();

      const graphicsResults = mockScene.add.graphics.mock.results;
      const borderGraphics = graphicsResults[1].value;

      expect(borderGraphics.lineStyle).toHaveBeenCalledWith(2, 0xEF4444, 1);
      expect(borderGraphics.strokeRoundedRect).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy cleanly', () => {
      bubble = new TaskBubble(mockScene);
      expect(() => bubble.destroy()).not.toThrow();
    });
  });
});
