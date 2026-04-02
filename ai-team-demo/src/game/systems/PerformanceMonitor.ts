export interface PerformanceMonitorConfig {
  targetFPS?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  sampleSize?: number;
}

export interface FrameStats {
  currentFPS: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  samples: number;
  avgFrameTime: number;
}

export interface PerformanceAlert {
  level: 'warning' | 'critical';
  message: string;
  timestamp: number;
  fps: number;
}

interface FullConfig {
  targetFPS: number;
  warningThreshold: number;
  criticalThreshold: number;
  sampleSize: number;
}

const DEFAULT_CONFIG: FullConfig = {
  targetFPS: 60,
  warningThreshold: 0.8,
  criticalThreshold: 0.5,
  sampleSize: 120,
};

export class PerformanceMonitor {
  private readonly config: FullConfig;
  private frameTimes: number[] = [];
  private alerts: PerformanceAlert[] = [];
  private lastFrameDelta = 0;

  constructor(config?: PerformanceMonitorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  recordFrame(deltaMs: number): void {
    this.lastFrameDelta = deltaMs;
    this.frameTimes.push(deltaMs);

    if (this.frameTimes.length > this.config.sampleSize) {
      this.frameTimes.shift();
    }

    this.checkAlerts();
  }

  getCurrentFPS(): number {
    if (this.lastFrameDelta <= 0) return 0;
    return 1000 / this.lastFrameDelta;
  }

  getAverageFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    const fpsValues = this.frameTimes.map(d => (d > 0 ? 1000 / d : 0));
    return fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
  }

  getFrameStats(): FrameStats {
    if (this.frameTimes.length === 0) {
      return {
        currentFPS: 0,
        averageFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        samples: 0,
        avgFrameTime: 0,
      };
    }

    const fpsValues = this.frameTimes.map(d => (d > 0 ? 1000 / d : 0));
    const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    return {
      currentFPS: this.getCurrentFPS(),
      averageFPS: this.getAverageFPS(),
      minFPS: Math.min(...fpsValues),
      maxFPS: Math.max(...fpsValues),
      samples: this.frameTimes.length,
      avgFrameTime: avgDelta,
    };
  }

  getFrameBudgetMs(): number {
    return 1000 / this.config.targetFPS;
  }

  getBudgetUsedPercent(): number {
    const budget = this.getFrameBudgetMs();
    if (budget <= 0) return 100;
    return (this.lastFrameDelta / budget) * 100;
  }

  isOverBudget(): boolean {
    return this.lastFrameDelta > this.getFrameBudgetMs();
  }

  shouldThrottle(): boolean {
    const avgFPS = this.getAverageFPS();
    if (avgFPS === 0 && this.frameTimes.length < 10) return false;
    return avgFPS < this.config.targetFPS * this.config.warningThreshold;
  }

  getThrottleLevel(): number {
    const avgFPS = this.getAverageFPS();
    if (avgFPS >= this.config.targetFPS) return 0;
    return Math.min(1, 1 - avgFPS / this.config.targetFPS);
  }

  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  reset(): void {
    this.frameTimes = [];
    this.alerts = [];
    this.lastFrameDelta = 0;
  }

  private checkAlerts(): void {
    if (this.frameTimes.length < 10) return;

    const avgFPS = this.getAverageFPS();
    const now = Date.now();

    if (avgFPS < this.config.targetFPS * this.config.criticalThreshold) {
      this.alerts.push({
        level: 'critical',
        message: `Critical: FPS dropped to ${Math.round(avgFPS)}`,
        timestamp: now,
        fps: avgFPS,
      });
    } else if (avgFPS < this.config.targetFPS * this.config.warningThreshold) {
      this.alerts.push({
        level: 'warning',
        message: `Warning: FPS at ${Math.round(avgFPS)}`,
        timestamp: now,
        fps: avgFPS,
      });
    }

    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }
}
