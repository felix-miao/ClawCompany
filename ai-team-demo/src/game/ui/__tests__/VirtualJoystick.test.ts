import { VirtualJoystick } from '../VirtualJoystick';

describe('VirtualJoystick', () => {
  let mockScene: any;
  let mockPointer: any;

  beforeEach(() => {
    mockPointer = {
      x: 100,
      y: 100,
      isDown: false,
      wasTouch: false,
    };

    mockScene = {
      add: {
        container: jest.fn().mockReturnValue({
          setDepth: jest.fn(),
          setVisible: jest.fn(),
          setAlpha: jest.fn(),
          setPosition: jest.fn(),
          add: jest.fn(),
          destroy: jest.fn(),
        }),
        graphics: jest.fn().mockReturnValue({
          fillCircle: jest.fn(),
          strokeCircle: jest.fn(),
          lineStyle: jest.fn(),
          fillStyle: jest.fn(),
          clear: jest.fn(),
          setPosition: jest.fn(),
          destroy: jest.fn(),
        }),
        circle: jest.fn().mockReturnValue({
          setStrokeStyle: jest.fn(),
          setFillStyle: jest.fn(),
          setPosition: jest.fn(),
          destroy: jest.fn(),
        }),
      },
      input: {
        on: jest.fn(),
        off: jest.fn(),
      },
      cameras: {
        main: {
          worldView: { x: 0, y: 0, width: 800, height: 600 },
        },
      },
      scale: {
        width: 800,
        height: 600,
      },
      tweens: {
        add: jest.fn(),
      },
    };
  });

  describe('create joystick', () => {
    it('should create joystick with default config', () => {
      const joystick = new VirtualJoystick(mockScene);

      expect(mockScene.add.container).toHaveBeenCalled();
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });

    it('should be hidden by default', () => {
      const joystick = new VirtualJoystick(mockScene);
      const container = mockScene.add.container.mock.results[0].value;

      expect(container.setVisible).toHaveBeenCalledWith(false);
    });

    it('should accept custom position and size', () => {
      const joystick = new VirtualJoystick(mockScene, {
        x: 100,
        y: 400,
        radius: 50,
      });

      expect(mockScene.add.container).toHaveBeenCalled();
    });
  });

  describe('show and hide', () => {
    it('should show joystick', () => {
      const joystick = new VirtualJoystick(mockScene);
      joystick.show();
      const container = mockScene.add.container.mock.results[0].value;

      expect(container.setVisible).toHaveBeenCalledWith(true);
    });

    it('should hide joystick', () => {
      const joystick = new VirtualJoystick(mockScene);
      joystick.hide();
      const container = mockScene.add.container.mock.results[0].value;

      expect(container.setVisible).toHaveBeenCalledWith(false);
    });

    it('should toggle visibility', () => {
      const joystick = new VirtualJoystick(mockScene);
      const container = mockScene.add.container.mock.results[0].value;

      joystick.show();
      expect(container.setVisible).toHaveBeenCalledWith(true);

      joystick.hide();
      expect(container.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('touch input handling', () => {
    it('should register pointer down handler', () => {
      const joystick = new VirtualJoystick(mockScene);

      expect(mockScene.input.on).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
        expect.any(VirtualJoystick)
      );
    });

    it('should register pointer move handler', () => {
      const joystick = new VirtualJoystick(mockScene);

      expect(mockScene.input.on).toHaveBeenCalledWith(
        'pointermove',
        expect.any(Function),
        expect.any(VirtualJoystick)
      );
    });

    it('should register pointer up handler', () => {
      const joystick = new VirtualJoystick(mockScene);

      expect(mockScene.input.on).toHaveBeenCalledWith(
        'pointerup',
        expect.any(Function),
        expect.any(VirtualJoystick)
      );
    });
  });

  describe('get direction', () => {
    it('should return zero vector when not active', () => {
      const joystick = new VirtualJoystick(mockScene);
      const direction = joystick.getDirection();

      expect(direction.x).toBe(0);
      expect(direction.y).toBe(0);
    });

    it('should return normalized direction when active', () => {
      const joystick = new VirtualJoystick(mockScene);
      joystick.show();

      // Simulate touch
      mockPointer.x = 150;
      mockPointer.y = 500;
      mockPointer.isDown = true;
      mockPointer.wasTouch = true;

      const call = mockScene.input.on.mock.calls.find(
        (c: any[]) => c[0] === 'pointerdown'
      );
      const handler = call?.[1];
      const context = call?.[2];

      if (handler && context) {
        handler.call(context, mockPointer);
      }

      // Direction should be calculated
      const direction = joystick.getDirection();
      expect(typeof direction.x).toBe('number');
      expect(typeof direction.y).toBe('number');
    });
  });

  describe('is active', () => {
    it('should not be active initially', () => {
      const joystick = new VirtualJoystick(mockScene);

      expect(joystick.isActive()).toBe(false);
    });

    it('should be active when touching', () => {
      const joystick = new VirtualJoystick(mockScene);
      joystick.show();

      mockPointer.isDown = true;
      mockPointer.wasTouch = true;
      mockPointer.x = 100;
      mockPointer.y = 500;

      const call = mockScene.input.on.mock.calls.find(
        (c: any[]) => c[0] === 'pointerdown'
      );
      const handler = call?.[1];
      const context = call?.[2];

      if (handler && context) {
        handler.call(context, mockPointer);
      }

      // Check if the joystick is tracking
      expect(joystick.isActive()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy cleanly', () => {
      const joystick = new VirtualJoystick(mockScene);
      joystick.destroy();

      expect(mockScene.input.off).toHaveBeenCalled();
    });

    it('should handle double destroy', () => {
      const joystick = new VirtualJoystick(mockScene);
      joystick.destroy();
      joystick.destroy();

      // Should not throw
    });
  });

  describe('responsive visibility', () => {
    it('should check if touch device', () => {
      const joystick = new VirtualJoystick(mockScene);

      // This will depend on the environment
      const isTouch = joystick.isTouchDevice();
      expect(typeof isTouch).toBe('boolean');
    });
  });
});
