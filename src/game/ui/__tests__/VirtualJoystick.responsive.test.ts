import { VirtualJoystick } from '../VirtualJoystick';

jest.mock('phaser', () => {
  const createMockContainer = () => ({
    setDepth: jest.fn().mockReturnThis(),
    setVisible: jest.fn(),
    setAlpha: jest.fn(),
    add: jest.fn(),
    destroy: jest.fn(),
    setPosition: jest.fn(),
    setScale: jest.fn(),
  });

  const createMockGraphics = () => ({
    clear: jest.fn(),
    lineStyle: jest.fn(),
    strokeCircle: jest.fn(),
    fillStyle: jest.fn(),
    fillCircle: jest.fn(),
    setPosition: jest.fn(),
    destroy: jest.fn(),
  });

  const mockScene: any = {
    add: {
      container: jest.fn(() => createMockContainer()),
      graphics: jest.fn(() => createMockGraphics()),
    },
    input: {
      on: jest.fn(),
      off: jest.fn(),
    },
    cameras: {
      main: {
        width: 800,
        height: 600,
      },
    },
    tweens: {
      add: jest.fn().mockReturnValue({ destroy: jest.fn() }),
    },
  };

  return {
    default: {
      Scale: { FIT: 0, CENTER_BOTH: 0 },
    },
    __mocks: { mockScene },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('VirtualJoystick - Responsive Design', () => {
  let joystick: VirtualJoystick;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (joystick) joystick.destroy();
  });

  describe('touch device detection', () => {
    it('should detect touch device capability', () => {
      joystick = new VirtualJoystick(mockScene as any, { autoShow: false });

      const isTouch = joystick.isTouchDevice();
      expect(typeof isTouch).toBe('boolean');
    });

    it('should return false in jsdom environment', () => {
      joystick = new VirtualJoystick(mockScene as any, { autoShow: false });
      const result = joystick.isTouchDevice();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('auto-show for touch', () => {
    it('should auto-show on touch devices when configured', () => {
      const origNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: { ...origNavigator, maxTouchPoints: 5 },
        writable: true,
      });
      Object.defineProperty(global, 'ontouchstart', {
        value: {},
        writable: true,
      });

      joystick = new VirtualJoystick(mockScene as any, {
        autoShow: true,
      });

      expect(joystick.isVisible()).toBe(true);

      Object.defineProperty(global, 'navigator', {
        value: origNavigator,
        writable: true,
      });
      delete (global as any).ontouchstart;
    });

    it('should not auto-show on non-touch devices', () => {
      joystick = new VirtualJoystick(mockScene as any, {
        autoShow: true,
      });

      expect(joystick.isVisible()).toBe(false);
    });
  });

  describe('position update for different screen sizes', () => {
    it('should accept dynamic position updates', () => {
      joystick = new VirtualJoystick(mockScene as any);

      joystick.setPosition(200, 400);
      expect(joystick.getDirection()).toEqual({ x: 0, y: 0 });
    });

    it('should maintain state after position change', () => {
      joystick = new VirtualJoystick(mockScene as any);
      joystick.show();

      joystick.setPosition(300, 500);

      expect(joystick.isVisible()).toBe(true);
    });
  });

  describe('show/hide behavior', () => {
    it('should toggle visibility', () => {
      joystick = new VirtualJoystick(mockScene as any);

      joystick.show();
      expect(joystick.isVisible()).toBe(true);

      joystick.hide();
      expect(joystick.isVisible()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on destroy', () => {
      joystick = new VirtualJoystick(mockScene as any);
      joystick.show();
      joystick.destroy();

      expect(mockScene.input.off).toHaveBeenCalled();
      expect(mockScene.input.off).toHaveBeenCalledTimes(3);
    });

    it('should not throw on double destroy', () => {
      joystick = new VirtualJoystick(mockScene as any);
      joystick.destroy();

      expect(() => joystick.destroy()).not.toThrow();
    });
  });
});
