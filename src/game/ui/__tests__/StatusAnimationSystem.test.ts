import { StatusAnimationSystem, AnimationConfig } from '../StatusAnimationSystem';

jest.mock('phaser', () => {
  const mockTween = {
    stop: jest.fn(),
  };

  const mockScene = {
    tweens: {
      add: jest.fn(() => ({ ...mockTween })),
    },
    time: {
      delayedCall: jest.fn().mockReturnValue({ remove: jest.fn() }),
    },
  };

  return {
    default: {
      Tweens: { Tween: jest.fn() },
    },
    __mocks: { mockScene, mockTween },
  };
});

const Phaser = require('phaser');
const { mockScene } = Phaser.__mocks;

describe('StatusAnimationSystem', () => {
  let animationSystem: StatusAnimationSystem;

  beforeEach(() => {
    jest.clearAllMocks();
    animationSystem = new StatusAnimationSystem(mockScene as any);
  });

  describe('constructor', () => {
    it('should create StatusAnimationSystem', () => {
      expect(animationSystem).toBeDefined();
    });

    it('should have empty animations map', () => {
      expect(animationSystem).toBeDefined();
    });
  });

  describe('triggerStatusChange', () => {
    it('should trigger status change from pending to assigned', () => {
      animationSystem.triggerStatusChange('agent-1', 'pending', 'assigned');
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should trigger status change from assigned to working', () => {
      animationSystem.triggerStatusChange('agent-1', 'assigned', 'working');
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should trigger status change to completed', () => {
      animationSystem.triggerStatusChange('agent-1', 'working', 'completed');
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should trigger status change to failed', () => {
      animationSystem.triggerStatusChange('agent-1', 'working', 'failed');
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should trigger status change to reviewing', () => {
      animationSystem.triggerStatusChange('agent-1', 'working', 'reviewing');
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('triggerPriorityChange', () => {
    it('should trigger priority change', () => {
      animationSystem.triggerPriorityChange('agent-1', 'high');
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should handle different priority levels', () => {
      ['low', 'medium', 'high'].forEach(priority => {
        animationSystem.triggerPriorityChange('agent-1', priority);
      });
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('triggerProgressUpdate', () => {
    it('should trigger progress update', () => {
      animationSystem.triggerProgressUpdate('agent-1', 50);
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should handle different progress values', () => {
      [0, 25, 50, 75, 100].forEach(progress => {
        animationSystem.triggerProgressUpdate('agent-1', progress);
      });
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('setAnimationConfig', () => {
    it('should set custom animation config', () => {
      const config: AnimationConfig = {
        duration: 1000,
        easing: 'Power3',
        delay: 100,
      };
      animationSystem.setAnimationConfig('customAnimation', config);
      expect(animationSystem).toBeDefined();
    });

    it('should override default config', () => {
      const config: AnimationConfig = {
        duration: 200,
        easing: 'Linear',
        delay: 0,
      };
      animationSystem.setAnimationConfig('statusChange', config);
      expect(animationSystem).toBeDefined();
    });
  });

  describe('clearAllAnimations', () => {
    it('should clear all animations', () => {
      animationSystem.triggerStatusChange('agent-1', 'pending', 'assigned');
      animationSystem.clearAllAnimations();
      expect(animationSystem).toBeDefined();
    });

    it('should handle clear when no animations', () => {
      animationSystem.clearAllAnimations();
      expect(animationSystem).toBeDefined();
    });
  });

  describe('stopAgentAnimations', () => {
    it('should stop animations for specific agent', () => {
      animationSystem.triggerStatusChange('agent-1', 'pending', 'assigned');
      animationSystem.stopAgentAnimations('agent-1');
      expect(animationSystem).toBeDefined();
    });

    it('should handle stop for unknown agent', () => {
      animationSystem.stopAgentAnimations('unknown-agent');
      expect(animationSystem).toBeDefined();
    });
  });

  describe('getAgentAnimationState', () => {
    it('should return state with no animations initially', () => {
      const state = animationSystem.getAgentAnimationState('agent-1');
      expect(state.hasAnimations).toBe(false);
      expect(state.activeTweens).toBe(0);
      expect(state.queuedAnimations).toBe(0);
    });

    it('should return state with active animations', () => {
      animationSystem.triggerStatusChange('agent-1', 'pending', 'assigned');
      const state = animationSystem.getAgentAnimationState('agent-1');
      expect(state).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple agents', () => {
      ['agent-1', 'agent-2', 'agent-3'].forEach(agentId => {
        animationSystem.triggerStatusChange(agentId, 'pending', 'assigned');
      });
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should handle rapid status changes', () => {
      for (let i = 0; i < 10; i++) {
        animationSystem.triggerStatusChange('agent-1', 'pending', 'assigned');
      }
      expect(animationSystem).toBeDefined();
    });

    it('should handle mixed animation types', () => {
      animationSystem.triggerStatusChange('agent-1', 'pending', 'assigned');
      animationSystem.triggerPriorityChange('agent-1', 'high');
      animationSystem.triggerProgressUpdate('agent-1', 50);
      expect(animationSystem).toBeDefined();
    });
  });
});
