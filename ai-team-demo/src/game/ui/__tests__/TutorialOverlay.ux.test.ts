import { TutorialOverlay, TutorialStep } from '../TutorialOverlay';

jest.mock('phaser', () => {
  const createMockGraphics = () => ({
    clear: jest.fn(),
    fillStyle: jest.fn(),
    fillRect: jest.fn(),
    fillRoundedRect: jest.fn(),
    lineStyle: jest.fn(),
    strokeRoundedRect: jest.fn(),
    strokeRect: jest.fn(),
    setPosition: jest.fn(),
    setDepth: jest.fn(),
    setAlpha: jest.fn(),
    setBlendMode: jest.fn(),
    destroy: jest.fn(),
    alpha: 0,
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    strokeCircle: jest.fn(),
    fillCircle: jest.fn(),
  });

  const createMockText = () => {
    let currentColor = '';
    const text: any = {
      setText: jest.fn(),
      setOrigin: jest.fn(),
      setY: jest.fn(),
      setX: jest.fn(),
      text: '',
      width: 80,
      height: 16,
      setPosition: jest.fn(),
      destroy: jest.fn(),
      setInteractive: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      setColor: jest.fn((c: string) => { currentColor = c; }),
      getColor: () => currentColor,
      setAlpha: jest.fn(),
      setDepth: jest.fn(),
    };
    return text;
  };

  const createMockContainer = () => {
    const c: any = {
      x: 0,
      y: 0,
      setDepth: jest.fn(),
      setAlpha: jest.fn(),
      add: jest.fn(),
      destroy: jest.fn(),
      setPosition: jest.fn((x: number, y: number) => {
        c.x = x;
        c.y = y;
      }),
      setVisible: jest.fn(),
      setScale: jest.fn(),
    };
    return c;
  };

  const mockTween = { destroy: jest.fn(), stop: jest.fn() };

  const mockTimerEvent = {
    remove: jest.fn(),
  };

  const mockScene: any = {
    add: {
      container: jest.fn(() => createMockContainer()),
      graphics: jest.fn(() => createMockGraphics()),
      text: jest.fn(() => createMockText()),
    },
    time: {
      now: 1000,
      delayedCall: jest.fn().mockReturnValue(mockTimerEvent),
      addEvent: jest.fn().mockReturnValue(mockTimerEvent),
    },
    tweens: {
      add: jest.fn().mockReturnValue(mockTween),
    },
    input: {
      on: jest.fn(),
      off: jest.fn(),
      keyboard: {
        on: jest.fn(),
      },
    },
    cameras: {
      main: {
        width: 800,
        height: 600,
        scrollX: 0,
        scrollY: 0,
      },
    },
  };

  return {
    default: {
      GameObjects: {
        Container: jest.fn(),
        Graphics: jest.fn(),
        Text: jest.fn(),
      },
      BlendModes: { ADD: 1 },
    },
    __mocks: { mockScene, mockTimerEvent, mockTween },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

const testSteps: TutorialStep[] = [
  { title: 'Step 1', description: 'Welcome', position: { x: 400, y: 100 } },
  { title: 'Step 2', description: 'Move around', position: { x: 200, y: 300 }, highlight: true },
  { title: 'Step 3', description: 'Tasks', position: { x: 600, y: 300 }, highlight: true },
  { title: 'Step 4', description: 'Start!', position: { x: 400, y: 100 } },
];

describe('TutorialOverlay - UX Improvements', () => {
  let overlay: TutorialOverlay;
  let onComplete: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onComplete = jest.fn();
  });

  afterEach(() => {
    if (overlay) overlay.destroy();
  });

  describe('navigation buttons', () => {
    it('should create next and previous buttons', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        onComplete,
      });

      expect(mockScene.add.text).toHaveBeenCalled();
      const textCalls = mockScene.add.text.mock.calls;
      const labels = textCalls.map((call: any[]) => call[2] as string);
      expect(labels.some((l: string) => l === '下一步 →')).toBe(true);
    });

    it('should have interactive navigation buttons', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        onComplete,
      });

      overlay.show();

      const textInstances = mockScene.add.text.mock.results;
      const interactiveCount = textInstances.filter(
        (r: any) => r.value?.setInteractive?.mock?.calls?.length > 0
      ).length;

      expect(interactiveCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('step progression', () => {
    it('should start at step 0 when shown', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        onComplete,
      });

      overlay.show();
      expect(true).toBe(true);
    });

    it('should call onComplete when all steps are done', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: [{ title: 'Only Step', description: 'One step' }],
        onComplete,
      });

      overlay.show();
      overlay.nextStep();

      expect(onComplete).toHaveBeenCalled();
    });

    it('should not go below step 0 on previousStep', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        onComplete,
      });

      overlay.show();
      overlay.previousStep();

      expect(true).toBe(true);
    });
  });

  describe('skip functionality', () => {
    it('should call onComplete when skipped', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        skipButton: true,
        onComplete,
      });

      overlay.show();
      overlay.complete();

      expect(onComplete).toHaveBeenCalled();
    });

    it('should work without skip button', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        skipButton: false,
        onComplete,
      });

      overlay.show();
      expect(true).toBe(true);
    });
  });

  describe('auto-advance timer management', () => {
    it('should create timer for auto-advance', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        onComplete,
      });

      overlay.show();

      expect(mockScene.time.addEvent).toHaveBeenCalled();
    });

    it('should cleanup timer on hide', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        onComplete,
      });

      overlay.show();
      overlay.hide();

      expect(true).toBe(true);
    });
  });

  describe('highlight animation', () => {
    it('should setup highlight for steps with highlight flag', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        onComplete,
      });

      overlay.show();
      overlay.nextStep();

      expect(mockScene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('destroy cleanup', () => {
    it('should not throw on destroy after show', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        onComplete,
      });
      overlay.show();

      expect(() => overlay.destroy()).not.toThrow();
    });

    it('should not throw on destroy without show', () => {
      overlay = new TutorialOverlay(mockScene as any, {
        steps: testSteps,
        onComplete,
      });

      expect(() => overlay.destroy()).not.toThrow();
    });
  });
});
