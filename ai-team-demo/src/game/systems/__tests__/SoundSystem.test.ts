import { SoundSystem, SoundType } from '../SoundSystem';

describe('SoundSystem', () => {
  let soundSystem: SoundSystem;

  beforeEach(() => {
    soundSystem = new SoundSystem();
  });

  describe('constructor', () => {
    it('should initialize with no sounds playing', () => {
      expect(soundSystem.getPlayingCount()).toBe(0);
    });

    it('should initialize with default volume', () => {
      expect(soundSystem.getMasterVolume()).toBe(0.7);
    });

    it('should be enabled by default', () => {
      expect(soundSystem.isEnabled()).toBe(true);
    });

    it('should have all sound types registered', () => {
      const types = soundSystem.getAvailableSoundTypes();
      expect(types).toContain('walk');
      expect(types).toContain('jump');
      expect(types).toContain('land');
      expect(types).toContain('work-start');
      expect(types).toContain('work-end');
      expect(types).toContain('task-complete');
      expect(types).toContain('task-assigned');
      expect(types).toContain('error');
      expect(types).toContain('celebration');
      expect(types).toContain('click');
      expect(types).toContain('tab-switch');
      expect(types).toContain('ambient');
    });
  });

  describe('master volume', () => {
    it('should set master volume', () => {
      soundSystem.setMasterVolume(0.5);
      expect(soundSystem.getMasterVolume()).toBe(0.5);
    });

    it('should clamp volume to 0-1 range', () => {
      soundSystem.setMasterVolume(-1);
      expect(soundSystem.getMasterVolume()).toBe(0);
      soundSystem.setMasterVolume(2);
      expect(soundSystem.getMasterVolume()).toBe(1);
    });
  });

  describe('enable/disable', () => {
    it('should disable sound', () => {
      soundSystem.setEnabled(false);
      expect(soundSystem.isEnabled()).toBe(false);
    });

    it('should stop all sounds when disabled', () => {
      soundSystem.play('click');
      soundSystem.setEnabled(false);
      expect(soundSystem.getPlayingCount()).toBe(0);
    });

    it('should re-enable sound', () => {
      soundSystem.setEnabled(false);
      soundSystem.setEnabled(true);
      expect(soundSystem.isEnabled()).toBe(true);
    });
  });

  describe('play', () => {
    it('should return a sound instance id on play', () => {
      const id = soundSystem.play('click');
      expect(id).toBeTruthy();
    });

    it('should track playing sounds', () => {
      soundSystem.play('click');
      expect(soundSystem.getPlayingCount()).toBe(1);
    });

    it('should track multiple playing sounds', () => {
      soundSystem.play('click');
      soundSystem.play('jump');
      soundSystem.play('celebration');
      expect(soundSystem.getPlayingCount()).toBe(3);
    });

    it('should not play when disabled', () => {
      soundSystem.setEnabled(false);
      const id = soundSystem.play('click');
      expect(id).toBeNull();
      expect(soundSystem.getPlayingCount()).toBe(0);
    });

    it('should return null for unknown sound type', () => {
      const id = soundSystem.play('unknown' as SoundType);
      expect(id).toBeNull();
    });

    it('should play with custom volume', () => {
      const id = soundSystem.play('click', { volume: 0.3 });
      expect(id).toBeTruthy();
    });
  });

  describe('stop', () => {
    it('should stop a specific sound by id', () => {
      const id = soundSystem.play('click');
      soundSystem.stop(id!);
      expect(soundSystem.getPlayingCount()).toBe(0);
    });

    it('should handle stopping non-existent id gracefully', () => {
      expect(() => soundSystem.stop('non-existent')).not.toThrow();
    });
  });

  describe('stopAll', () => {
    it('should stop all playing sounds', () => {
      soundSystem.play('click');
      soundSystem.play('jump');
      soundSystem.play('celebration');
      soundSystem.stopAll();
      expect(soundSystem.getPlayingCount()).toBe(0);
    });
  });

  describe('stopByType', () => {
    it('should stop all sounds of a given type', () => {
      soundSystem.play('click');
      soundSystem.play('click');
      soundSystem.play('jump');
      soundSystem.stopByType('click');
      expect(soundSystem.getPlayingCount()).toBe(1);
    });
  });

  describe('sound config', () => {
    it('should return config for each sound type', () => {
      const types = soundSystem.getAvailableSoundTypes();
      for (const type of types) {
        const config = soundSystem.getSoundConfig(type as SoundType);
        expect(config).toBeDefined();
        expect(config.duration).toBeGreaterThan(0);
      }
    });

    it('should return null for unknown type config', () => {
      const config = soundSystem.getSoundConfig('unknown' as SoundType);
      expect(config).toBeNull();
    });
  });

  describe('ambient sound', () => {
    it('should start ambient loop', () => {
      soundSystem.startAmbient();
      expect(soundSystem.isAmbientPlaying()).toBe(true);
    });

    it('should stop ambient loop', () => {
      soundSystem.startAmbient();
      soundSystem.stopAmbient();
      expect(soundSystem.isAmbientPlaying()).toBe(false);
    });

    it('should not start ambient when disabled', () => {
      soundSystem.setEnabled(false);
      soundSystem.startAmbient();
      expect(soundSystem.isAmbientPlaying()).toBe(false);
    });

    it('should track ambient as playing', () => {
      soundSystem.startAmbient();
      expect(soundSystem.getPlayingCount()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('sound cooldown', () => {
    it('should respect cooldown for walk sounds', () => {
      soundSystem.play('walk');
      const id2 = soundSystem.play('walk');
      expect(id2).toBeNull();
    });

    it('should allow sound after cooldown expires', () => {
      soundSystem.play('walk');
      const config = soundSystem.getSoundConfig('walk')!;
      soundSystem.update(config.cooldown + 10);
      const id2 = soundSystem.play('walk');
      expect(id2).toBeTruthy();
    });

    it('should not apply cooldown to different sound types', () => {
      soundSystem.play('walk');
      const id2 = soundSystem.play('jump');
      expect(id2).toBeTruthy();
    });
  });

  describe('update', () => {
    it('should expire finished sounds', () => {
      soundSystem.play('click');
      const config = soundSystem.getSoundConfig('click')!;
      soundSystem.update(config.duration + 100);
      expect(soundSystem.getPlayingCount()).toBe(0);
    });

    it('should not expire sounds before their duration', () => {
      soundSystem.play('celebration');
      soundSystem.update(10);
      expect(soundSystem.getPlayingCount()).toBe(1);
    });
  });

  describe('getPlayingSounds', () => {
    it('should return details of playing sounds', () => {
      soundSystem.play('click');
      soundSystem.play('jump');
      const playing = soundSystem.getPlayingSounds();
      expect(playing).toHaveLength(2);
      expect(playing[0].type).toBeDefined();
      expect(playing[0].id).toBeTruthy();
      expect(playing[0].remainingMs).toBeGreaterThan(0);
    });
  });

  describe('procedural audio generation', () => {
    it('should generate audio buffer for click sound', () => {
      const buffer = soundSystem.generateAudioBuffer('click');
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should generate audio buffer for jump sound', () => {
      const buffer = soundSystem.generateAudioBuffer('jump');
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should generate different buffers for different types', () => {
      const clickBuf = soundSystem.generateAudioBuffer('click');
      const jumpBuf = soundSystem.generateAudioBuffer('jump');
      expect(clickBuf).not.toEqual(jumpBuf);
    });

    it('should return empty buffer for unknown type', () => {
      const buffer = soundSystem.generateAudioBuffer('unknown' as SoundType);
      expect(buffer).toEqual(new Float32Array(0));
    });
  });

  describe('sound categories', () => {
    it('should categorize sounds correctly', () => {
      expect(soundSystem.getSoundCategory('walk')).toBe('movement');
      expect(soundSystem.getSoundCategory('jump')).toBe('movement');
      expect(soundSystem.getSoundCategory('land')).toBe('movement');
      expect(soundSystem.getSoundCategory('work-start')).toBe('work');
      expect(soundSystem.getSoundCategory('work-end')).toBe('work');
      expect(soundSystem.getSoundCategory('task-complete')).toBe('event');
      expect(soundSystem.getSoundCategory('task-assigned')).toBe('event');
      expect(soundSystem.getSoundCategory('error')).toBe('event');
      expect(soundSystem.getSoundCategory('celebration')).toBe('event');
      expect(soundSystem.getSoundCategory('click')).toBe('ui');
      expect(soundSystem.getSoundCategory('tab-switch')).toBe('ui');
      expect(soundSystem.getSoundCategory('ambient')).toBe('ambient');
    });
  });

  describe('category volume', () => {
    it('should set volume per category', () => {
      soundSystem.setCategoryVolume('movement', 0.5);
      expect(soundSystem.getCategoryVolume('movement')).toBe(0.5);
    });

    it('should clamp category volume', () => {
      soundSystem.setCategoryVolume('movement', -1);
      expect(soundSystem.getCategoryVolume('movement')).toBe(0);
      soundSystem.setCategoryVolume('movement', 2);
      expect(soundSystem.getCategoryVolume('movement')).toBe(1);
    });

    it('should default category volume to master volume', () => {
      const vol = soundSystem.getCategoryVolume('movement');
      expect(vol).toBe(soundSystem.getMasterVolume());
    });
  });

  describe('destroy', () => {
    it('should clean up all sounds on destroy', () => {
      soundSystem.play('click');
      soundSystem.play('jump');
      soundSystem.startAmbient();
      soundSystem.destroy();
      expect(soundSystem.getPlayingCount()).toBe(0);
      expect(soundSystem.isAmbientPlaying()).toBe(false);
    });
  });
});
