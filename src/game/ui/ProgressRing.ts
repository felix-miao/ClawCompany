import * as Phaser from 'phaser';

const RING_RADIUS = 20;
const RING_THICKNESS = 4;
const BACKGROUND_COLOR = 0x374151;
const PROGRESS_COLORS = [
  { threshold: 30, color: 0xEF4444 },
  { threshold: 70, color: 0xF59E0B },
  { threshold: 101, color: 0x10B981 },
];

const PRIORITY_COLORS: Record<string, number> = {
  high: 0xEF4444,
  medium: 0xF59E0B,
  low: 0x10B981,
};

const ANIMATION_SPEED = 0.15;
const FADE_DURATION = 200;

export class ProgressRing {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private targetProgress: number = 0;
  private displayedProgress: number = 0;
  private priority: string | null = null;
  private targetAlpha: number = 0;
  private currentAlpha: number = 0;
  private destroyed: boolean = false;
  private dirty: boolean = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(120);
    this.graphics.setAlpha(0);
  }

  setProgress(progress: number): void {
    this.targetProgress = Math.max(0, Math.min(100, progress));
    this.dirty = true;
  }

  setPriority(priority: string): void {
    this.priority = priority;
    this.dirty = true;
  }

  getPriority(): string | null {
    return this.priority;
  }

  getPosition(): { x: number; y: number } {
    return { x: this.graphics.x, y: this.graphics.y };
  }

  show(x: number, y: number): void {
    this.graphics.setPosition(x, y);
    this.targetAlpha = 0.9;
    this.dirty = true;
  }

  hide(): void {
    this.targetAlpha = 0;
  }

  setPosition(x: number, y: number): void {
    this.graphics.setPosition(x, y);
  }

  setScale(scale: number): void {
    this.graphics.setScale(scale);
  }

  update(): void {
    if (this.destroyed) return;

    // 平滑进度动画
    const diff = this.targetProgress - this.displayedProgress;
    if (Math.abs(diff) > 0.5) {
      this.displayedProgress += diff * ANIMATION_SPEED;
    } else {
      this.displayedProgress = this.targetProgress;
    }

    // 平滑透明度动画
    const alphaDiff = this.targetAlpha - this.currentAlpha;
    if (Math.abs(alphaDiff) > 0.01) {
      this.currentAlpha += alphaDiff * ANIMATION_SPEED;
      this.graphics.setAlpha(this.currentAlpha);
    }

    if (this.dirty) {
      this.redraw();
      this.dirty = false;
    }
  }

  getProgress(): number {
    return this.displayedProgress;
  }

  isActive(): boolean {
    return this.currentAlpha > 0.01;
  }

  destroy(): void {
    this.destroyed = true;
    this.graphics.destroy();
  }

  private redraw(): void {
    this.graphics.clear();

    // 绘制背景圆环
    this.graphics.lineStyle(RING_THICKNESS, BACKGROUND_COLOR, 1);
    this.graphics.strokeCircle(0, 0, RING_RADIUS);

    // 绘制进度圆环
    const progressAngle = (this.displayedProgress / 100) * Math.PI * 2;
    const color = this.getProgressColor();
    this.graphics.lineStyle(RING_THICKNESS, color, 1);
    
    if (progressAngle > 0) {
      this.graphics.beginPath();
      this.graphics.moveTo(RING_RADIUS, 0);
      this.graphics.arc(0, 0, RING_RADIUS, -Math.PI / 2, -Math.PI / 2 + progressAngle);
      this.graphics.strokePath();
    }

    // 绘制进度文本
    if (this.displayedProgress > 10) { // 只在进度大于10%时显示文本
      const progressText = Math.round(this.displayedProgress) + '%';
      const text = this.scene.add.text(0, 0, progressText, {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial',
        align: 'center',
      });
      text.setOrigin(0.5);
      text.setDepth(121);
      text.setPosition(0, 0);
      
      // 临时保存文本引用以便在下一次重绘时清理
      (this as any).lastText = text;
    }

    // 清理之前的文本
    if ((this as any).lastText && (this as any).lastText !== undefined) {
      const text = (this as any).lastText;
      if (text && text.text !== `${Math.round(this.displayedProgress)}%`) {
        text.destroy();
        (this as any).lastText = undefined;
      }
    }
  }

  private getProgressColor(): number {
    // 优先使用优先级颜色
    if (this.priority && PRIORITY_COLORS[this.priority]) {
      return PRIORITY_COLORS[this.priority];
    }
    
    // 否则根据进度选择颜色
    for (const { threshold, color } of PROGRESS_COLORS) {
      if (this.displayedProgress < threshold) return color;
    }
    return 0x10B981;
  }
}