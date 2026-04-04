import * as Phaser from 'phaser';
import { TaskManager } from '../systems/TaskManager';
import { Task } from '../types/Task';
import { QueueItem } from './QueueItem';

const MAX_VISIBLE_ITEMS = 5;
const QUEUE_LABEL_FONT_SIZE = '13px';
const QUEUE_LABEL_COLOR = '#9CA3AF';
const HEADER_HEIGHT = 22;
const PADDING = 8;

export class TaskQueueIndicator {
  private scene: Phaser.Scene;
  private taskManager: TaskManager;
  private container: Phaser.GameObjects.Container;
  private queueItems: QueueItem[] = [];
  private headerText: Phaser.GameObjects.Text;
  private onTaskClick: ((task: Task) => void) | null = null;
  private destroyed: boolean = false;
  private x: number = 0;
  private y: number = 0;

  constructor(scene: Phaser.Scene, taskManager: TaskManager) {
    this.scene = scene;
    this.taskManager = taskManager;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(150);

    this.headerText = scene.add.text(0, 0, '', {
      fontSize: QUEUE_LABEL_FONT_SIZE,
      color: QUEUE_LABEL_COLOR,
      fontFamily: 'Arial',
    });

    this.container.add(this.headerText);
  }

  update(): void {
    if (this.destroyed) return;
    const queue = this.taskManager.getQueue();
    this.updateQueue(queue);
  }

  updateQueue(tasks: Task[]): void {
    if (this.destroyed) return;

    this.clearItems();

    const visibleTasks = tasks.slice(0, MAX_VISIBLE_ITEMS);
    visibleTasks.forEach((task, index) => {
      const item = new QueueItem(this.scene, task, index);
      item.setPosition(0, HEADER_HEIGHT + PADDING + index * 30);
      if (this.onTaskClick) {
        item.setInteractive(this.onTaskClick);
      }
      this.queueItems.push(item);
      this.container.add(item.getContainer());
    });

    this.headerText.setText(this.formatQueueLength(tasks.length));
  }

  setOnTaskClick(callback: (task: Task) => void): void {
    this.onTaskClick = callback;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.container.setPosition(x, y);
  }

  getQueueLength(): number {
    return this.taskManager.getQueue().length;
  }

  getVisibleItemCount(): number {
    return this.queueItems.length;
  }

  getQueueLengthText(): string {
    return this.headerText.text;
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearItems();
    this.headerText.destroy();
    this.container.destroy();
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  private clearItems(): void {
    for (const item of this.queueItems) {
      this.container.remove(item.getContainer());
      item.destroy();
    }
    this.queueItems = [];
  }

  private formatQueueLength(count: number): string {
    return `队列: ${count} 个任务`;
  }
}
