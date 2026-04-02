export type SoundType =
  | 'walk'
  | 'jump'
  | 'land'
  | 'work-start'
  | 'work-end'
  | 'task-complete'
  | 'task-assigned'
  | 'error'
  | 'celebration'
  | 'click'
  | 'tab-switch'
  | 'ambient';

export type SoundCategory = 'movement' | 'work' | 'event' | 'ui' | 'ambient';

export interface SoundConfig {
  duration: number;
  cooldown: number;
  volume: number;
  category: SoundCategory;
  loop: boolean;
}

export interface PlayingSound {
  id: string;
  type: SoundType;
  remainingMs: number;
  volume: number;
}

const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  walk: { duration: 150, cooldown: 300, volume: 0.3, category: 'movement', loop: false },
  jump: { duration: 200, cooldown: 100, volume: 0.5, category: 'movement', loop: false },
  land: { duration: 100, cooldown: 50, volume: 0.4, category: 'movement', loop: false },
  'work-start': { duration: 300, cooldown: 200, volume: 0.4, category: 'work', loop: false },
  'work-end': { duration: 250, cooldown: 200, volume: 0.4, category: 'work', loop: false },
  'task-complete': { duration: 500, cooldown: 100, volume: 0.6, category: 'event', loop: false },
  'task-assigned': { duration: 400, cooldown: 100, volume: 0.5, category: 'event', loop: false },
  error: { duration: 400, cooldown: 100, volume: 0.5, category: 'event', loop: false },
  celebration: { duration: 800, cooldown: 100, volume: 0.7, category: 'event', loop: false },
  click: { duration: 80, cooldown: 50, volume: 0.5, category: 'ui', loop: false },
  'tab-switch': { duration: 120, cooldown: 50, volume: 0.4, category: 'ui', loop: false },
  ambient: { duration: 3000, cooldown: 0, volume: 0.15, category: 'ambient', loop: true },
};

let soundIdCounter = 0;

