import { InteractiveTutorial, InteractiveStepType, TutorialStepConfig } from '../../ui/InteractiveTutorial';
import { OnboardingPhase } from '../../systems/OnboardingManager';

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
    fillGradientStyle: jest.fn(),
    fillTriangle: jest.fn(),
  });

  const createMockText = () => {
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
      setColor: jest.fn(),
      setAlpha: jest.fn(),
      setDepth: jest.fn(),
      setFontSize: jest.fn(),
      setStyle: jest.fn(),
      setWordWrapWidth: jest.fn(),
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
      getBounds: jest.fn(() => ({ x: 0, y: 0, width: 100, height: 50 })),
    };
    return c;
  };

  const createMockZone = () => ({
    setInteractive: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
    setAlpha: jest.fn(),
    setPosition: jest.fn(),
    setSize: jest.fn(),
  });

  const mockTween = { destroy: jest.fn(), stop: jest.fn() };
  const mockTimerEvent = { remove: jest.fn() };

  const mockScene: any = {
    add: {
      container: jest.fn(() => createMockContainer()),
      graphics: jest.fn(() => createMockGraphics()),
      text: jest.fn(() => createMockText()),
      zone: jest.fn(() => createMockZone()),
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
        off: jest.fn(),
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
    events: {
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
        Zone: jest.fn(),
      },
      BlendModes: { ADD: 1 },
    },
    __mocks: { mockScene, mockTimerEvent, mockTween },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

const sampleSteps: TutorialStepConfig[] = [
  {
    id: 'step-1',
    title: '欢迎',
    description: '欢迎来到虚拟办公室',
    phase: OnboardingPhase.WELCOME,
    type: InteractiveStepType.INFO,
    position: { x: 400, y: 100 },
  },
  {
    id: 'step-2',
    title: '移动角色',
    description: '点击屏幕移动角色',
    phase: OnboardingPhase.NAVIGATION,
    type: InteractiveStepType.INTERACTION,
    position: { x: 200, y: 300 },
    interactionType: 'click',
    targetArea: { x: 150, y: 250, width: 100, height: 100 },
  },
  {
    id: 'step-3',
    title: '查看任务',
    description: '点击角色查看任务',
    phase: OnboardingPhase.TASKS,
    type: InteractiveStepType.INTERACTION,
    position: { x: 600, y: 300 },
    interactionType: 'click',
    targetArea: { x: 550, y: 250, width: 100, height: 100 },
  },
  {
    id: 'step-4',
    title: '完成',
    description: '你已经学会了所有操作',
    phase: OnboardingPhase.COMPLETE,
    type: InteractiveStepType.INFO,
    position: { x: 400, y: 100 },
  },
];

describe('InteractiveTutorial', () => {
  let tutorial: InteractiveTutorial;
  let onComplete: jest.Mock;
  let onStepComplete: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onComplete = jest.fn();
    onStepComplete = jest.fn();
  });

  afterEach(() => {
    if (tutorial) tutorial.destroy();
  });

  describe('construction', () => {
    it('should create with steps and callbacks', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
        onStepComplete,
      });

      expect(tutorial).toBeDefined();
    });

    it('should report total step count', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      expect(tutorial.getTotalSteps()).toBe(sampleSteps.length);
    });

    it('should start at step index -1 (not started)', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      expect(tutorial.getCurrentStepIndex()).toBe(-1);
    });
  });

  describe('show/hide', () => {
    it('should show and set current step to 0', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();

      expect(tutorial.getCurrentStepIndex()).toBe(0);
    });

    it('should hide the tutorial', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      tutorial.hide();

      expect(tutorial.isVisible()).toBe(false);
    });

    it('should be visible after show', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      expect(tutorial.isVisible()).toBe(true);
    });
  });

  describe('step navigation', () => {
    it('should advance to next step', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
        onStepComplete,
      });

      tutorial.show();
      tutorial.nextStep();

      expect(tutorial.getCurrentStepIndex()).toBe(1);
      expect(onStepComplete).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'step-1' })
      );
    });

    it('should go to previous step', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      tutorial.nextStep();
      tutorial.previousStep();

      expect(tutorial.getCurrentStepIndex()).toBe(0);
    });

    it('should not go below step 0', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      tutorial.previousStep();

      expect(tutorial.getCurrentStepIndex()).toBe(0);
    });

    it('should call onComplete when finishing last step', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();

      for (let i = 0; i < sampleSteps.length; i++) {
        tutorial.nextStep();
      }

      expect(onComplete).toHaveBeenCalled();
    });

    it('should jump to specific step', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      tutorial.goToStep(2);

      expect(tutorial.getCurrentStepIndex()).toBe(2);
    });

    it('should not jump to out of bounds step', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      tutorial.goToStep(99);

      expect(tutorial.getCurrentStepIndex()).toBe(0);
    });
  });

  describe('interaction steps', () => {
    it('should require interaction for INTERACTION type steps', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      tutorial.nextStep();

      const currentStep = tutorial.getCurrentStep();
      expect(currentStep?.type).toBe(InteractiveStepType.INTERACTION);
    });

    it('should complete interaction step when target is triggered', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
        onStepComplete,
      });

      tutorial.show();
      tutorial.nextStep();

      tutorial.completeCurrentInteraction();

      expect(onStepComplete).toHaveBeenCalled();
    });

    it('should auto-advance INFO type steps via next button', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: [sampleSteps[0]],
        onComplete,
      });

      tutorial.show();
      expect(tutorial.getCurrentStep()?.type).toBe(InteractiveStepType.INFO);

      tutorial.nextStep();
      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe('progress indicator', () => {
    it('should report current progress as fraction', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      expect(tutorial.getProgress()).toBe('1 / 4');
    });

    it('should update progress on step change', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      tutorial.nextStep();
      expect(tutorial.getProgress()).toBe('2 / 4');
    });
  });

  describe('skip functionality', () => {
    it('should skip entire tutorial', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      tutorial.skip();

      expect(onComplete).toHaveBeenCalled();
      expect(tutorial.isVisible()).toBe(false);
    });
  });

  describe('destroy cleanup', () => {
    it('should not throw on destroy after show', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });
      tutorial.show();

      expect(() => tutorial.destroy()).not.toThrow();
    });

    it('should not throw on destroy without show', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      expect(() => tutorial.destroy()).not.toThrow();
    });
  });

  describe('highlight zones', () => {
    it('should create highlight zone for interaction steps', () => {
      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();
      tutorial.nextStep();

      expect(mockScene.add.zone).toHaveBeenCalled();
    });

    it('should not create zone for info steps', () => {
      const zoneCallsBefore = mockScene.add.zone.mock.calls.length;

      tutorial = new InteractiveTutorial(mockScene as any, {
        steps: sampleSteps,
        onComplete,
      });

      tutorial.show();

      expect(mockScene.add.zone.mock.calls.length).toBe(zoneCallsBefore);
    });
  });
});
