import * as Phaser from 'phaser';

import { TaskManager } from '../systems/TaskManager';
import { TaskStatus } from '../types/Task';
import { EnhancedStatusIndicator } from './EnhancedStatusIndicator';
import { ProgressRing } from './ProgressRing';
import { PriorityPulseEffect } from './PriorityPulseEffect';

export enum DisplayMode {
  COMPACT = 'compact',
  DETAILED = 'detailed',
  FOCUS = 'focus',
  OVERVIEW = 'overview',
}

export interface SmartTaskVisualizerConfig {
  maxDisplayDistance: number;
  autoHideDelay: number;
  animationDuration: number;
  priorityThreshold: {
    high: number;
    medium: number;
    low: number;
  };
}

const DEFAULT_CONFIG: SmartTaskVisualizerConfig = {
  maxDisplayDistance: 150,
  autoHideDelay: 3000,
  animationDuration: 300,
  priorityThreshold: {
    high: 80,
    medium: 50,
    low: 20,
  },
};

export class SmartTaskVisualizer {
  private scene: Phaser.Scene;
  private taskManager: TaskManager;
  private config: SmartTaskVisualizerConfig;
  private statusIndicators: Map<string, EnhancedStatusIndicator> = new Map();
  private progressRings: Map<string, ProgressRing> = new Map();
  private priorityEffects: Map<string, PriorityPulseEffect> = new Map();
  private agentPositions: Map<string, { x: number; y: number }> = new Map();
  private selectedAgentId: string | null = null;
  private displayMode: DisplayMode = DisplayMode.COMPACT;
  private lastInteractionTime: number = Date.now();
  private dirty: boolean = true;
  private destroyed: boolean = false;

  constructor(scene: Phaser.Scene, taskManager: TaskManager, config: Partial<SmartTaskVisualizerConfig> = {}) {
    this.scene = scene;
    this.taskManager = taskManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 监听用户交互
    this.scene.input.on('pointerdown', () => {
      this.lastInteractionTime = Date.now();
      this.updateDisplayMode();
    });

    this.scene.input.keyboard!.on('keydown-TAB', () => {
      this.lastInteractionTime = Date.now();
      this.cycleDisplayMode();
    });
  }

  update(): void {
    if (this.destroyed) return;

    const now = Date.now();
    const activeTasks = this.taskManager.getAllActiveTasks();

    // 更新显示模式
    if (now - this.lastInteractionTime > 5000) {
      this.displayMode = DisplayMode.COMPACT;
    }

    // 更新每个角色的可视化
    for (const task of activeTasks) {
      this.updateAgentVisualization(task, now);
    }

    // 清理不活跃的角色
    this.cleanupInactiveAgents(activeTasks);

    this.dirty = false;
  }

  private updateAgentVisualization(task: any, now: number): void {
    const agentId = task.agentId;
    const pos = this.agentPositions.get(agentId);
    
    if (!pos) return;

    // 检查距离是否在显示范围内
    const camera = this.scene.cameras.main;
    const dx = Math.abs(pos.x - camera.scrollX - camera.width / 2);
    const dy = Math.abs(pos.y - camera.scrollY - camera.height / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);

    const shouldShow = distance <= this.config.maxDisplayDistance || 
                 agentId === this.selectedAgentId ||
                 task.progress >= this.config.priorityThreshold.high;

    // 获取或创建状态指示器
    let statusIndicator = this.statusIndicators.get(agentId);
    if (!statusIndicator && shouldShow) {
      statusIndicator = new EnhancedStatusIndicator(this.scene);
      this.statusIndicators.set(agentId, statusIndicator);
    }

    if (statusIndicator) {
      // 更新位置
      statusIndicator.setPosition(pos.x, pos.y - 50);
      
      // 根据显示模式调整大小
      let scale = 1.0;
      switch (this.displayMode) {
        case DisplayMode.COMPACT:
          scale = 0.8;
          break;
        case DisplayMode.DETAILED:
          scale = 1.2;
          break;
        case DisplayMode.FOCUS:
          scale = agentId === this.selectedAgentId ? 1.5 : 0.6;
          break;
        case DisplayMode.OVERVIEW:
          scale = 0.7;
          break;
      }
      statusIndicator.setScale(scale);
      
      // 更新状态
      statusIndicator.setStatus(task.status);
      statusIndicator.setPriority(task.metadata?.priority || 'medium');
      statusIndicator.show();
      statusIndicator.update();
    }

    // 获取或创建进度环
    let progressRing = this.progressRings.get(agentId);
    if (!progressRing && shouldShow) {
      progressRing = new ProgressRing(this.scene);
      this.progressRings.set(agentId, progressRing);
    }

    if (progressRing) {
      progressRing.setPosition(pos.x, pos.y - 30);
      
      // 根据优先级和进度调整大小
      const progressScale = this.calculateProgressScale(task);
      progressRing.setScale(progressScale);
      progressRing.setProgress(task.progress);
      progressRing.setPriority(task.metadata?.priority || 'medium');
      // ProgressRing.show() requires x,y but we already set position
      progressRing.setPosition(pos.x, pos.y - 30);
      progressRing.update();
    }

    // 获取或创建优先级脉冲效果
    let priorityEffect = this.priorityEffects.get(agentId);
    if (!priorityEffect && shouldShow && task.progress >= this.config.priorityThreshold.high) {
      priorityEffect = new PriorityPulseEffect(this.scene);
      this.priorityEffects.set(agentId, priorityEffect);
    }

    if (priorityEffect) {
      priorityEffect.setPosition(pos.x, pos.y);
      priorityEffect.setIntensity(task.progress / 100);
      priorityEffect.update();
    }

    // 自动隐藏逻辑
    if (shouldShow && now - this.lastInteractionTime > this.config.autoHideDelay) {
      if (task.status === 'completed' || task.status === 'failed') {
        this.scheduleHide(agentId);
      }
    }
  }

