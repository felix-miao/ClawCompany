import Phaser from 'phaser';
import { TaskStatus } from '../types/Task';

const STATUS_COLORS: Record<TaskStatus, number> = {
  pending: 0x9CA3AF,
  assigned: 0x3B82F6,
  working: 0xF59E0B,
  reviewing: 0x8B5CF6,
  completed: 0x10B981,
  failed: 0xEF4444,
};

const DEFAULT_TEXT: Record<TaskStatus, string> = {
  pending: 'Waiting...',
  assigned: 'Task received',
  working: 'Working...',
  reviewing: 'Reviewing...',
  completed: 'Done!',
  failed: 'Failed',
};

const MIN_WIDTH = 80;
const MAX_WIDTH = 160;
const BUBBLE_HEIGHT = 28;
const PADDING = 12;
const FONT_SIZE = '12px';
const FADE_DURATION = 200;

export class TaskBubble {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private status: TaskStatus = 'pending';
  private displayText: string = '';
  private dirty: boolean = true;
  private targetAlpha: number = 0;
  private currentAlpha: number = 0;
  private destroyed: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);

    this.background = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', {
      fontSize: FONT_SIZE,
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    this.text.setOrigin(0.5);

    this.container.add([this.background, this.text]);
    this.container.setAlpha(0);
  }

  setStatus(status: TaskStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.dirty = true;
  }

  setText(text: string): void {
    if (this.displayText === text) return;
    this.displayText = text;
    this.dirty = true;
  }

  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  show(x: number, y: number, status: TaskStatus, text: string): void {
    this.container.setPosition(x, y);
    this.setStatus(status);
    this.setText(text || DEFAULT_TEXT[status]);
    this.targetAlpha = 0.85;
    this.dirty = true;
  }

  hide(): void {
    this.targetAlpha = 0;
  }

  update(): void {
    if (this.destroyed) return;

    this.currentAlpha += (this.targetAlpha - this.currentAlpha) * 0.15;
    if (Math.abs(this.currentAlpha - this.targetAlpha) < 0.01) {
      this.currentAlpha = this.targetAlpha;
    }
    this.container.setAlpha(this.currentAlpha);

    if (this.dirty) {
      this.redraw();
      this.dirty = false;
    }
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  getStatus(): TaskStatus {
    return this.status;
  }

  isActive(): boolean {
    return this.currentAlpha > 0.01;
  }

  destroy(): void {
    this.destroyed = true;
    this.background.destroy();
    this.text.destroy();
    this.container.destroy();
  }

  private redraw(): void {
    this.background.clear();

    const color = STATUS_COLORS[this.status] ?? STATUS_COLORS.pending;
    const text = this.displayText || DEFAULT_TEXT[this.status];

    this.text.setText(text);

    const textWidth = this.text.width;
    const bubbleWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, textWidth + PADDING * 2));

    this.background.fillStyle(color, 1);
    this.background.fillRoundedRect(
      -bubbleWidth / 2,
      -BUBBLE_HEIGHT / 2,
      bubbleWidth,
      BUBBLE_HEIGHT,
      6
    );

    this.text.setPosition(0, 0);
  }
}
