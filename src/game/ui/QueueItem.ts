import * as Phaser from 'phaser';

import { Task } from '../types/Task';
import { TaskDetailPanel } from './TaskDetailPanel';

const ITEM_WIDTH = 220;
const ITEM_HEIGHT = 28;
const BORDER_RADIUS = 4;
const TEXT_MAX_LENGTH = 28;
const FONT_SIZE = '12px';

export class QueueItem {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private task: Task;
  private destroyed: boolean = false;

  constructor(scene: Phaser.Scene, task: Task, index: number) {
    this.scene = scene;
    this.task = task;
    this.container = scene.add.container(0, index * (ITEM_HEIGHT + 2));

    this.background = scene.add.graphics();
    this.drawBackground();

    const description = this.truncateText(task.description, TEXT_MAX_LENGTH);
    this.text = scene.add.text(10, 6, description, {
      fontSize: FONT_SIZE,
      color: '#ffffff',
      fontFamily: 'Arial',
    });

    this.container.add([this.background, this.text]);
    this.container.setDepth(150);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  getTask(): Task {
    return this.task;
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setInteractive(callback: (task: Task) => void): void {
    this.background.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, ITEM_WIDTH, ITEM_HEIGHT),
      Phaser.Geom.Rectangle.Contains
    );
    this.background.on('pointerdown', () => callback(this.task));
    this.background.on('pointerover', () => {
      this.background.clear();
      this.drawBackground(0.5);
    });
    this.background.on('pointerout', () => {
      this.background.clear();
      this.drawBackground(0.3);
    });
  }

  updateTask(task: Task): void {
    this.task = task;
    const description = this.truncateText(task.description, TEXT_MAX_LENGTH);
    this.text.setText(description);
    this.background.clear();
    this.drawBackground();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.background.destroy();
    this.text.destroy();
    this.container.destroy();
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  private drawBackground(alpha: number = 0.3): void {
    const priority = this.task.metadata?.priority || 'medium';
    const color = TaskDetailPanel.PRIORITY_COLORS[priority];
    this.background.fillStyle(color, alpha);
    this.background.fillRoundedRect(0, 0, ITEM_WIDTH, ITEM_HEIGHT, BORDER_RADIUS);
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
