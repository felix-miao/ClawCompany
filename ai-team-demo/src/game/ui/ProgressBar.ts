import Phaser from 'phaser';

const BAR_WIDTH = 60;
const BAR_HEIGHT = 4;
const BG_COLOR = 0x374151;

const PROGRESS_COLORS = [
  { threshold: 30, color: 0xEF4444 },
  { threshold: 70, color: 0xF59E0B },
  { threshold: 101, color: 0x10B981 },
];

const PRIORITY_PROGRESS_COLORS: Record<string, number> = {
  high: 0xEF4444,
  medium: 0xF59E0B,
  low: 0x10B981,
};

export class ProgressBar {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private targetProgress: number = 0;
  private displayedProgress: number = 0;
  private priority: string | null = null;
  private destroyed: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);
    this.graphics.setAlpha(0);
  }

  setProgress(progress: number): void {
    this.targetProgress = Math.max(0, Math.min(100, progress));
  }

  setPriority(priority: string): void {
    this.priority = priority;
  }

  getPriority(): string | null {
    return this.priority;
  }

  getProgressColor(): number {
    if (this.priority && PRIORITY_PROGRESS_COLORS[this.priority]) {
      return PRIORITY_PROGRESS_COLORS[this.priority];
    }
    for (const { threshold, color } of PROGRESS_COLORS) {
      if (this.displayedProgress < threshold) return color;
    }
    return 0x10B981;
  }

  show(x: number, y: number): void {
    this.graphics.setPosition(x, y);
    this.graphics.setAlpha(0.85);
  }

  hide(): void {
    this.graphics.setAlpha(0);
  }

  setPosition(x: number, y: number): void {
    this.graphics.setPosition(x, y);
  }

  update(): void {
    if (this.destroyed) return;

    const diff = this.targetProgress - this.displayedProgress;
    if (Math.abs(diff) > 0.5) {
      this.displayedProgress += diff * 0.15;
    } else {
      this.displayedProgress = this.targetProgress;
    }

    this.redraw();
  }

  getProgress(): number {
    return this.displayedProgress;
  }

  isActive(): boolean {
    return this.graphics.alpha > 0.01;
  }

  destroy(): void {
    this.destroyed = true;
    this.graphics.destroy();
  }

  private redraw(): void {
    this.graphics.clear();

    this.graphics.fillStyle(BG_COLOR, 1);
    this.graphics.fillRect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT);

    const fillWidth = (this.displayedProgress / 100) * BAR_WIDTH;
    const color = this.getProgressColor();
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, fillWidth, BAR_HEIGHT);
  }
}
