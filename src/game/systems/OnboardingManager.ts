export enum OnboardingPhase {
  WELCOME = 'welcome',
  NAVIGATION = 'navigation',
  TASKS = 'tasks',
  INTERACTION = 'interaction',
  COMPLETE = 'complete',
}

export interface OnboardingStepResult {
  stepId: string;
  phase: OnboardingPhase;
  completed: boolean;
  timestamp: number;
}

export interface OnboardingProgress {
  completedPhases: OnboardingPhase[];
  currentPhase: OnboardingPhase;
  stepResults: OnboardingStepResult[];
}

export interface Achievement {
  phase: OnboardingPhase;
  title: string;
  icon: string;
  unlockedAt: number;
}

export interface OnboardingStepDefinition {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'interaction' | 'highlight';
  phase: OnboardingPhase;
  interactionType?: string;
  targetArea?: { x: number; y: number; width: number; height: number };
}

const PHASE_ORDER: OnboardingPhase[] = [
  OnboardingPhase.WELCOME,
  OnboardingPhase.NAVIGATION,
  OnboardingPhase.TASKS,
  OnboardingPhase.INTERACTION,
  OnboardingPhase.COMPLETE,
];

const PHASE_ACHIEVEMENTS: Record<OnboardingPhase, { title: string; icon: string }> = {
  [OnboardingPhase.WELCOME]: { title: '初来乍到', icon: '👋' },
  [OnboardingPhase.NAVIGATION]: { title: '导航达人', icon: '🧭' },
  [OnboardingPhase.TASKS]: { title: '任务大师', icon: '📋' },
  [OnboardingPhase.INTERACTION]: { title: '互动专家', icon: '🤝' },
  [OnboardingPhase.COMPLETE]: { title: '毕业了！', icon: '🎓' },
};

const STORAGE_KEY = 'virtual-office-onboarding';

const PHASE_STEPS: Record<OnboardingPhase, OnboardingStepDefinition[]> = {
  [OnboardingPhase.WELCOME]: [
    { id: 'welcome-1', title: '欢迎来到虚拟办公室', description: '这里是 AI 团队协作的空间', type: 'info', phase: OnboardingPhase.WELCOME },
  ],
  [OnboardingPhase.NAVIGATION]: [
    { id: 'nav-move', title: '移动角色', description: '点击屏幕或使用 WASD 移动', type: 'interaction', phase: OnboardingPhase.NAVIGATION, interactionType: 'click' },
  ],
  [OnboardingPhase.TASKS]: [
    { id: 'task-view', title: '查看任务', description: '点击角色查看当前任务', type: 'interaction', phase: OnboardingPhase.TASKS, interactionType: 'click' },
  ],
  [OnboardingPhase.INTERACTION]: [
    { id: 'inter-agent', title: '角色互动', description: '角色靠近时会自动互动', type: 'info', phase: OnboardingPhase.INTERACTION },
  ],
  [OnboardingPhase.COMPLETE]: [
    { id: 'complete-finish', title: '全部完成', description: '你已经掌握了所有操作', type: 'info', phase: OnboardingPhase.COMPLETE },
  ],
};

type OnboardingEventMap = {
  'phase:complete': { phase: OnboardingPhase };
  'onboarding:complete': {};
  'step:complete': OnboardingStepResult;
  'achievement:unlock': Achievement;
};

export class OnboardingManager {
  private completedPhases: Set<OnboardingPhase> = new Set();
  private currentPhase: OnboardingPhase = OnboardingPhase.WELCOME;
  private stepResults: Map<string, OnboardingStepResult> = new Map();
  private achievements: Achievement[] = [];
  private eventHandlers: Map<string, Function[]> = new Map();
  private activePhase: OnboardingPhase | null = null;

  constructor() {
    this.loadFromStorage();
  }

  isFirstTime(): boolean {
    return this.completedPhases.size === 0 && this.stepResults.size === 0;
  }

  isCompleted(): boolean {
    return PHASE_ORDER.every(p => this.completedPhases.has(p));
  }

  getCurrentPhase(): OnboardingPhase {
    return this.currentPhase;
  }

  getProgress(): OnboardingProgress {
    return {
      completedPhases: Array.from(this.completedPhases),
      currentPhase: this.currentPhase,
      stepResults: Array.from(this.stepResults.values()),
    };
  }

  getProgressPercentage(): number {
    const total = PHASE_ORDER.length;
    const completed = this.completedPhases.size;
    return Math.round((completed / total) * 100);
  }

