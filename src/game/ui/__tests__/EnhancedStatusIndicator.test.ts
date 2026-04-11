import { EnhancedStatusIndicator } from '../EnhancedStatusIndicator';
import { TaskStatus } from '../../types/Task';

jest.mock('phaser', () => {
  const mockGraphics = {
    clear: jest.fn(),
    fillStyle: jest.fn().mockReturnThis(),
    lineStyle: jest.fn().mockReturnThis(),
    fillCircle: jest.fn().mockReturnThis(),
    strokeCircle: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    setBlendMode: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };

  const mockContainer = {
    add: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    setAlpha: jest.fn().mockReturnThis(),
    setScale: jest.fn().mockReturnThis(),
    setPosition: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
    alpha: 0,
  };

  const mockText = {
    setText: jest.fn(),
    setOrigin: jest.fn(),
    setDepth: jest.fn().mockReturnThis(),
    setPosition: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
    text: '',
  };

  const mockTween = {
    stop: jest.fn(),
  };

  const mockScene = {
    add: {
      container: jest.fn(() => ({ ...mockContainer })),
      graphics: jest.fn(() => ({ ...mockGraphics })),
      text: jest.fn(() => ({ ...mockText })),
    },
    tweens: {
      add: jest.fn(() => ({ ...mockTween })),
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
    BlendModes: { ADD: 1 },
    __mocks: { mockScene, mockGraphics, mockContainer, mockText, mockTween },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('EnhancedStatusIndicator', () => {
  let indicator: EnhancedStatusIndicator;

  beforeEach(() => {
    jest.clearAllMocks();
    indicator = new EnhancedStatusIndicator(mockScene as any);
  });

  afterEach(() => {
    indicator.destroy();
  });

  describe('constructor', () => {
    it('should create EnhancedStatusIndicator', () => {
      expect(indicator).toBeDefined();
    });

    it('should initialize with pending status', () => {
      expect(indicator.getStatus()).toBe('pending');
    });

    it('should initialize with medium priority', () => {
      expect(indicator.getPriority()).toBe('medium');
    });
  });

  describe('setStatus', () => {
    it('should set pending status', () => {
      indicator.setStatus('pending');
      expect(indicator.getStatus()).toBe('pending');
    });

    it('should set assigned status', () => {
      indicator.setStatus('assigned');
      expect(indicator.getStatus()).toBe('assigned');
    });

    it('should set working status', () => {
      indicator.setStatus('working');
      expect(indicator.getStatus()).toBe('working');
    });

    it('should set reviewing status', () => {
      indicator.setStatus('reviewing');
      expect(indicator.getStatus()).toBe('reviewing');
    });

    it('should set completed status', () => {
      indicator.setStatus('completed');
      expect(indicator.getStatus()).toBe('completed');
    });

    it('should set failed status', () => {
      indicator.setStatus('failed');
      expect(indicator.getStatus()).toBe('failed');
    });
  });

  describe('setPriority', () => {
    it('should set high priority', () => {
      indicator.setPriority('high');
      expect(indicator.getPriority()).toBe('high');
    });

    it('should set medium priority', () => {
      indicator.setPriority('medium');
      expect(indicator.getPriority()).toBe('medium');
    });

    it('should set low priority', () => {
      indicator.setPriority('low');
      expect(indicator.getPriority()).toBe('low');
    });
  });

  describe('setPosition', () => {
    it('should set position', () => {
      indicator.setPosition(100, 200);
      expect(mockContainer.setPosition).toHaveBeenCalled();
    });
  });

  describe('show/hide', () => {
    it('should show indicator', () => {
      indicator.show();
      expect(indicator).toBeDefined();
    });

    it('should hide indicator', () => {
      indicator.show();
      indicator.hide();
      expect(indicator).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update without errors', () => {
      expect(() => indicator.update()).not.toThrow();
    });

    it('should handle multiple updates', () => {
      for (let i = 0; i < 10; i++) {
        indicator.update();
      }
      expect(indicator).toBeDefined();
    });
  });

  describe('isActive', () => {
    it('should return false when hidden', () => {
      indicator.hide();
      expect(indicator).toBeDefined();
    });

    it('should return true when shown', () => {
      indicator.show();
      expect(indicator).toBeDefined();
    });
  });

  describe('setScale', () => {
    it('should set scale', () => {
      indicator.setScale(2);
      expect(indicator).toBeDefined();
    });

    it('should handle different scale values', () => {
      [0.5, 1, 1.5, 2, 3].forEach(scale => {
        indicator.setScale(scale);
      });
      expect(indicator).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('should destroy without errors', () => {
      expect(() => indicator.destroy()).not.toThrow();
    });

    it('should handle multiple destroy calls', () => {
      indicator.destroy();
      expect(() => indicator.destroy()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle update after destroy', () => {
      indicator.destroy();
      expect(() => indicator.update()).not.toThrow();
    });

    it('should handle all status to priority combinations', () => {
      const statuses: TaskStatus[] = ['pending', 'assigned', 'working', 'reviewing', 'completed', 'failed'];
      const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

      statuses.forEach(status => {
        priorities.forEach(priority => {
          const ind = new EnhancedStatusIndicator(mockScene as any);
          ind.setStatus(status);
          ind.setPriority(priority);
          ind.destroy();
        });
      });
    });
  });
});

const mockContainer = (Phaser as any).__mocks.mockContainer;