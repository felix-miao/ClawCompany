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

  private writeIndex: number = 0;
  private isBufferFull: boolean = false;

  private cachedAvgFPS: number = 0;
  private cachedMinFPS: number = 0;
  private cachedMaxFPS: number = 0;
  private cachedAvgFrameTime: number = 0;
  private statsDirty: boolean = true;

  constructor(config?: PerformanceMonitorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  recordFrame(deltaMs: number): void {
    this.lastFrameDelta = deltaMs;

    if (this.frameTimes.length < this.config.sampleSize) {
      this.frameTimes.push(deltaMs);
    } else {
      this.frameTimes[this.writeIndex] = deltaMs;
      this.writeIndex = (this.writeIndex + 1) % this.config.sampleSize;
      this.isBufferFull = true;
    }

    this.statsDirty = true;
    this.checkAlerts();
  }

  getCurrentFPS(): number {
    if (this.lastFrameDelta <= 0) return 0;
    return 1000 / this.lastFrameDelta;
  }

  getAverageFPS(): number {
    this.recomputeStatsIfNeeded();
    return this.cachedAvgFPS;
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

    this.recomputeStatsIfNeeded();

    return {
      currentFPS: this.getCurrentFPS(),
      averageFPS: this.cachedAvgFPS,
      minFPS: this.cachedMinFPS,
      maxFPS: this.cachedMaxFPS,
      samples: this.frameTimes.length,
      avgFrameTime: this.cachedAvgFrameTime,
    };
  }

  private recomputeStatsIfNeeded(): void {
    if (!this.statsDirty) return;
    this.statsDirty = false;

    if (this.frameTimes.length === 0) {
      this.cachedAvgFPS = 0;
      this.cachedMinFPS = 0;
      this.cachedMaxFPS = 0;
      this.cachedAvgFrameTime = 0;
      return;
    }

    let sumDelta = 0;
    let minFPS = Infinity;
    let maxFPS = 0;
    let sumFPS = 0;

    for (let i = 0; i < this.frameTimes.length; i++) {
      const d = this.frameTimes[i];
      sumDelta += d;
      const fps = d > 0 ? 1000 / d : 0;
      sumFPS += fps;
      if (fps < minFPS) minFPS = fps;
      if (fps > maxFPS) maxFPS = fps;
    }

    this.cachedAvgFPS = sumFPS / this.frameTimes.length;
    this.cachedMinFPS = minFPS;
    this.cachedMaxFPS = maxFPS;
    this.cachedAvgFrameTime = sumDelta / this.frameTimes.length;
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
    this.writeIndex = 0;
    this.isBufferFull = false;
    this.cachedAvgFPS = 0;
    this.cachedMinFPS = 0;
    this.cachedMaxFPS = 0;
    this.cachedAvgFrameTime = 0;
    this.statsDirty = true;
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
