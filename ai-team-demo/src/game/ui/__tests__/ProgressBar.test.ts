import { ProgressBar } from '../ProgressBar';

jest.mock('phaser', () => {
  const createMockGraphics = () => {
    const g: any = {
      clear: jest.fn(),
      fillStyle: jest.fn(),
      fillRect: jest.fn(),
      fillRoundedRect: jest.fn(),
      setPosition: jest.fn(),
      setDepth: jest.fn(),
      setAlpha: jest.fn((a: number) => {
        g.alpha = a;
      }),
      destroy: jest.fn(),
      alpha: 0,
    };
    return g;
  };

  const mockScene = {
    add: {
      graphics: jest.fn(() => createMockGraphics()),
    },
  };

  return {
    default: {
      GameObjects: {
        Graphics: jest.fn(),
      },
    },
    __mocks: { mockScene },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('ProgressBar', () => {
  let bar: ProgressBar;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (bar) {
      bar.destroy();
    }
  });

  describe('basic functionality', () => {
    it('should create without error', () => {
      expect(() => {
        bar = new ProgressBar(mockScene);
      }).not.toThrow();
    });

    it('should set and get progress', () => {
      bar = new ProgressBar(mockScene);
      bar.setProgress(50);
      for (let i = 0; i < 100; i++) bar.update();
      expect(Math.round(bar.getProgress())).toBe(50);
    });

    it('should clamp progress to 0-100', () => {
      bar = new ProgressBar(mockScene);
      bar.setProgress(150);
      bar.update();
      for (let i = 0; i < 100; i++) bar.update();
      expect(bar.getProgress()).toBeLessThanOrEqual(100);
    });

    it('should report active after show', () => {
      bar = new ProgressBar(mockScene);
      bar.show(0, 0);
      expect(bar.isActive()).toBe(true);
    });

    it('should report inactive after hide', () => {
      bar = new ProgressBar(mockScene);
      bar.show(0, 0);
      bar.hide();
      expect(bar.isActive()).toBe(false);
    });
  });

  describe('progress color without priority', () => {
    it('should return red for low progress', () => {
      bar = new ProgressBar(mockScene);
      bar.setProgress(10);
      bar.update();
      for (let i = 0; i < 100; i++) bar.update();
      expect(bar.getProgressColor()).toBe(0xEF4444);
    });

    it('should return yellow for medium progress', () => {
      bar = new ProgressBar(mockScene);
      bar.setProgress(50);
      bar.update();
      for (let i = 0; i < 100; i++) bar.update();
      expect(bar.getProgressColor()).toBe(0xF59E0B);
    });

    it('should return green for high progress', () => {
      bar = new ProgressBar(mockScene);
      bar.setProgress(90);
      bar.update();
      for (let i = 0; i < 100; i++) bar.update();
      expect(bar.getProgressColor()).toBe(0x10B981);
    });
  });

  describe('priority-based color', () => {
    it('should default to null priority', () => {
      bar = new ProgressBar(mockScene);
      expect(bar.getPriority()).toBeNull();
    });

    it('should set and get priority', () => {
      bar = new ProgressBar(mockScene);
      bar.setPriority('high');
      expect(bar.getPriority()).toBe('high');
    });

    it('should return red color for high priority regardless of progress', () => {
      bar = new ProgressBar(mockScene);
      bar.setPriority('high');
      bar.setProgress(90);
      bar.update();
      for (let i = 0; i < 100; i++) bar.update();
      expect(bar.getProgressColor()).toBe(0xEF4444);
    });

    it('should return yellow color for medium priority regardless of progress', () => {
      bar = new ProgressBar(mockScene);
      bar.setPriority('medium');
      bar.setProgress(10);
      bar.update();
      for (let i = 0; i < 100; i++) bar.update();
      expect(bar.getProgressColor()).toBe(0xF59E0B);
    });

    it('should return green color for low priority regardless of progress', () => {
      bar = new ProgressBar(mockScene);
      bar.setPriority('low');
      bar.setProgress(10);
      bar.update();
      for (let i = 0; i < 100; i++) bar.update();
      expect(bar.getProgressColor()).toBe(0x10B981);
    });

    it('should use progress-based color when priority is null', () => {
      bar = new ProgressBar(mockScene);
      bar.setProgress(50);
      bar.update();
      for (let i = 0; i < 100; i++) bar.update();
      expect(bar.getProgressColor()).toBe(0xF59E0B);
    });

    it('should use progress-based color for unknown priority', () => {
      bar = new ProgressBar(mockScene);
      bar.setPriority('unknown');
      bar.setProgress(90);
      bar.update();
      for (let i = 0; i < 100; i++) bar.update();
      expect(bar.getProgressColor()).toBe(0x10B981);
    });
  });

  describe('destroy', () => {
    it('should destroy cleanly', () => {
      bar = new ProgressBar(mockScene);
      expect(() => bar.destroy()).not.toThrow();
    });
  });
});
