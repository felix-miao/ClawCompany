export type ParticleEffectType =
  | 'celebration'
  | 'error'
  | 'task-complete'
  | 'work-start'
  | 'sparkle';

export interface ParticleEffectConfig {
  speed: { min: number; max: number };
  scale: { start: number; end: number };
  lifespan: number;
  gravityY: number;
  alpha: { start: number; end: number };
  tints: number[];
  quantity: number;
  emitting: boolean;
  blendMode: string;
}

export interface ActiveEffect {
  id: string;
  type: ParticleEffectType;
  agentId: string;
  x: number;
  y: number;
  createdAt: number;
  remainingLifespan: number;
  config: ParticleEffectConfig;
}

export interface EffectHistoryEntry {
  type: ParticleEffectType;
  agentId: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface ParticlePreset {
  name: ParticleEffectType;
}

const CELEBRATION_CONFIG: ParticleEffectConfig = {
  speed: { min: 80, max: 200 },
  scale: { start: 0.6, end: 0 },
  lifespan: 1500,
  gravityY: -120,
  alpha: { start: 1, end: 0 },
  tints: [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf59e0b, 0xa78bfa, 0x34d399],
  quantity: 30,
  emitting: false,
  blendMode: 'ADD',
};

const ERROR_CONFIG: ParticleEffectConfig = {
  speed: { min: 40, max: 120 },
  scale: { start: 0.5, end: 0 },
  lifespan: 600,
  gravityY: 80,
  alpha: { start: 1, end: 0 },
  tints: [0xef4444, 0xf97316, 0xff0000],
  quantity: 15,
  emitting: false,
  blendMode: 'ADD',
};

const TASK_COMPLETE_CONFIG: ParticleEffectConfig = {
  speed: { min: 30, max: 80 },
  scale: { start: 0.4, end: 0 },
  lifespan: 1200,
  gravityY: 50,
  alpha: { start: 1, end: 0 },
  tints: [0x10b981, 0x34d399, 0xfbbf24],
  quantity: 12,
  emitting: false,
  blendMode: 'ADD',
};

const WORK_START_CONFIG: ParticleEffectConfig = {
  speed: { min: 20, max: 50 },
  scale: { start: 0.3, end: 0 },
  lifespan: 600,
  gravityY: -30,
  alpha: { start: 0.8, end: 0 },
  tints: [0x3b82f6, 0x60a5fa],
  quantity: 8,
  emitting: false,
  blendMode: 'ADD',
};

const SPARKLE_CONFIG: ParticleEffectConfig = {
  speed: { min: 10, max: 40 },
  scale: { start: 0.3, end: 0 },
  lifespan: 800,
  gravityY: -20,
  alpha: { start: 0.9, end: 0 },
  tints: [0xfbbf24, 0xfde68a, 0xffffff],
  quantity: 6,
  emitting: false,
  blendMode: 'ADD',
};

const BUILTIN_PRESETS: Record<ParticleEffectType, ParticleEffectConfig> = {
  celebration: CELEBRATION_CONFIG,
  error: ERROR_CONFIG,
  'task-complete': TASK_COMPLETE_CONFIG,
  'work-start': WORK_START_CONFIG,
  sparkle: SPARKLE_CONFIG,
};

const MAX_HISTORY = 50;

let effectIdCounter = 0;

interface EventContext {
  result?: string;
  status?: string;
  emotion?: string;
  description?: string;
  agentId?: string;
}

export class ParticleSystem {
  private presets: Record<string, ParticleEffectConfig> = { ...BUILTIN_PRESETS };
  private activeEffects: ActiveEffect[] = [];
  private history: EffectHistoryEntry[] = [];

  getEffectConfig(type: ParticleEffectType): ParticleEffectConfig | null {
    return this.presets[type] ?? null;
  }

  getAvailablePresets(): string[] {
    return Object.keys(this.presets);
  }

  getEffectForEvent(
    eventType: string,
    context: EventContext
  ): ParticleEffectType | null {
    switch (eventType) {
      case 'agent:task-completed':
        return this.getEffectForTaskResult(context.result);
      case 'session:completed':
        return this.getEffectForSessionStatus(context.status);
      case 'agent:status-change':
        return context.status === 'busy' || context.status === 'working'
          ? 'work-start'
          : null;
      case 'agent:emotion-change':
        return context.emotion === 'celebrating'
          ? 'celebration'
          : context.emotion === 'stressed'
            ? 'error'
            : null;
      case 'agent:task-assigned':
        return this.getEffectForTaskDescription(context.description);
      default:
        return null;
    }
  }

  private getEffectForTaskResult(
    result?: string
  ): ParticleEffectType {
    if (result === 'success') return 'celebration';
    if (result === 'failure') return 'error';
    return 'sparkle';
  }

  private getEffectForSessionStatus(
    status?: string
  ): ParticleEffectType {
    if (status === 'completed') return 'celebration';
    if (status === 'failed') return 'error';
    return 'sparkle';
  }

  private getEffectForTaskDescription(
    description?: string
  ): ParticleEffectType | null {
    if (!description) return null;
    const lower = description.toLowerCase();
    if (
      lower.includes('tests passed') ||
      lower.includes('successfully') ||
      lower.includes('deployed')
    ) {
      return 'celebration';
    }
    return null;
  }

  triggerEffect(
    type: ParticleEffectType,
    agentId: string,
    x: number,
    y: number
  ): { id: string; config: ParticleEffectConfig } | null {
    const config = this.presets[type];
    if (!config) return null;

    const id = `fx_${++effectIdCounter}_${Date.now()}`;
    const now = Date.now();

    const effect: ActiveEffect = {
      id,
      type,
      agentId,
      x,
      y,
      createdAt: now,
      remainingLifespan: config.lifespan,
      config,
    };

    this.activeEffects.push(effect);
    this.addHistory(type, agentId, x, y, now);

    return { id, config };
  }

  update(deltaMs: number): void {
    this.activeEffects = this.activeEffects.filter((effect) => {
      effect.remainingLifespan -= deltaMs;
      return effect.remainingLifespan > 0;
    });
  }

  getActiveEffectCount(): number {
    return this.activeEffects.length;
  }

  getActiveEffects(): ActiveEffect[] {
    return [...this.activeEffects];
  }

  clearEffect(id: string): void {
    this.activeEffects = this.activeEffects.filter((e) => e.id !== id);
  }

  clearAllEffects(): void {
    this.activeEffects = [];
  }

  registerCustomEffect(
    name: string,
    config: ParticleEffectConfig
  ): void {
    this.presets[name] = config;
  }

  getHistory(): EffectHistoryEntry[] {
    return [...this.history];
  }

  private addHistory(
    type: ParticleEffectType,
    agentId: string,
    x: number,
    y: number,
    timestamp: number
  ): void {
    this.history.push({ type, agentId, x, y, timestamp });
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
  }
}