  startPhase(phase: OnboardingPhase): void {
    this.activePhase = phase;
  }

  completePhase(phase: OnboardingPhase): void {
    if (!this.activePhase) return;

    const activeIndex = PHASE_ORDER.indexOf(this.activePhase);
    const targetIndex = PHASE_ORDER.indexOf(phase);

    if (targetIndex > activeIndex && phase !== this.activePhase) {
      throw new Error(`Cannot skip phases: current=${this.activePhase}, target=${phase}`);
    }

    if (this.completedPhases.has(phase)) {
      const nextIndex = Math.min(activeIndex + 1, PHASE_ORDER.length - 1);
      this.currentPhase = PHASE_ORDER[nextIndex];
      this.activePhase = null;
      return;
    }

    this.completedPhases.add(phase);

    const achievement = PHASE_ACHIEVEMENTS[phase];
    if (achievement && !this.achievements.some(a => a.phase === phase)) {
      const newAchievement: Achievement = {
        phase,
        title: achievement.title,
        icon: achievement.icon,
        unlockedAt: Date.now(),
      };
      this.achievements.push(newAchievement);
      this.emitEvent('achievement:unlock', newAchievement);
    }

    this.emitEvent('phase:complete', { phase });

    const currentIndex = PHASE_ORDER.indexOf(phase);
    if (currentIndex < PHASE_ORDER.length - 1) {
      this.currentPhase = PHASE_ORDER[currentIndex + 1];
    }

    this.activePhase = null;

    if (this.isCompleted()) {
      this.emitEvent('onboarding:complete', {});
    }

    this.saveToStorage();
  }

  recordStepResult(result: OnboardingStepResult): void {
    this.stepResults.set(result.stepId, result);
    if (result.completed) {
      this.emitEvent('step:complete', result);
    }
    this.saveToStorage();
  }

  isStepCompleted(stepId: string): boolean {
    const result = this.stepResults.get(stepId);
    return result?.completed ?? false;
  }

  isPhaseReadyToComplete(phase: OnboardingPhase): boolean {
    const steps = PHASE_STEPS[phase] ?? [];
    if (steps.length === 0) return true;
    return steps.some(s => this.isStepCompleted(s.id));
  }

  getStepResults(phase: OnboardingPhase): OnboardingStepResult[] {
    return Array.from(this.stepResults.values()).filter(r => r.phase === phase);
  }

  getAchievements(): Achievement[] {
    return [...this.achievements];
  }

  getNextStep(): OnboardingStepDefinition | null {
    if (this.isCompleted()) return null;

    const phaseSteps = PHASE_STEPS[this.currentPhase];
    if (!phaseSteps || phaseSteps.length === 0) return null;

    const nextUncompleted = phaseSteps.find(s => !this.isStepCompleted(s.id));
    return nextUncompleted ?? phaseSteps[0];
  }

  getPhaseSteps(phase: OnboardingPhase): OnboardingStepDefinition[] {
    return PHASE_STEPS[phase] ?? [];
  }

  reset(): void {
    this.completedPhases.clear();
    this.stepResults.clear();
    this.achievements = [];
    this.currentPhase = OnboardingPhase.WELCOME;
    this.activePhase = null;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  on<K extends keyof OnboardingEventMap>(event: K, handler: (data: OnboardingEventMap[K]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off<K extends keyof OnboardingEventMap>(event: K, handler: (data: OnboardingEventMap[K]) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      this.eventHandlers.set(event, handlers.filter(h => h !== handler));
    }
  }

  private emitEvent<K extends keyof OnboardingEventMap>(event: K, data: OnboardingEventMap[K]): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const handler of handlers) {
      handler(data);
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        completedPhases: Array.from(this.completedPhases),
        stepResults: Array.from(this.stepResults.entries()),
        achievements: this.achievements,
        currentPhase: this.currentPhase,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;

      if (Array.isArray(data.completedPhases)) {
        this.completedPhases = new Set(data.completedPhases);
      }
      if (Array.isArray(data.stepResults)) {
        this.stepResults = new Map(data.stepResults);
      }
      if (Array.isArray(data.achievements)) {
        this.achievements = data.achievements;
      }
      if (data.currentPhase && Object.values(OnboardingPhase).includes(data.currentPhase)) {
        this.currentPhase = data.currentPhase;
      }
    } catch {
      // corrupted data - start fresh
    }
  }
}
