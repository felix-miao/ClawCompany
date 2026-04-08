export type AudioCategory = 'sfx' | 'music' | 'ambient' | 'voice' | 'ui';

export type FadeState = 'none' | 'fading-in' | 'fading-out' | 'faded-in' | 'faded-out';

export interface ActiveSoundInfo {
  id: string;
  category: AudioCategory;
}

export interface AudioMixerConfig {
  masterVolume: number;
  maxConcurrentSounds: number;
  fadeDurationMs: number;
}

const DEFAULT_CONFIG: AudioMixerConfig = {
  masterVolume: 0.7,
  maxConcurrentSounds: 32,
  fadeDurationMs: 500,
};

export class AudioManager {
  private config: AudioMixerConfig;
  private masterVolume: number;
  private categoryVolumes: Map<AudioCategory, number> = new Map();
  private categoryHasOverride: Set<AudioCategory> = new Set();
  private activeSounds: Map<string, AudioCategory> = new Map();
  private fadeState: FadeState = 'none';
  private fadeProgress: number = 0;
  private fadeDurationMs: number = 0;
  private volumeBeforeFade: number = 0;
  private targetVolume: number;
  private active: boolean = true;
  private destroyed: boolean = false;

  constructor(config?: Partial<AudioMixerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.masterVolume = Math.max(0, Math.min(1, this.config.masterVolume));
    this.targetVolume = this.masterVolume;
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.targetVolume = this.masterVolume;
  }

  setTargetVolume(volume: number): void {
    this.targetVolume = Math.max(0, Math.min(1, volume));
  }

  getCategoryVolume(category: AudioCategory): number {
    return this.categoryVolumes.get(category) ?? this.masterVolume;
  }

  setCategoryVolume(category: AudioCategory, volume: number): void {
    this.categoryVolumes.set(category, Math.max(0, Math.min(1, volume)));
    this.categoryHasOverride.add(category);
  }

  resetCategoryVolume(category: AudioCategory): void {
    this.categoryVolumes.delete(category);
    this.categoryHasOverride.delete(category);
  }

  resetAllCategoryVolumes(): void {
    this.categoryVolumes.clear();
    this.categoryHasOverride.clear();
  }

  getEffectiveVolume(category: AudioCategory): number {
    const catVol = this.getCategoryVolume(category);
    return catVol * this.masterVolume;
  }

  getMaxConcurrentSounds(): number {
    return this.config.maxConcurrentSounds;
  }

  isActive(): boolean {
    return this.active && !this.destroyed;
  }

  getFadeState(): FadeState {
    return this.fadeState;
  }

  fadeOut(durationMs: number): void {
    this.volumeBeforeFade = this.masterVolume;
    this.fadeDurationMs = durationMs;
    this.fadeProgress = 0;
    this.fadeState = 'fading-out';
  }

  fadeIn(durationMs: number): void {
    this.fadeDurationMs = durationMs;
    this.fadeProgress = 0;
    this.fadeState = 'fading-in';
  }

  registerSound(id: string, category: AudioCategory): boolean {
    if (!this.active || this.destroyed) return false;
    if (this.activeSounds.size >= this.config.maxConcurrentSounds) return false;
    this.activeSounds.set(id, category);
    return true;
  }

  unregisterSound(id: string): void {
    this.activeSounds.delete(id);
  }

  getActiveSoundCount(): number {
    return this.activeSounds.size;
  }

  getActiveSounds(): ActiveSoundInfo[] {
    const result: ActiveSoundInfo[] = [];
    this.activeSounds.forEach((category, id) => {
      result.push({ id, category });
    });
    return result;
  }

  stopAll(): void {
    this.activeSounds.clear();
  }

  suspend(): void {
    this.active = false;
    this.activeSounds.clear();
  }

  resume(): void {
    if (!this.destroyed) {
      this.active = true;
    }
  }

  update(deltaMs: number): void {
    if (this.fadeState === 'fading-out') {
      this.fadeProgress += deltaMs / this.fadeDurationMs;
      if (this.fadeProgress >= 1) {
        this.masterVolume = 0;
        this.fadeState = 'faded-out';
      } else {
        this.masterVolume = this.volumeBeforeFade * (1 - this.fadeProgress);
      }
    } else if (this.fadeState === 'fading-in') {
      this.fadeProgress += deltaMs / this.fadeDurationMs;
      if (this.fadeProgress >= 1) {
        this.masterVolume = this.targetVolume;
        this.fadeState = 'faded-in';
      } else {
        this.masterVolume = this.targetVolume * this.fadeProgress;
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.active = false;
    this.activeSounds.clear();
  }
}
