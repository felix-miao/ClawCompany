export type EmotionType = 'focused' | 'thinking' | 'sleepy' | 'happy' | 'stressed' | 'celebrating';

export interface EmotionVisual {
  emoji: string;
  bgColor: number;
  textColor: string;
  bounceAmplitude: number;
  scale: number;
}

export interface BubbleAnimation {
  bounceAmplitude: number;
  bounceDuration: number;
  fadeOutStart: number;
}

export interface BubbleConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  emotion: EmotionType;
  emoji: string;
  bgColor: number;
  animation: BubbleAnimation;
}

export interface EmotionHistoryEntry {
  emotion: EmotionType;
  timestamp: number;
  duration: number;
}

export interface EmotionSystemConfig {
  bubbleWidth?: number;
  bubbleHeight?: number;
  fontSize?: number;
  defaultDuration?: number;
  maxHistory?: number;
}

interface QueuedEmotion {
  emotion: EmotionType;
  duration: number;
}

const EMOTION_VISUALS: Record<EmotionType, EmotionVisual> = {
  focused: {
    emoji: '🎯',
    bgColor: 0x3B82F6,
    textColor: '#ffffff',
    bounceAmplitude: 0,
    scale: 1,
  },
  thinking: {
    emoji: '🤔',
    bgColor: 0x8B5CF6,
    textColor: '#ffffff',
    bounceAmplitude: 3,
    scale: 1,
  },
  sleepy: {
    emoji: '😴',
    bgColor: 0x9CA3AF,
    textColor: '#ffffff',
    bounceAmplitude: 2,
    scale: 1,
  },
  happy: {
    emoji: '😊',
    bgColor: 0x10B981,
    textColor: '#ffffff',
    bounceAmplitude: 5,
    scale: 1.1,
  },
  stressed: {
    emoji: '😰',
    bgColor: 0xEF4444,
    textColor: '#ffffff',
    bounceAmplitude: 2,
    scale: 1,
  },
  celebrating: {
    emoji: '🎉',
    bgColor: 0xF59E0B,
    textColor: '#ffffff',
    bounceAmplitude: 8,
    scale: 1.2,
  },
};

const VALID_EMOTIONS = new Set<EmotionType>(Object.keys(EMOTION_VISUALS) as EmotionType[]);

const TASK_EMOTION_RULES: Array<{ keywords: string[]; emotion: EmotionType }> = [
  {
    keywords: ['tests passed', 'test passed', 'successfully', 'deployed', 'complete'],
    emotion: 'celebrating',
  },
  {
    keywords: ['urgent', 'critical', 'hotfix', 'asap', 'emergency'],
    emotion: 'stressed',
  },
  {
    keywords: ['review', 'analyze', 'design', 'plan', 'think', 'consider'],
    emotion: 'thinking',
  },
  {
    keywords: ['finish', 'done', 'success'],
    emotion: 'happy',
  },
  {
    keywords: ['implement', 'write', 'build', 'fix', 'code', 'develop', 'debug', 'refactor'],
    emotion: 'focused',
  },
  {
    keywords: ['idle'],
    emotion: 'sleepy',
  },
];

export class EmotionSystem {
  private activeEmotion: EmotionType | null = null;
  private remainingDuration: number = 0;
  private queuedEmotion: QueuedEmotion | null = null;
  private previousEmotion: EmotionType | null = null;
  private history: EmotionHistoryEntry[] = [];
  private lastChangeTimestamp: number = 0;
  private readonly config: Required<EmotionSystemConfig>;
  private readonly maxHistory: number;

  constructor(config?: EmotionSystemConfig) {
    this.config = {
      bubbleWidth: config?.bubbleWidth ?? 48,
      bubbleHeight: config?.bubbleHeight ?? 40,
      fontSize: config?.fontSize ?? 20,
      defaultDuration: config?.defaultDuration ?? 5000,
      maxHistory: config?.maxHistory ?? 20,
    };
    this.maxHistory = this.config.maxHistory;
  }

  setEmotion(emotion: EmotionType, duration?: number): boolean {
    if (!VALID_EMOTIONS.has(emotion)) return false;

    this.previousEmotion = this.activeEmotion;
    this.activeEmotion = emotion;
    this.remainingDuration = duration ?? this.config.defaultDuration;
    this.lastChangeTimestamp = Date.now();

    this.history.push({
      emotion,
      timestamp: this.lastChangeTimestamp,
      duration: this.remainingDuration,
    });

    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }

    return true;
  }

  clearEmotion(): void {
    this.previousEmotion = this.activeEmotion;
    this.activeEmotion = null;
    this.remainingDuration = 0;
    this.queuedEmotion = null;
  }

  update(deltaMs: number): { needsRedraw: boolean } {
    if (!this.activeEmotion) {
      return { needsRedraw: false };
    }

    this.remainingDuration = Math.max(0, this.remainingDuration - deltaMs);

    if (this.remainingDuration <= 0) {
      this.previousEmotion = this.activeEmotion;
      this.activeEmotion = null;

      if (this.queuedEmotion) {
        this.setEmotion(this.queuedEmotion.emotion, this.queuedEmotion.duration);
        this.queuedEmotion = null;
        return { needsRedraw: true };
      }

      return { needsRedraw: true };
    }

    return { needsRedraw: false };
  }

  getActiveEmotion(): EmotionType | null {
    return this.activeEmotion;
  }

  getRemainingDuration(): number {
    return this.remainingDuration;
  }

  getEmotionVisuals(): EmotionVisual | null {
    if (!this.activeEmotion) return null;
    return EMOTION_VISUALS[this.activeEmotion];
  }

  getEmotionFromTask(taskDescription: string): EmotionType {
    if (!taskDescription) return 'focused';

    const lower = taskDescription.toLowerCase();

    for (const rule of TASK_EMOTION_RULES) {
      for (const keyword of rule.keywords) {
        if (lower.includes(keyword)) {
          return rule.emotion;
        }
      }
    }

    return 'focused';
  }

  getEmotionFromStatus(status: string): EmotionType | null {
    const statusMap: Record<string, EmotionType | null> = {
      idle: 'sleepy',
      busy: 'focused',
      offline: null,
    };
    return statusMap[status] ?? null;
  }

  getBubbleConfig(charX: number, charY: number): BubbleConfig | null {
    if (!this.activeEmotion) return null;

    const visual = EMOTION_VISUALS[this.activeEmotion];

    return {
      x: charX,
      y: charY - 60,
      width: this.config.bubbleWidth,
      height: this.config.bubbleHeight,
      emotion: this.activeEmotion,
      emoji: visual.emoji,
      bgColor: visual.bgColor,
      animation: {
        bounceAmplitude: visual.bounceAmplitude,
        bounceDuration: 800,
        fadeOutStart: 0.8,
      },
    };
  }

  queueEmotion(emotion: EmotionType, duration?: number): void {
    if (!this.activeEmotion) {
      this.setEmotion(emotion, duration);
      return;
    }
    this.queuedEmotion = {
      emotion,
      duration: duration ?? this.config.defaultDuration,
    };
  }

  getHistory(): EmotionHistoryEntry[] {
    return [...this.history];
  }

  getConfig(): Required<EmotionSystemConfig> {
    return { ...this.config };
  }
}