  private calculateProgressScale(task: any): number {
    let baseScale = 1.0;
    
    // 根据进度调整
    if (task.progress >= 80) {
      baseScale = 1.3;
    } else if (task.progress >= 50) {
      baseScale = 1.1;
    } else if (task.progress < 20) {
      baseScale = 0.8;
    }

    // 根据优先级调整
    const priority = task.metadata?.priority || 'medium';
    switch (priority) {
      case 'high':
        baseScale *= 1.2;
        break;
      case 'medium':
        baseScale *= 1.0;
        break;
      case 'low':
        baseScale *= 0.8;
        break;
    }

    return baseScale;
  }

  private scheduleHide(agentId: string): void {
    const timer = this.scene.time.delayedCall(this.config.autoHideDelay, () => {
      this.hideAgent(agentId);
    });
    
    // 保存计时器引用以便清理
    (this as any).timers = (this as any).timers || new Map();
    (this as any).timers.set(agentId, timer);
  }

  private hideAgent(agentId: string): void {
    const statusIndicator = this.statusIndicators.get(agentId);
    const progressRing = this.progressRings.get(agentId);
    const priorityEffect = this.priorityEffects.get(agentId);

    if (statusIndicator) {
      statusIndicator.hide();
    }
    if (progressRing) {
      progressRing.hide();
    }
    if (priorityEffect) {
      priorityEffect.hide();
    }

    // 延迟销毁
    this.scene.time.delayedCall(1000, () => {
      this.cleanupAgent(agentId);
    });
  }

  private cleanupAgent(agentId: string): void {
    const statusIndicator = this.statusIndicators.get(agentId);
    const progressRing = this.progressRings.get(agentId);
    const priorityEffect = this.priorityEffects.get(agentId);
    const timer = (this as any).timers?.get(agentId);

    if (timer) {
      timer.remove(false);
      (this as any).timers.delete(agentId);
    }

    if (statusIndicator) {
      statusIndicator.destroy();
      this.statusIndicators.delete(agentId);
    }
    if (progressRing) {
      progressRing.destroy();
      this.progressRings.delete(agentId);
    }
    if (priorityEffect) {
      priorityEffect.destroy();
      this.priorityEffects.delete(agentId);
    }
  }

  private cleanupInactiveAgents(activeTasks: any[]): void {
    const activeAgentIds = new Set(activeTasks.map(t => t.agentId));
    
    for (const [agentId] of this.statusIndicators.entries()) {
      if (!activeAgentIds.has(agentId)) {
        this.cleanupAgent(agentId);
      }
    }
  }

  updateAgentPosition(agentId: string, x: number, y: number): void {
    this.agentPositions.set(agentId, { x, y });
    this.dirty = true;
  }

  selectAgent(agentId: string): void {
    this.selectedAgentId = agentId;
    this.lastInteractionTime = Date.now();
    this.updateDisplayMode();
    this.dirty = true;
  }

  deselectAgent(): void {
    this.selectedAgentId = null;
    this.displayMode = DisplayMode.COMPACT;
    this.dirty = true;
  }

  private updateDisplayMode(): void {
    if (this.selectedAgentId) {
      this.displayMode = DisplayMode.FOCUS;
    } else {
      this.displayMode = DisplayMode.COMPACT;
    }
  }

  private cycleDisplayMode(): void {
    const modes = [DisplayMode.COMPACT, DisplayMode.DETAILED, DisplayMode.OVERVIEW];
    const currentIndex = modes.indexOf(this.displayMode);
    this.displayMode = modes[(currentIndex + 1) % modes.length];
    this.dirty = true;
  }

  setDisplayMode(mode: DisplayMode): void {
    this.displayMode = mode;
    this.dirty = true;
  }

  getDisplayMode(): DisplayMode {
    return this.displayMode;
  }

  destroy(): void {
    this.destroyed = true;
    
    // 清理所有计时器
    if ((this as any).timers) {
      for (const timer of (this as any).timers.values()) {
        timer.remove(false);
      }
      (this as any).timers.clear();
    }

    // 销毁所有可视化组件
    for (const indicator of this.statusIndicators.values()) {
      indicator.destroy();
    }
    for (const ring of this.progressRings.values()) {
      ring.destroy();
    }
    for (const effect of this.priorityEffects.values()) {
      effect.destroy();
    }

    this.statusIndicators.clear();
    this.progressRings.clear();
    this.priorityEffects.clear();
    this.agentPositions.clear();
  }

  getStatusIndicator(agentId: string): EnhancedStatusIndicator | undefined {
    return this.statusIndicators.get(agentId);
  }

  getProgressRing(agentId: string): ProgressRing | undefined {
    return this.progressRings.get(agentId);
  }

  getPriorityEffect(agentId: string): PriorityPulseEffect | undefined {
    return this.priorityEffects.get(agentId);
  }

  // 便捷方法：快速更新所有可视化
  refresh(): void {
    this.dirty = true;
  }
}