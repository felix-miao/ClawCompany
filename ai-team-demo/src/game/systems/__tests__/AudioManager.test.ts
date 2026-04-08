import { AudioManager, AudioCategory, AudioMixerConfig } from '../AudioManager';

describe('AudioManager', () => {
  let manager: AudioManager;

  beforeEach(() => {
    manager = new AudioManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('constructor and defaults', () => {
    it('should initialize with default master volume 0.7', () => {
      expect(manager.getMasterVolume()).toBe(0.7);
    });

    it('should accept custom config', () => {
      const custom = new AudioManager({ masterVolume: 0.5, maxConcurrentSounds: 16 });
      expect(custom.getMasterVolume()).toBe(0.5);
      expect(custom.getMaxConcurrentSounds()).toBe(16);
      custom.destroy();
    });

    it('should be active by default', () => {
      expect(manager.isActive()).toBe(true);
    });

    it('should have no active sounds initially', () => {
      expect(manager.getActiveSoundCount()).toBe(0);
    });

    it('should initialize all category volumes to master', () => {
      const categories: AudioCategory[] = ['sfx', 'music', 'ambient', 'voice', 'ui'];
      for (const cat of categories) {
        expect(manager.getCategoryVolume(cat)).toBe(0.7);
      }
    });

    it('should clamp master volume in config', () => {
      const m1 = new AudioManager({ masterVolume: -0.5 });
      expect(m1.getMasterVolume()).toBe(0);
      m1.destroy();
      const m2 = new AudioManager({ masterVolume: 1.5 });
      expect(m2.getMasterVolume()).toBe(1);
      m2.destroy();
    });
  });

  describe('master volume', () => {
    it('should set and get master volume', () => {
      manager.setMasterVolume(0.3);
      expect(manager.getMasterVolume()).toBe(0.3);
    });

    it('should clamp volume to 0-1', () => {
      manager.setMasterVolume(-0.1);
      expect(manager.getMasterVolume()).toBe(0);
      manager.setMasterVolume(1.5);
      expect(manager.getMasterVolume()).toBe(1);
    });

    it('should allow volume 0', () => {
      manager.setMasterVolume(0);
      expect(manager.getMasterVolume()).toBe(0);
    });

    it('should allow volume 1', () => {
      manager.setMasterVolume(1);
      expect(manager.getMasterVolume()).toBe(1);
    });
  });

  describe('category volume', () => {
    it('should set category volume independently', () => {
      manager.setCategoryVolume('sfx', 0.4);
      expect(manager.getCategoryVolume('sfx')).toBe(0.4);
    });

    it('should clamp category volume', () => {
      manager.setCategoryVolume('music', -1);
      expect(manager.getCategoryVolume('music')).toBe(0);
      manager.setCategoryVolume('music', 2);
      expect(manager.getCategoryVolume('music')).toBe(1);
    });

    it('should update category volume when master changes but not override set category', () => {
      manager.setCategoryVolume('sfx', 0.5);
      manager.setMasterVolume(0.3);
      expect(manager.getCategoryVolume('sfx')).toBe(0.5);
    });

    it('should reset category volume to master', () => {
      manager.setCategoryVolume('sfx', 0.5);
      manager.resetCategoryVolume('sfx');
      expect(manager.getCategoryVolume('sfx')).toBe(manager.getMasterVolume());
    });

    it('should reset all category volumes', () => {
      manager.setCategoryVolume('sfx', 0.5);
      manager.setCategoryVolume('music', 0.3);
      manager.resetAllCategoryVolumes();
      expect(manager.getCategoryVolume('sfx')).toBe(manager.getMasterVolume());
      expect(manager.getCategoryVolume('music')).toBe(manager.getMasterVolume());
    });
  });

  describe('effective volume calculation', () => {
    it('should compute effective volume as category * master', () => {
      manager.setMasterVolume(0.8);
      manager.setCategoryVolume('sfx', 0.5);
      expect(manager.getEffectiveVolume('sfx')).toBeCloseTo(0.4);
    });

    it('should use master volume when category is default', () => {
      manager.setMasterVolume(0.6);
      expect(manager.getEffectiveVolume('sfx')).toBeCloseTo(0.36);
    });

    it('should return 0 when master is 0', () => {
      manager.setMasterVolume(0);
      manager.setCategoryVolume('sfx', 0.8);
      expect(manager.getEffectiveVolume('sfx')).toBe(0);
    });
  });

  describe('fade', () => {
    it('should track fade state', () => {
      expect(manager.getFadeState()).toBe('none');
    });

    it('should start fade out', () => {
      manager.fadeOut(1000);
      expect(manager.getFadeState()).toBe('fading-out');
    });

    it('should start fade in', () => {
      manager.fadeIn(1000);
      expect(manager.getFadeState()).toBe('fading-in');
    });

    it('should complete fade out on update', () => {
      manager.fadeOut(500);
      manager.update(500);
      expect(manager.getFadeState()).toBe('faded-out');
      expect(manager.getMasterVolume()).toBe(0);
    });

    it('should complete fade in on update', () => {
      manager.setMasterVolume(0);
      manager.setTargetVolume(0.7);
      manager.fadeIn(500);
      manager.update(500);
      expect(manager.getFadeState()).toBe('faded-in');
      expect(manager.getMasterVolume()).toBe(0.7);
    });

    it('should interpolate volume during fade out', () => {
      manager.setMasterVolume(0.8);
      manager.fadeOut(1000);
      manager.update(500);
      expect(manager.getMasterVolume()).toBeCloseTo(0.4, 1);
    });

    it('should interpolate volume during fade in', () => {
      manager.setMasterVolume(0);
      manager.setTargetVolume(0.6);
      manager.fadeIn(1000);
      manager.update(500);
      expect(manager.getMasterVolume()).toBeCloseTo(0.3, 1);
    });

    it('should cancel current fade when starting new fade', () => {
      manager.fadeOut(1000);
      manager.update(200);
      manager.fadeIn(500);
      expect(manager.getFadeState()).toBe('fading-in');
    });
  });

  describe('suspend and resume', () => {
    it('should suspend audio', () => {
      manager.suspend();
      expect(manager.isActive()).toBe(false);
    });

    it('should resume audio', () => {
      manager.suspend();
      manager.resume();
      expect(manager.isActive()).toBe(true);
    });

    it('should clear active sounds on suspend', () => {
      manager.registerSound('snd_1', 'sfx');
      manager.suspend();
      expect(manager.getActiveSoundCount()).toBe(0);
    });
  });

  describe('sound registration', () => {
    it('should register and track sounds', () => {
      manager.registerSound('snd_1', 'sfx');
      expect(manager.getActiveSoundCount()).toBe(1);
    });

    it('should unregister sounds', () => {
      manager.registerSound('snd_1', 'sfx');
      manager.unregisterSound('snd_1');
      expect(manager.getActiveSoundCount()).toBe(0);
    });

    it('should enforce max concurrent sounds', () => {
      const limited = new AudioManager({ maxConcurrentSounds: 2 });
      expect(limited.registerSound('snd_1', 'sfx')).toBe(true);
      expect(limited.registerSound('snd_2', 'sfx')).toBe(true);
      expect(limited.registerSound('snd_3', 'sfx')).toBe(false);
      limited.destroy();
    });

    it('should return active sound info', () => {
      manager.registerSound('snd_1', 'sfx');
      manager.registerSound('snd_2', 'music');
      const active = manager.getActiveSounds();
      expect(active).toHaveLength(2);
      expect(active[0].id).toBe('snd_1');
      expect(active[0].category).toBe('sfx');
    });

    it('should stop all sounds', () => {
      manager.registerSound('snd_1', 'sfx');
      manager.registerSound('snd_2', 'music');
      manager.stopAll();
      expect(manager.getActiveSoundCount()).toBe(0);
    });
  });

  describe('update', () => {
    it('should process fade during update', () => {
      manager.fadeOut(1000);
      manager.update(250);
      expect(manager.getMasterVolume()).toBeCloseTo(0.7 * 0.75, 1);
    });

    it('should not modify volume when no fade active', () => {
      manager.setMasterVolume(0.5);
      manager.update(100);
      expect(manager.getMasterVolume()).toBe(0.5);
    });
  });

  describe('destroy', () => {
    it('should deactivate on destroy', () => {
      manager.destroy();
      expect(manager.isActive()).toBe(false);
    });

    it('should clear all sounds on destroy', () => {
      manager.registerSound('snd_1', 'sfx');
      manager.registerSound('snd_2', 'music');
      manager.destroy();
      expect(manager.getActiveSoundCount()).toBe(0);
    });
  });
});
