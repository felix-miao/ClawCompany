import * as Phaser from 'phaser';

import { TaskStatus } from '../types/Task';

const STATUS_CONFIG = {
  // 状态对应的图标和颜色
  pending: {
    icon: '⏳',
    color: 0x9CA3AF,
    bgColor: 0x374151,
    scale: 1.0,
    pulse: false,
  },
  assigned: {
    icon: '📋',
    color: 0x3B82F6,
    bgColor: 0x1E40AF,
    scale: 1.1,
    pulse: true,
  },
  working: {
    icon: '💻',
    color: 0xF59E0B,
    bgColor: 0xD97706,
    scale: 1.2,
    pulse: true,
  },
  reviewing: {
    icon: '🔍',
    color: 0x8B5CF6,
    bgColor: 0x7C3AED,
    scale: 1.1,
    pulse: true,
  },
  completed: {
    icon: '✅',
    color: 0x10B981,
    bgColor: 0x059669,
    scale: 1.3,
    pulse: false,
  },
  failed: {
    icon: '❌',
    color: 0xEF4444,
    bgColor: 0xDC2626,
    scale: 1.1,
    pulse: true,
  },
} as const;

const PRIORITY_CONFIG = {
  high: {
    borderColor: 0xEF4444,
    glowColor: 0xFF0000,
    borderWidth: 3,
    glowIntensity: 1,
  },
  medium: {
    borderColor: 0xF59E0B,
    glowColor: 0xFFA500,
    borderWidth: 2,
    glowIntensity: 0.8,
  },
  low: {
    borderColor: 0x10B981,
    glowColor: 0x00FF00,
    borderWidth: 1,
    glowIntensity: 0.5,
  },
} as const;

const ANIMATION_DURATION = 300;
const PULSE_DURATION = 1000;
const GLOW_DURATION = 2000;

export class EnhancedStatusIndicator {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private borderGraphics: Phaser.GameObjects.Graphics;
  private icon: Phaser.GameObjects.Text;
  private glowEffect: Phaser.GameObjects.Graphics;
  private status: TaskStatus = 'pending';
  private priority: 'high' | 'medium' | 'low' = 'medium';
  private targetScale: number = 1.0;
  private currentScale: number = 1.0;
  private targetAlpha: number = 1.0;
  private currentAlpha: number = 1.0;
  private dirty: boolean = true;
  private destroyed: boolean = false;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private glowTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(150);

    this.background = scene.add.graphics();
    this.borderGraphics = scene.add.graphics();
    this.icon = scene.add.text(0, 0, '', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    this.icon.setOrigin(0.5);
    this.icon.setDepth(2);

    this.glowEffect = scene.add.graphics();
    this.glowEffect.setBlendMode(Phaser.BlendModes.ADD);
    this.glowEffect.setDepth(1);

    this.container.add([this.glowEffect, this.borderGraphics, this.background, this.icon]);
    this.container.setAlpha(0);
    this.container.setScale(1.0);
  }

  setStatus(status: TaskStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.targetScale = STATUS_CONFIG[status].scale;
    this.dirty = true;
    this.updateAnimation();
  }

  setPriority(priority: 'high' | 'medium' | 'low'): void {
    if (this.priority === priority) return;
    this.priority = priority;
    this.dirty = true;
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  show(): void {
    this.targetAlpha = 1.0;
    this.container.setAlpha(this.targetAlpha);
  }

  hide(): void {
    this.targetAlpha = 0.0;
    this.container.setAlpha(this.targetAlpha);
  }

  update(): void {
    if (this.destroyed) return;

    // 平滑缩放动画
    if (Math.abs(this.currentScale - this.targetScale) > 0.01) {
      this.currentScale += (this.targetScale - this.currentScale) * 0.15;
      this.container.setScale(this.currentScale);
    }

    // 更新透明度
    const targetAlpha = this.container.alpha;
    const newAlpha = targetAlpha + (this.targetAlpha - targetAlpha) * 0.15;
    if (Math.abs(newAlpha - targetAlpha) > 0.01) {
      this.container.setAlpha(newAlpha);
    }

    if (this.dirty) {
      this.redraw();
      this.dirty = false;
    }
  }

  destroy(): void {
    this.destroyed = true;
    
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    
    if (this.glowTween) {
      this.glowTween.stop();
      this.glowTween = null;
    }
    
    this.background.destroy();
    this.borderGraphics.destroy();
    this.icon.destroy();
    this.glowEffect.destroy();
    this.container.destroy();
  }

  private updateAnimation(): void {
    const config = STATUS_CONFIG[this.status];
    
    // 脉冲效果
    if (config.pulse && !this.pulseTween) {
      this.pulseTween = this.scene.tweens.add({
        targets: this.container,
        scale: this.currentScale * 1.2,
        duration: PULSE_DURATION / 2,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!config.pulse && this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }

    // 发光效果
    const priorityConfig = PRIORITY_CONFIG[this.priority];
    if (priorityConfig.glowIntensity > 0.5) {
      if (!this.glowTween) {
        this.glowTween = this.scene.tweens.add({
          targets: this.glowEffect,
          alpha: 0.3,
          duration: GLOW_DURATION / 2,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    } else if (this.glowTween) {
      this.glowTween.stop();
      this.glowTween = null;
    }
  }

  private redraw(): void {
    const config = STATUS_CONFIG[this.status];
    const priorityConfig = PRIORITY_CONFIG[this.priority];

    // 清除之前的绘制
    this.background.clear();
    this.borderGraphics.clear();
    this.glowEffect.clear();

    // 绘制发光效果
    if (priorityConfig.glowIntensity > 0.3) {
      this.glowEffect.fillStyle(priorityConfig.glowColor, 0.2 * priorityConfig.glowIntensity);
      this.glowEffect.fillCircle(0, 0, 35);
    }

    // 绘制背景
    this.background.fillStyle(config.bgColor, 1);
    this.background.fillCircle(0, 0, 25);

    // 绘制边框
    this.borderGraphics.lineStyle(priorityConfig.borderWidth, priorityConfig.borderColor, 1);
    this.borderGraphics.strokeCircle(0, 0, 25);

    // 绘制状态图标
    this.icon.setText(config.icon);
    this.icon.setPosition(0, 0);
  }

  getStatus(): TaskStatus {
    return this.status;
  }

  getPriority(): string {
    return this.priority;
  }

  isActive(): boolean {
    return this.container.alpha > 0.01;
  }

  setScale(scale: number): void {
    this.targetScale = scale;
  }
}