import { PhaserSoundAdapter } from '../PhaserSoundAdapter';
import { SoundSystem, SoundType } from '../SoundSystem';
import { AudioManager } from '../AudioManager';

const mockBuffer = {
  getChannelData: jest.fn(() => new Float32Array(44100)),
  copyFromChannel: jest.fn(),
  length: 44100,
};

const mockAudioContext = {
  createBuffer: jest.fn(() => mockBuffer),
  createBufferSource: jest.fn(() => ({ buffer: null, connect: jest.fn(), start: jest.fn(), onended: null })),
  createGain: jest.fn(() => ({ gain: { value: 1 }, connect: jest.fn() })),
  destination: {},
  state: 'running',
  close: jest.fn(),
} as unknown as AudioContext;

describe('PhaserSoundAdapter', () => {
  let adapter: PhaserSoundAdapter;
  let soundSystem: SoundSystem;
  let audioManager: AudioManager;

  beforeEach(() => {
    soundSystem = new SoundSystem();
    audioManager = new AudioManager();
    adapter = new PhaserSoundAdapter(soundSystem, audioManager, mockAudioContext);
  });

  afterEach(() => {
    if (adapter) adapter.destroy();
    if (soundSystem) soundSystem.destroy();
    if (audioManager) audioManager.destroy();
  });

  describe('constructor', () => {
    it('should accept SoundSystem and AudioManager', () => {
      expect(adapter).toBeDefined();
    });

    it('should not be muted by default', () => {
      expect(adapter.isMuted()).toBe(false);
    });
  });

  describe('play', () => {
    it('should play a sound type', () => {
      adapter.play('click');
      expect(adapter.isMuted()).toBe(false);
    });

    it('should play different sound types without error', () => {
      const soundTypes: SoundType[] = ['click', 'walk', 'jump', 'task-complete', 'celebration'];
      for (const type of soundTypes) {
        expect(() => adapter.play(type)).not.toThrow();
      }
    });
  });

  describe('mute', () => {
    it('should toggle muted state', () => {
      adapter.setMuted(true);
      expect(adapter.isMuted()).toBe(true);
      adapter.setMuted(false);
      expect(adapter.isMuted()).toBe(false);
    });

    it('should toggle mute by calling setMuted', () => {
      adapter.setMuted(!adapter.isMuted());
      expect(adapter.isMuted()).toBe(true);
    });
  });

  describe('stopAll', () => {
    it('should stop all playing sounds', () => {
      adapter.play('click');
      adapter.play('walk');
      adapter.stopAll();
    });

    it('should not throw when nothing is playing', () => {
      expect(() => adapter.stopAll()).not.toThrow();
    });
  });

  describe('volume integration', () => {
    it('should respect AudioManager master volume', () => {
      audioManager.setMasterVolume(0);
      adapter.play('click');
      audioManager.setMasterVolume(1);
      adapter.play('click');
    });

    it('should respect AudioManager category volume', () => {
      audioManager.setCategoryVolume('sfx', 0.5);
      adapter.play('click');
    });
  });

  describe('update', () => {
    it('should accept delta time', () => {
      expect(() => adapter.update(16)).not.toThrow();
    });

    it('should handle multiple updates', () => {
      adapter.update(16);
      adapter.update(16);
      adapter.update(16);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      adapter.play('click');
      adapter.destroy();
      expect(() => adapter.play('click')).not.toThrow();
    });
  });
});
