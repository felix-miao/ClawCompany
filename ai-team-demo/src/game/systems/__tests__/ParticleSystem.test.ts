import {
  ParticleSystem,
  ParticleEffectType,
  ParticleEffectConfig,
  ParticlePreset,
} from '../ParticleSystem';

describe('ParticleSystem', () => {
  let particleSystem: ParticleSystem;

  beforeEach(() => {
    particleSystem = new ParticleSystem();
  });

  describe('constructor', () => {
    it('should initialize with no active effects', () => {
      expect(particleSystem.getActiveEffectCount()).toBe(0);
    });

    it('should have all preset effect types registered', () => {
      const presets = particleSystem.getAvailablePresets();
      expect(presets).toContain('celebration');
      expect(presets).toContain('error');
      expect(presets).toContain('task-complete');
      expect(presets).toContain('work-start');
      expect(presets).toContain('sparkle');
    });
  });

  describe('getEffectConfig', () => {
    it('should return config for celebration effect', () => {
      const config = particleSystem.getEffectConfig('celebration');
      expect(config).toBeDefined();
      expect(config.lifespan).toBeGreaterThan(0);
      expect(config.quantity).toBeGreaterThan(0);
      expect(config.tints.length).toBeGreaterThan(0);
    });

    it('should return config for error effect', () => {
      const config = particleSystem.getEffectConfig('error');
      expect(config).toBeDefined();
      expect(config.lifespan).toBeGreaterThan(0);
      expect(config.tints).toEqual(expect.arrayContaining([expect.any(Number)]));
    });

    it('should return config for task-complete effect', () => {
      const config = particleSystem.getEffectConfig('task-complete');
      expect(config).toBeDefined();
      expect(config.lifespan).toBeGreaterThan(0);
    });

    it('should return config for work-start effect', () => {
      const config = particleSystem.getEffectConfig('work-start');
      expect(config).toBeDefined();
      expect(config.lifespan).toBeGreaterThan(0);
    });

    it('should return config for sparkle effect', () => {
      const config = particleSystem.getEffectConfig('sparkle');
      expect(config).toBeDefined();
    });

    it('should return null for unknown effect type', () => {
      const config = particleSystem.getEffectConfig('unknown' as ParticleEffectType);
      expect(config).toBeNull();
    });
  });

  describe('celebration config', () => {
    it('should have upward gravity for confetti feel', () => {
      const config = particleSystem.getEffectConfig('celebration')!;
      expect(config.gravityY).toBeLessThan(0);
    });

    it('should have multi-color tints', () => {
      const config = particleSystem.getEffectConfig('celebration')!;
      expect(config.tints.length).toBeGreaterThanOrEqual(3);
    });

    it('should have high quantity for burst feel', () => {
      const config = particleSystem.getEffectConfig('celebration')!;
      expect(config.quantity).toBeGreaterThanOrEqual(20);
    });

    it('should have wide spread angle', () => {
      const config = particleSystem.getEffectConfig('celebration')!;
      expect(config.speed.min).toBeGreaterThan(0);
      expect(config.speed.max).toBeGreaterThanOrEqual(config.speed.min);
    });
  });

  describe('error config', () => {
    it('should have red/orange tints', () => {
      const config = particleSystem.getEffectConfig('error')!;
      const hasRedOrOrange = config.tints.some(
        (t) => (t & 0xff0000) >> 16 > 200
      );
      expect(hasRedOrOrange).toBe(true);
    });

    it('should have short lifespan for quick burst', () => {
      const config = particleSystem.getEffectConfig('error')!;
      expect(config.lifespan).toBeLessThanOrEqual(800);
    });
  });

  describe('task-complete config', () => {
    it('should have green/gold tints', () => {
      const config = particleSystem.getEffectConfig('task-complete')!;
      const hasGreenOrGold = config.tints.some((t) => {
        const g = (t & 0x00ff00) >> 8;
        return g > 150;
      });
      expect(hasGreenOrGold).toBe(true);
    });

    it('should have gentle gravity', () => {
      const config = particleSystem.getEffectConfig('task-complete')!;
      expect(config.gravityY).toBeLessThanOrEqual(100);
    });
  });

  describe('getEffectForEvent', () => {
    it('should return celebration for successful task completion', () => {
      const effect = particleSystem.getEffectForEvent('agent:task-completed', {
        result: 'success',
      });
      expect(effect).toBe('celebration');
    });

    it('should return error for failed task completion', () => {
      const effect = particleSystem.getEffectForEvent('agent:task-completed', {
        result: 'failure',
      });
      expect(effect).toBe('error');
    });

    it('should return sparkle for partial task completion', () => {
      const effect = particleSystem.getEffectForEvent('agent:task-completed', {
        result: 'partial',
      });
      expect(effect).toBe('sparkle');
    });

    it('should return work-start for status change to busy', () => {
      const effect = particleSystem.getEffectForEvent('agent:status-change', {
        status: 'busy',
      });
      expect(effect).toBe('work-start');
    });

    it('should return null for status change to idle', () => {
      const effect = particleSystem.getEffectForEvent('agent:status-change', {
        status: 'idle',
      });
      expect(effect).toBeNull();
    });

    it('should return celebration for completed session', () => {
      const effect = particleSystem.getEffectForEvent('session:completed', {
        status: 'completed',
      });
      expect(effect).toBe('celebration');
    });

    it('should return error for failed session', () => {
      const effect = particleSystem.getEffectForEvent('session:completed', {
        status: 'failed',
      });
      expect(effect).toBe('error');
    });

    it('should return null for unknown event type', () => {
      const effect = particleSystem.getEffectForEvent('connection:open', {});
      expect(effect).toBeNull();
    });

    it('should return celebration for task-assigned with celebration emotion', () => {
      const effect = particleSystem.getEffectForEvent('agent:task-assigned', {
        description: 'All tests passed successfully',
      });
      expect(effect).toBe('celebration');
    });

    it('should return sparkle for celebrating emotion change', () => {
      const effect = particleSystem.getEffectForEvent('agent:emotion-change', {
        emotion: 'celebrating',
      });
      expect(effect).toBe('celebration');
    });

    it('should return null for neutral emotion change', () => {
      const effect = particleSystem.getEffectForEvent('agent:emotion-change', {
        emotion: 'thinking',
      });
      expect(effect).toBeNull();
    });
  });

  describe('active effects tracking', () => {
    it('should track when an effect is triggered', () => {
      particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should track effect details', () => {
      particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      const active = particleSystem.getActiveEffects();
      expect(active).toHaveLength(1);
      expect(active[0].type).toBe('celebration');
      expect(active[0].agentId).toBe('dev1');
      expect(active[0].x).toBe(100);
      expect(active[0].y).toBe(200);
    });

    it('should track multiple effects', () => {
      particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      particleSystem.triggerEffect('error', 'dev2', 300, 400);
      expect(particleSystem.getActiveEffectCount()).toBe(2);
    });

    it('should expire effects after their lifespan', () => {
      const config = particleSystem.getEffectConfig('error')!;
      particleSystem.triggerEffect('error', 'dev1', 100, 200);

      particleSystem.update(config.lifespan + 100);
      expect(particleSystem.getActiveEffectCount()).toBe(0);
    });

    it('should not expire effects before their lifespan', () => {
      particleSystem.triggerEffect('celebration', 'dev1', 100, 200);

      particleSystem.update(10);
      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should handle multiple effects with different lifespans', () => {
      particleSystem.triggerEffect('error', 'dev1', 100, 200);
      particleSystem.triggerEffect('celebration', 'dev2', 300, 400);

      const errorConfig = particleSystem.getEffectConfig('error')!;
      particleSystem.update(errorConfig.lifespan + 100);

      expect(particleSystem.getActiveEffectCount()).toBe(1);
      expect(particleSystem.getActiveEffects()[0].type).toBe('celebration');
    });
  });

  describe('clearAllEffects', () => {
    it('should clear all active effects', () => {
      particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      particleSystem.triggerEffect('error', 'dev2', 300, 400);
      particleSystem.clearAllEffects();
      expect(particleSystem.getActiveEffectCount()).toBe(0);
    });
  });

  describe('clearEffect', () => {
    it('should clear a specific effect by id', () => {
      particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      particleSystem.triggerEffect('error', 'dev2', 300, 400);

      const effects = particleSystem.getActiveEffects();
      particleSystem.clearEffect(effects[0].id);

      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });
  });

  describe('registerCustomEffect', () => {
    it('should allow registering custom effect configs', () => {
      const customConfig: ParticleEffectConfig = {
        speed: { min: 50, max: 100 },
        scale: { start: 1, end: 0 },
        lifespan: 500,
        gravityY: -50,
        alpha: { start: 1, end: 0 },
        tints: [0xff00ff],
        quantity: 5,
        emitting: false,
        blendMode: 'ADD',
      };

      particleSystem.registerCustomEffect('custom-test', customConfig);
      const retrieved = particleSystem.getEffectConfig('custom-test');
      expect(retrieved).toEqual(customConfig);
    });

    it('should list custom presets alongside built-in ones', () => {
      particleSystem.registerCustomEffect('my-effect', {
        speed: { min: 10, max: 20 },
        scale: { start: 1, end: 0 },
        lifespan: 300,
        gravityY: 0,
        alpha: { start: 1, end: 0 },
        tints: [0xffffff],
        quantity: 3,
        emitting: false,
        blendMode: 'NORMAL',
      });

      const presets = particleSystem.getAvailablePresets();
      expect(presets).toContain('my-effect');
    });
  });

  describe('effect history', () => {
    it('should track triggered effects in history', () => {
      particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      particleSystem.triggerEffect('error', 'dev2', 300, 400);

      const history = particleSystem.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('celebration');
      expect(history[1].type).toBe('error');
    });

    it('should include timestamps in history', () => {
      particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      const history = particleSystem.getHistory();
      expect(history[0].timestamp).toBeGreaterThan(0);
    });

    it('should limit history to 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        particleSystem.triggerEffect('sparkle', `agent-${i}`, i * 10, i * 20);
      }
      const history = particleSystem.getHistory();
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should persist history even after effects expire', () => {
      particleSystem.triggerEffect('error', 'dev1', 100, 200);
      const config = particleSystem.getEffectConfig('error')!;
      particleSystem.update(config.lifespan + 100);

      expect(particleSystem.getActiveEffectCount()).toBe(0);
      expect(particleSystem.getHistory()).toHaveLength(1);
    });
  });

  describe('triggerEffect', () => {
    it('should return effect id on successful trigger', () => {
      const result = particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.config).toBeDefined();
      expect(result.config.tints.length).toBeGreaterThan(0);
    });

    it('should return null for unknown effect type', () => {
      const result = particleSystem.triggerEffect('unknown' as ParticleEffectType, 'dev1', 100, 200);
      expect(result).toBeNull();
    });

    it('should generate unique ids for each effect', () => {
      const r1 = particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      const r2 = particleSystem.triggerEffect('celebration', 'dev1', 100, 200);
      expect(r1!.id).not.toBe(r2!.id);
    });
  });

  describe('getEffectForEvent with agent position', () => {
    it('should provide position data for triggering effects', () => {
      const result = particleSystem.getEffectForEvent('agent:task-completed', {
        result: 'success',
        agentId: 'dev1',
      });
      expect(result).toBe('celebration');
    });
  });
});
