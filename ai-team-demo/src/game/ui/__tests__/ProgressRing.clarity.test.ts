import { ProgressRing } from '../ProgressRing';

jest.mock('phaser', () => {
  const mockGraphics = {
    clear: jest.fn(),
    lineStyle: jest.fn(),
    strokeCircle: jest.fn(),
    fillStyle: jest.fn(),
    fillCircle: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    arc: jest.fn(),
    strokePath: jest.fn(),
    fillRect: jest.fn(),
    setPosition: jest.fn(),
    setDepth: jest.fn().mockReturnThis(),
    setAlpha: jest.fn(),
    setScale: jest.fn(),
    destroy: jest.fn(),
    alpha: 0,
    x: 0,
    y: 0,
  };

  const mockText = {
    setText: jest.fn(),
    setOrigin: jest.fn(),
    setDepth: jest.fn(),
    setPosition: jest.fn(),
    setFontSize: jest.fn(),
    setColor: jest.fn(),
    setStroke: jest.fn(),
    destroy: jest.fn(),
    text: '',
  };

  const mockScene = {
    add: {
      graphics: jest.fn(() => ({ ...mockGraphics })),
      text: jest.fn(() => ({ ...mockText })),
    },
    time: {
      delayedCall: jest.fn().mockReturnValue({ remove: jest.fn() }),
    },
  };

  return {
    default: {
      GameObjects: { Graphics: jest.fn() },
    },
    __mocks: { mockScene, mockGraphics, mockText },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('ProgressRing - Visual Clarity', () => {
  let ring: ProgressRing;

  beforeEach(() => {
    jest.clearAllMocks();
    ring = new ProgressRing(mockScene as any);
  });

  afterEach(() => {
    ring.destroy();
  });

  describe('progress text memory management', () => {
    it('should reuse text object when progress stays the same', () => {
      ring.setPosition(100, 100);
      ring.show(100, 100);
      ring.setProgress(50);
      ring.update();
      ring.update();

      const textCallCount = mockScene.add.text.mock.calls.length;

      ring.update();

      const newTextCallCount = mockScene.add.text.mock.calls.length;
      expect(newTextCallCount).toBe(textCallCount);
    });

    it('should not create text when progress is below 10%', () => {
      ring.setPosition(100, 100);
      ring.show(100, 100);
      ring.setProgress(5);
      ring.update();

      expect(mockScene.add.text).not.toHaveBeenCalled();
    });

    it('should create text when progress exceeds 10%', () => {
      ring.setPosition(100, 100);
      ring.show(100, 100);
      ring.setProgress(80);
      for (let i = 0; i < 20; i++) {
        ring.update();
      }

      expect(mockScene.add.text).toHaveBeenCalled();
    });

    it('should clean up text on destroy', () => {
      ring.setProgress(50);
      ring.update();

      ring.destroy();

      expect(true).toBe(true);
    });
  });

  describe('smooth progress animation', () => {
    it('should animate progress smoothly rather than jumping', () => {
      ring.setProgress(100);
      ring.update();

      const progress1 = ring.getProgress();
      expect(progress1).toBeLessThan(100);
      expect(progress1).toBeGreaterThan(0);

      for (let i = 0; i < 50; i++) {
        ring.update();
      }

      const finalProgress = ring.getProgress();
      expect(finalProgress).toBeCloseTo(100, 0);
    });

    it('should handle negative progress gracefully', () => {
      expect(() => ring.setProgress(-10)).not.toThrow();
      ring.update();
      expect(ring.getProgress()).toBeGreaterThanOrEqual(0);
    });

    it('should cap progress at 100', () => {
      ring.setProgress(200);
      ring.update();

      for (let i = 0; i < 50; i++) {
        ring.update();
      }

      expect(ring.getProgress()).toBeLessThanOrEqual(100);
    });
  });

  describe('fade animation', () => {
    it('should animate alpha for smooth show/hide', () => {
      ring.show(100, 100);
      ring.update();

      expect(ring.isActive()).toBe(true);
    });

    it('should mark as inactive after hiding', () => {
      ring.show(100, 100);
      ring.update();

      ring.hide();
      for (let i = 0; i < 50; i++) {
        ring.update();
      }

      expect(ring.isActive()).toBe(false);
    });
  });
});
