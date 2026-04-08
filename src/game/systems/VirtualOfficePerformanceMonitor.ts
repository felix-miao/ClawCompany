export interface VirtualOfficePerformanceMonitorConfig {
  targetFPS?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  sampleSize?: number;
  maxHistoryLength?: number;
}

export type PerformanceGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface OptimizationSuggestion {
  category: 'rendering' | 'memory' | 'culling' | 'general';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PerformanceAlert {
  type: 'fps' | 'memory' | 'rendering';
  level: 'warning' | 'critical';
  message: string;
  timestamp: number;
  value: number;
}

export interface MemorySnapshot {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
}

export interface MemoryStats {
  currentMB: number;
  totalMB: number;
  averageMB: number;
  peakMB: number;
  usagePercentage: number;
}

export interface RenderStatsInput {
  drawCalls: number;
  visibleObjects: number;
  culledObjects: number;
  totalObjects: number;
}

export interface AggregatedRenderStats {
  avgDrawCalls: number;
  avgVisibleObjects: number;
  avgCulledObjects: number;
  avgTotalObjects: number;
  cullingEfficiency: number;
  sampleCount: number;
}

export interface FPSReportSection {
  current: number;
  average: number;
  min: number;
  max: number;
  droppedFrames: number;
}

export interface VirtualOfficePerformanceReport {
  grade: PerformanceGrade;
  fps: FPSReportSection;
  memory: MemoryStats;
  render: AggregatedRenderStats;
  alerts: PerformanceAlert[];
  suggestions: OptimizationSuggestion[];
  timestamp: number;
}

interface FullConfig {
  targetFPS: number;
  warningThreshold: number;
  criticalThreshold: number;
  sampleSize: number;
  maxHistoryLength: number;
}

const DEFAULT_CONFIG: FullConfig = {
  targetFPS: 60,
  warningThreshold: 0.8,
  criticalThreshold: 0.5,
  sampleSize: 120,
  maxHistoryLength: 120,
};

const BYTES_PER_MB = 1024 * 1024;

export class VirtualOfficePerformanceMonitor {
  private readonly config: FullConfig;
  private frameTimes: number[] = [];
  private fpsHistory: number[] = [];
  private memoryHistory: number[] = [];
  private totalMemoryMB: number = 0;
  private renderStatsHistory: RenderStatsInput[] = [];
  private alerts: PerformanceAlert[] = [];
  private lastFrameDelta = 0;
  private droppedFrameCount = 0;
  private writeIndex = 0;

  constructor(config?: VirtualOfficePerformanceMonitorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  recordFrame(deltaMs: number): void {
    this.lastFrameDelta = deltaMs;

    if (deltaMs <= 0) {
      return;
    }

    const isDropped = deltaMs > 1000 / this.config.targetFPS * 1.5;
    if (isDropped) {
      this.droppedFrameCount++;
    }

    if (this.frameTimes.length < this.config.sampleSize) {
      this.frameTimes.push(deltaMs);
    } else {
      this.frameTimes[this.writeIndex] = deltaMs;
      this.writeIndex = (this.writeIndex + 1) % this.config.sampleSize;
    }

    this.pushHistory(this.fpsHistory, 1000 / deltaMs, this.config.maxHistoryLength);
    this.checkFPSAlerts();
  }

  recordMemorySnapshot(snapshot: MemorySnapshot): void {
    const usedMB = snapshot.usedJSHeapSize / BYTES_PER_MB;
    this.totalMemoryMB = snapshot.totalJSHeapSize / BYTES_PER_MB;
    this.pushHistory(this.memoryHistory, usedMB, this.config.maxHistoryLength);
    this.checkMemoryAlerts(snapshot);
  }

  recordRenderStats(stats: RenderStatsInput): void {
    this.renderStatsHistory.push(stats);
    if (this.renderStatsHistory.length > this.config.sampleSize) {
      this.renderStatsHistory = this.renderStatsHistory.slice(-this.config.sampleSize);
    }
  }

  getCurrentFPS(): number {
    if (this.lastFrameDelta <= 0) return 0;
    return 1000 / this.lastFrameDelta;
  }

  getAverageFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.frameTimes.length; i++) {
      const d = this.frameTimes[i];
      sum += d > 0 ? 1000 / d : 0;
    }
    return sum / this.frameTimes.length;
  }

  getMinFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    let min = Infinity;
    for (let i = 0; i < this.frameTimes.length; i++) {
      const d = this.frameTimes[i];
      if (d > 0) {
        const fps = 1000 / d;
        if (fps < min) min = fps;
      }
    }
    return min === Infinity ? 0 : min;
  }

  getMaxFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    let max = 0;
    for (let i = 0; i < this.frameTimes.length; i++) {
      const d = this.frameTimes[i];
      if (d > 0) {
        const fps = 1000 / d;
        if (fps > max) max = fps;
      }
    }
    return max;
  }

  getDroppedFrameCount(): number {
    return this.droppedFrameCount;
  }

  getFPSHistory(): number[] {
    return [...this.fpsHistory];
  }

  getMemoryStats(): MemoryStats {
    if (this.memoryHistory.length === 0) {
      return { currentMB: 0, totalMB: 0, averageMB: 0, peakMB: 0, usagePercentage: 0 };
    }

    const currentMB = this.memoryHistory[this.memoryHistory.length - 1];
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < this.memoryHistory.length; i++) {
      sum += this.memoryHistory[i];
      if (this.memoryHistory[i] > peak) peak = this.memoryHistory[i];
    }
    const averageMB = sum / this.memoryHistory.length;

    return {
      currentMB,
      totalMB: this.totalMemoryMB,
      averageMB,
      peakMB: peak,
      usagePercentage: this.totalMemoryMB > 0 ? (currentMB / this.totalMemoryMB) * 100 : 0,
    };
  }

  getMemoryHistory(): number[] {
    return [...this.memoryHistory];
  }

  getAggregatedRenderStats(): AggregatedRenderStats {
    if (this.renderStatsHistory.length === 0) {
      return { avgDrawCalls: 0, avgVisibleObjects: 0, avgCulledObjects: 0, avgTotalObjects: 0, cullingEfficiency: 0, sampleCount: 0 };
    }

    let sumDraw = 0, sumVis = 0, sumCull = 0, sumTotal = 0;
    const len = this.renderStatsHistory.length;
    for (let i = 0; i < len; i++) {
      sumDraw += this.renderStatsHistory[i].drawCalls;
      sumVis += this.renderStatsHistory[i].visibleObjects;
      sumCull += this.renderStatsHistory[i].culledObjects;
      sumTotal += this.renderStatsHistory[i].totalObjects;
    }

    const avgTotal = sumTotal / len;
    const cullingEfficiency = avgTotal > 0 ? (sumCull / len) / avgTotal * 100 : 0;

    return {
      avgDrawCalls: Math.round(sumDraw / len),
      avgVisibleObjects: Math.round(sumVis / len),
      avgCulledObjects: Math.round(sumCull / len),
      avgTotalObjects: Math.round(avgTotal),
      cullingEfficiency: Math.round(cullingEfficiency),
      sampleCount: len,
    };
  }

  getPerformanceGrade(): PerformanceGrade {
    if (this.frameTimes.length < 10) return 'unknown';

    const avgFPS = this.getAverageFPS();
    if (avgFPS >= this.config.targetFPS * 0.9) return 'excellent';
    if (avgFPS >= 45) return 'good';
    if (avgFPS >= 30) return 'fair';
    return 'poor';
  }

  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (this.frameTimes.length < 10) return suggestions;

    const avgFPS = this.getAverageFPS();
    const avgFrameTime = this.getAverageFrameTime();

    if (avgFPS < 30) {
      suggestions.push({ category: 'rendering', message: 'FPS严重过低，建议减少渲染对象数量和降低视觉复杂度', priority: 'high' });
    } else if (avgFPS < 45) {
      suggestions.push({ category: 'rendering', message: 'FPS偏低，建议启用视锥剔除或降低LOD级别', priority: 'medium' });
    }

    if (avgFrameTime > 20) {
      suggestions.push({ category: 'rendering', message: '帧时间过长，建议减少每帧渲染工作量', priority: 'medium' });
    }

    if (this.memoryHistory.length > 0) {
      const currentMem = this.memoryHistory[this.memoryHistory.length - 1];
      if (currentMem > 150) {
        suggestions.push({ category: 'memory', message: '内存使用过高，建议清理未使用的资源并检查内存泄漏', priority: 'high' });
      } else if (currentMem > 100) {
        suggestions.push({ category: 'memory', message: '内存使用偏高，建议优化纹理资源和对象池', priority: 'medium' });
      }
    }

    if (this.renderStatsHistory.length > 0) {
      const renderStats = this.getAggregatedRenderStats();
      if (renderStats.cullingEfficiency < 10 && renderStats.avgTotalObjects > 50) {
        suggestions.push({ category: 'culling', message: '剔除效率低，建议启用或优化视锥剔除策略', priority: 'medium' });
      }
    }

    return suggestions;
  }

  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  getReport(): VirtualOfficePerformanceReport {
    return {
      grade: this.getPerformanceGrade(),
      fps: {
        current: this.getCurrentFPS(),
        average: this.getAverageFPS(),
        min: this.getMinFPS(),
        max: this.getMaxFPS(),
        droppedFrames: this.droppedFrameCount,
      },
      memory: this.getMemoryStats(),
      render: this.getAggregatedRenderStats(),
      alerts: this.getAlerts(),
      suggestions: this.getOptimizationSuggestions(),
      timestamp: Date.now(),
    };
  }

  reset(): void {
    this.frameTimes = [];
    this.fpsHistory = [];
    this.memoryHistory = [];
    this.renderStatsHistory = [];
    this.alerts = [];
    this.lastFrameDelta = 0;
    this.droppedFrameCount = 0;
    this.writeIndex = 0;
  }

  private getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.frameTimes.length; i++) {
      sum += this.frameTimes[i];
    }
    return sum / this.frameTimes.length;
  }

  private pushHistory(arr: number[], value: number, maxLength: number): void {
    arr.push(value);
    if (arr.length > maxLength) {
      arr.splice(0, arr.length - maxLength);
    }
  }

  private checkFPSAlerts(): void {
    if (this.frameTimes.length < 10) return;

    const avgFPS = this.getAverageFPS();
    const now = Date.now();

    if (avgFPS < this.config.targetFPS * this.config.criticalThreshold) {
      this.pushAlert({ type: 'fps', level: 'critical', message: `FPS严重下降至 ${Math.round(avgFPS)}`, timestamp: now, value: avgFPS });
    } else if (avgFPS < this.config.targetFPS * this.config.warningThreshold) {
      this.pushAlert({ type: 'fps', level: 'warning', message: `FPS警告: ${Math.round(avgFPS)}`, timestamp: now, value: avgFPS });
    }
  }

  private checkMemoryAlerts(snapshot: MemorySnapshot): void {
    const usagePercentage = snapshot.totalJSHeapSize > 0
      ? (snapshot.usedJSHeapSize / snapshot.totalJSHeapSize) * 100
      : 0;
    const usedMB = snapshot.usedJSHeapSize / BYTES_PER_MB;
    const now = Date.now();

    if (usagePercentage > 90) {
      this.pushAlert({ type: 'memory', level: 'critical', message: `内存使用率 ${usagePercentage.toFixed(1)}%，已使用 ${usedMB.toFixed(1)}MB`, timestamp: now, value: usagePercentage });
    } else if (usagePercentage > 75) {
      this.pushAlert({ type: 'memory', level: 'warning', message: `内存使用率 ${usagePercentage.toFixed(1)}%`, timestamp: now, value: usagePercentage });
    }
  }

  private pushAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }
}
