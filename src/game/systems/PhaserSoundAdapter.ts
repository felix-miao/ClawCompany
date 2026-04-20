import { SoundSystem, SoundType, SoundCategory } from './SoundSystem';
import { AudioManager, AudioCategory } from './AudioManager';

export class PhaserSoundAdapter {
  private soundSystem: SoundSystem;
  private audioManager: AudioManager;
  private context: AudioContext | null = null;
  private muted: boolean = false;
  private destroyed: boolean = false;
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  private idCounter: number = 0;

  constructor(soundSystem: SoundSystem, audioManager: AudioManager, audioContext?: AudioContext) {
    this.soundSystem = soundSystem;
    this.audioManager = audioManager;
    this.context = audioContext ?? (typeof AudioContext !== 'undefined' ? new AudioContext() : null);
  }

  private mapCategoryToAudio(soundType: SoundType): AudioCategory {
    const category = this.soundSystem.getSoundCategory(soundType);
    const mapping: Record<SoundCategory, AudioCategory> = {
      movement: 'sfx',
      work: 'sfx',
      event: 'sfx',
      ui: 'ui',
      ambient: 'ambient',
    };
    return mapping[category] ?? 'sfx';
  }

  play(soundType: SoundType, options?: { volume?: number }): void {
    if (this.destroyed || this.muted) return;

    const id = ++this.idCounter + '_' + Date.now();
    this.playBuffer(id, soundType, options?.volume);
  }

  private playBuffer(id: string, soundType: SoundType, volume?: number): void {
    if (!this.context) return;

    const audioBufferData = this.soundSystem.generateAudioBuffer(soundType);
    if (audioBufferData.length === 0) return;

    const buffer = this.context.createBuffer(1, audioBufferData.length, 44100);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < audioBufferData.length; i++) {
      channelData[i] = audioBufferData[i];
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.context.createGain();
    const config = this.soundSystem.getSoundConfig(soundType);
    const effectiveVolume = (volume ?? config?.volume ?? 1) * this.audioManager.getEffectiveVolume(this.mapCategoryToAudio(soundType));
    gainNode.gain.value = effectiveVolume;

    source.connect(gainNode);
    gainNode.connect(this.context.destination);

    source.start();

    this.activeSources.set(id, source);

    source.onended = () => {
      this.activeSources.delete(id);
    };
  }

  stopAll(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch { /* intentionally empty */ }
    });
    this.activeSources.clear();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopAll();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  update(deltaMs: number): void {
    this.audioManager.update(deltaMs);
  }

  destroy(): void {
    this.destroyed = true;
    this.stopAll();
    if (this.context && this.context.state !== 'closed') {
      this.context.close();
    }
    this.context = null;
  }
}