export class SoundSystem {
  private enabled: boolean = true;
  private masterVolume: number = 0.7;
  private categoryVolumes: Map<SoundCategory, number> = new Map();
  private playingSounds: Map<string, PlayingSound> = new Map();
  private cooldownRemaining: Map<SoundType, number> = new Map();
  private ambientId: string | null = null;
  private destroyed: boolean = false;
  private nowMs: number = 0;

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
  }

  getAvailableSoundTypes(): SoundType[] {
    return Object.keys(SOUND_CONFIGS) as SoundType[];
  }

  getSoundConfig(type: SoundType): SoundConfig | null {
    return SOUND_CONFIGS[type] ?? null;
  }

  getSoundCategory(type: SoundType): SoundCategory {
    return SOUND_CONFIGS[type]?.category ?? 'ui';
  }

  getCategoryVolume(category: SoundCategory): number {
    return this.categoryVolumes.get(category) ?? this.masterVolume;
  }

  setCategoryVolume(category: SoundCategory, volume: number): void {
    this.categoryVolumes.set(category, Math.max(0, Math.min(1, volume)));
  }

  play(type: SoundType, options?: { volume?: number }): string | null {
    if (!this.enabled || this.destroyed) return null;

    const config = SOUND_CONFIGS[type];
    if (!config) return null;

    const lastPlay = this.cooldownRemaining.get(type) ?? 0;
    if (config.cooldown > 0 && lastPlay > 0) {
      return null;
    }

    const categoryVol = this.getCategoryVolume(config.category);
    const effectiveVolume = (options?.volume ?? config.volume) * categoryVol * this.masterVolume;

    const id = `snd_${++soundIdCounter}_${this.nowMs}`;
    const sound: PlayingSound = {
      id,
      type,
      remainingMs: config.duration,
      volume: effectiveVolume,
    };

    this.playingSounds.set(id, sound);
    if (config.cooldown > 0) {
      this.cooldownRemaining.set(type, config.cooldown);
    }

    return id;
  }

  stop(id: string): void {
    this.playingSounds.delete(id);
    if (this.ambientId === id) {
      this.ambientId = null;
    }
  }

  stopAll(): void {
    this.playingSounds.clear();
    this.ambientId = null;
  }

  stopByType(type: SoundType): void {
    const toDelete: string[] = [];
    this.playingSounds.forEach((sound, id) => {
      if (sound.type === type) {
        toDelete.push(id);
      }
    });
    toDelete.forEach(id => {
      this.playingSounds.delete(id);
      if (this.ambientId === id) {
        this.ambientId = null;
      }
    });
  }

  getPlayingCount(): number {
    return this.playingSounds.size;
  }

  getPlayingSounds(): PlayingSound[] {
    return Array.from(this.playingSounds.values());
  }

  startAmbient(): void {
    if (!this.enabled || this.destroyed) return;
    if (this.ambientId) return;

    const id = this.play('ambient');
    if (id) {
      this.ambientId = id;
    }
  }

  stopAmbient(): void {
    if (this.ambientId) {
      this.playingSounds.delete(this.ambientId);
      this.ambientId = null;
    }
  }

  isAmbientPlaying(): boolean {
    return this.ambientId !== null && this.playingSounds.has(this.ambientId);
  }

  update(deltaMs: number): void {
    this.nowMs += deltaMs;

    this.cooldownRemaining.forEach((remaining, type) => {
      const newRemaining = remaining - deltaMs;
      if (newRemaining <= 0) {
        this.cooldownRemaining.delete(type);
      } else {
        this.cooldownRemaining.set(type, newRemaining);
      }
    });

    const toDelete: string[] = [];
    this.playingSounds.forEach((sound, id) => {
      if (id === this.ambientId) return;
      sound.remainingMs -= deltaMs;
      if (sound.remainingMs <= 0) {
        toDelete.push(id);
      }
    });
    toDelete.forEach(id => this.playingSounds.delete(id));
  }

  generateAudioBuffer(type: SoundType): Float32Array {
    const config = SOUND_CONFIGS[type];
    if (!config) return new Float32Array(0);

    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * (config.duration / 1000));
    const buffer = new Float32Array(numSamples);

    switch (type) {
      case 'click':
        return this.generateClick(buffer, sampleRate);
      case 'walk':
        return this.generateWalk(buffer, sampleRate);
      case 'jump':
        return this.generateJump(buffer, sampleRate);
      case 'land':
        return this.generateLand(buffer, sampleRate);
      case 'work-start':
        return this.generateWorkStart(buffer, sampleRate);
      case 'work-end':
        return this.generateWorkEnd(buffer, sampleRate);
      case 'task-complete':
        return this.generateTaskComplete(buffer, sampleRate);
      case 'task-assigned':
        return this.generateTaskAssigned(buffer, sampleRate);
      case 'error':
        return this.generateError(buffer, sampleRate);
      case 'celebration':
        return this.generateCelebration(buffer, sampleRate);
      case 'tab-switch':
        return this.generateTabSwitch(buffer, sampleRate);
      case 'ambient':
        return this.generateAmbient(buffer, sampleRate);
      default:
        return buffer;
    }
  }

  private generateClick(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 40);
      buffer[i] = Math.sin(2 * Math.PI * 800 * t) * env * 0.5;
    }
    return buffer;
  }

  private generateWalk(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 20);
      const noise = (Math.random() * 2 - 1) * 0.3;
      buffer[i] = (Math.sin(2 * Math.PI * 200 * t) * 0.3 + noise) * env;
    }
    return buffer;
  }

  private generateJump(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const freq = 300 + t * 600;
      const env = Math.exp(-t * 12);
      buffer[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.4;
    }
    return buffer;
  }

  private generateLand(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 30);
      buffer[i] = (Math.random() * 2 - 1) * env * 0.4;
    }
    return buffer;
  }

  private generateWorkStart(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 6);
      buffer[i] = Math.sin(2 * Math.PI * 440 * t) * env * 0.3;
    }
    return buffer;
  }

  private generateWorkEnd(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 8);
      buffer[i] = (Math.sin(2 * Math.PI * 330 * t) + Math.sin(2 * Math.PI * 440 * t)) * env * 0.2;
    }
    return buffer;
  }

  private generateTaskComplete(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 4);
      const freq1 = 523.25;
      const freq2 = 659.25;
      const freq3 = 783.99;
      const progress = t / (buffer.length / sr);
      const freq = progress < 0.33 ? freq1 : progress < 0.66 ? freq2 : freq3;
      buffer[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.4;
    }
    return buffer;
  }

  private generateTaskAssigned(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 6);
      buffer[i] = (Math.sin(2 * Math.PI * 600 * t) + Math.sin(2 * Math.PI * 450 * t)) * env * 0.25;
    }
    return buffer;
  }

  private generateError(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 6);
      buffer[i] = (Math.sin(2 * Math.PI * 200 * t) + Math.sin(2 * Math.PI * 150 * t)) * env * 0.4;
    }
    return buffer;
  }

  private generateCelebration(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 2);
      const freq = 523.25 * Math.pow(2, Math.floor(t * 8) / 12);
      buffer[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
    }
    return buffer;
  }

  private generateTabSwitch(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 25);
      buffer[i] = Math.sin(2 * Math.PI * 600 * t) * env * 0.3;
    }
    return buffer;
  }

  private generateAmbient(buffer: Float32Array, sr: number): Float32Array {
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      const freq1 = 80;
      const freq2 = 120;
      buffer[i] = (Math.sin(2 * Math.PI * freq1 * t) * 0.1 + Math.sin(2 * Math.PI * freq2 * t) * 0.08) * 0.3;
    }
    return buffer;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopAll();
  }
}
