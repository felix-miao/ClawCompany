import { OnboardingManager, OnboardingPhase, OnboardingStepResult } from '../OnboardingManager';

const STORAGE_KEY = 'virtual-office-onboarding';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('OnboardingManager', () => {
  let manager: OnboardingManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    manager = new OnboardingManager();
  });

  describe('initial state', () => {
    it('should start with no phases completed', () => {
      expect(manager.isFirstTime()).toBe(true);
    });

    it('should have all phases in pending state', () => {
      const progress = manager.getProgress();
      expect(progress.completedPhases).toEqual([]);
      expect(progress.currentPhase).toBe(OnboardingPhase.WELCOME);
    });

    it('should report 0% progress initially', () => {
      expect(manager.getProgressPercentage()).toBe(0);
    });
  });

  describe('phase management', () => {
    it('should advance through phases sequentially', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      expect(manager.getCurrentPhase()).toBe(OnboardingPhase.WELCOME);

      manager.completePhase(OnboardingPhase.WELCOME);
      expect(manager.getCurrentPhase()).toBe(OnboardingPhase.NAVIGATION);
    });

    it('should not skip phases', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      expect(() => manager.completePhase(OnboardingPhase.TASKS)).toThrow();
    });

    it('should track completed phases', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      const progress = manager.getProgress();
      expect(progress.completedPhases).toContain(OnboardingPhase.WELCOME);
    });

    it('should calculate progress percentage correctly', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      const totalPhases = Object.keys(OnboardingPhase).length;
      const expected = Math.round((1 / totalPhases) * 100);
      expect(manager.getProgressPercentage()).toBe(expected);
    });
  });

  describe('step tracking', () => {
    it('should track step results within a phase', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      const result: OnboardingStepResult = {
        stepId: 'welcome-1',
        phase: OnboardingPhase.WELCOME,
        completed: true,
        timestamp: Date.now(),
      };

      manager.recordStepResult(result);

      const steps = manager.getStepResults(OnboardingPhase.WELCOME);
      expect(steps).toHaveLength(1);
      expect(steps[0].stepId).toBe('welcome-1');
    });

    it('should check if a step is completed', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      manager.recordStepResult({
        stepId: 'welcome-1',
        phase: OnboardingPhase.WELCOME,
        completed: true,
        timestamp: Date.now(),
      });

      expect(manager.isStepCompleted('welcome-1')).toBe(true);
      expect(manager.isStepCompleted('welcome-2')).toBe(false);
    });

    it('should determine if a phase is ready to complete', () => {
      manager.startPhase(OnboardingPhase.NAVIGATION);

      manager.recordStepResult({
        stepId: 'nav-move',
        phase: OnboardingPhase.NAVIGATION,
        completed: true,
        timestamp: Date.now(),
      });

      expect(manager.isPhaseReadyToComplete(OnboardingPhase.NAVIGATION)).toBe(true);
    });
  });

  describe('persistence', () => {
    it('should save progress to localStorage', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.any(String)
      );
    });

    it('should restore progress from localStorage', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      const savedData = mockLocalStorage.setItem.mock.calls[0][1];
      mockLocalStorage.getItem.mockReturnValueOnce(savedData);

      const restored = new OnboardingManager();
      expect(restored.isFirstTime()).toBe(false);
      expect(restored.getProgress().completedPhases).toContain(OnboardingPhase.WELCOME);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('{invalid json');
      const restored = new OnboardingManager();
      expect(restored.isFirstTime()).toBe(true);
    });

    it('should reset progress', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      manager.reset();

      expect(manager.isFirstTime()).toBe(true);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe('achievements', () => {
    it('should unlock achievement when phase completes', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      const achievements = manager.getAchievements();
      expect(achievements).toContainEqual(
        expect.objectContaining({ phase: OnboardingPhase.WELCOME })
      );
    });

    it('should not duplicate achievements', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      const achievements = manager.getAchievements();
      const welcomeAchievements = achievements.filter(
        a => a.phase === OnboardingPhase.WELCOME
      );
      expect(welcomeAchievements).toHaveLength(1);
    });

    it('should generate achievement with title and icon', () => {
      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      const achievement = manager.getAchievements()[0];
      expect(achievement.title).toBeTruthy();
      expect(achievement.icon).toBeTruthy();
    });
  });

  describe('event integration', () => {
    it('should emit phase complete event', () => {
      const listener = jest.fn();
      manager.on('phase:complete', listener);

      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ phase: OnboardingPhase.WELCOME })
      );
    });

    it('should emit onboarding complete event when all phases done', () => {
      const listener = jest.fn();
      manager.on('onboarding:complete', listener);

      const phases = Object.values(OnboardingPhase);
      phases.forEach(phase => {
        manager.startPhase(phase);
        manager.completePhase(phase);
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should emit step complete event', () => {
      const listener = jest.fn();
      manager.on('step:complete', listener);

      manager.startPhase(OnboardingPhase.WELCOME);
      manager.recordStepResult({
        stepId: 'welcome-1',
        phase: OnboardingPhase.WELCOME,
        completed: true,
        timestamp: Date.now(),
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ stepId: 'welcome-1' })
      );
    });

    it('should emit achievement unlock event', () => {
      const listener = jest.fn();
      manager.on('achievement:unlock', listener);

      manager.startPhase(OnboardingPhase.WELCOME);
      manager.completePhase(OnboardingPhase.WELCOME);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ phase: OnboardingPhase.WELCOME })
      );
    });
  });

  describe('isCompleted', () => {
    it('should return false when not all phases completed', () => {
      expect(manager.isCompleted()).toBe(false);
    });

    it('should return true when all phases completed', () => {
      const phases = Object.values(OnboardingPhase);
      phases.forEach(phase => {
        manager.startPhase(phase);
        manager.completePhase(phase);
      });

      expect(manager.isCompleted()).toBe(true);
    });
  });

  describe('getNextStep', () => {
    it('should return the first step of current phase', () => {
      const step = manager.getNextStep();
      expect(step).toBeTruthy();
      expect(step?.phase).toBe(OnboardingPhase.WELCOME);
    });

    it('should return null when onboarding is complete', () => {
      const phases = Object.values(OnboardingPhase);
      phases.forEach(phase => {
        manager.startPhase(phase);
        manager.completePhase(phase);
      });

      expect(manager.getNextStep()).toBeNull();
    });
  });

  describe('getPhaseSteps', () => {
    it('should return steps for a given phase', () => {
      const steps = manager.getPhaseSteps(OnboardingPhase.WELCOME);
      expect(steps.length).toBeGreaterThan(0);
      steps.forEach(step => {
        expect(step.phase).toBe(OnboardingPhase.WELCOME);
      });
    });

    it('should return steps with required properties', () => {
      const steps = manager.getPhaseSteps(OnboardingPhase.NAVIGATION);
      steps.forEach(step => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.description).toBeTruthy();
        expect(step.type).toBeTruthy();
      });
    });
  });
});
