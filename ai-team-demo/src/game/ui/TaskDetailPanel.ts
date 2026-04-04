import Phaser from 'phaser';
import { Task, TaskStatus } from '../types/Task';

export interface TaskDetailPanelConfig {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
}

const PANEL_WIDTH = 240;
const PANEL_HEIGHT = 200;
const BORDER_RADIUS = 8;
const PADDING = 14;
const FONT_SIZE = '14px';
const SMALL_FONT_SIZE = '11px';
const BG_COLOR = 0x1a1a2e;
const BG_ALPHA = 0.9;
const PROGRESS_BAR_HEIGHT = 6;
const CLOSE_BUTTON_SIZE = 16;
const FADE_DURATION = 200;

export class TaskDetailPanel {
  static readonly PRIORITY_COLORS = {
    high: 0xEF4444,
    medium: 0xF59E0B,
    low: 0x10B981,
  } as const;

  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private borderGraphics: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private descriptionText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private progressLabel: Phaser.GameObjects.Text;
  private progressGraphics: Phaser.GameObjects.Graphics;
  private actionText: Phaser.GameObjects.Text;
  private typeText: Phaser.GameObjects.Text;
  private priorityText: Phaser.GameObjects.Text;
  private timeText: Phaser.GameObjects.Text;
  private closeButtonGraphics: Phaser.GameObjects.Graphics;
  private closeButtonText: Phaser.GameObjects.Text;

  private currentTask: Task;
  private onClose: () => void;
  private destroyed: boolean = false;
  private x: number = 0;
  private y: number = 0;

  constructor(scene: Phaser.Scene, config: TaskDetailPanelConfig) {
    this.scene = scene;
    this.currentTask = config.task;
    this.onClose = config.onClose;
    this.x = config.position.x;
    this.y = config.position.y;

    this.container = scene.add.container(this.x, this.y);
    this.container.setDepth(200);

    this.background = scene.add.graphics();
    this.borderGraphics = scene.add.graphics();
    this.closeButtonGraphics = scene.add.graphics();

    this.titleText = scene.add.text(0, 0, '', {
      fontSize: '13px',
      color: '#9CA3AF',
      fontFamily: 'Arial',
    });

    this.descriptionText = scene.add.text(0, 0, '', {
      fontSize: FONT_SIZE,
      color: '#ffffff',
      fontFamily: 'Arial',
      wordWrap: { width: PANEL_WIDTH - PADDING * 2 },
    });

    this.statusText = scene.add.text(0, 0, '', {
      fontSize: SMALL_FONT_SIZE,
      color: '#9CA3AF',
      fontFamily: 'Arial',
    });

    this.progressLabel = scene.add.text(0, 0, '', {
      fontSize: SMALL_FONT_SIZE,
      color: '#9CA3AF',
      fontFamily: 'Arial',
    });

    this.progressGraphics = scene.add.graphics();

    this.actionText = scene.add.text(0, 0, '', {
      fontSize: SMALL_FONT_SIZE,
      color: '#D1D5DB',
      fontFamily: 'Arial',
    });

    this.typeText = scene.add.text(0, 0, '', {
      fontSize: SMALL_FONT_SIZE,
      color: '#9CA3AF',
      fontFamily: 'Arial',
    });

    this.priorityText = scene.add.text(0, 0, '', {
      fontSize: SMALL_FONT_SIZE,
      color: '#9CA3AF',
      fontFamily: 'Arial',
    });

    this.timeText = scene.add.text(0, 0, '', {
      fontSize: SMALL_FONT_SIZE,
      color: '#6B7280',
      fontFamily: 'Arial',
    });

    this.closeButtonText = scene.add.text(0, 0, '✕', {
      fontSize: '12px',
      color: '#9CA3AF',
      fontFamily: 'Arial',
    });
    this.closeButtonText.setOrigin(0.5);
    this.closeButtonText.setInteractive({ useHandCursor: true });
    this.closeButtonText.on('pointerdown', () => this.close());

    this.container.add([
      this.background,
      this.borderGraphics,
      this.titleText,
      this.descriptionText,
      this.statusText,
      this.progressLabel,
      this.progressGraphics,
      this.actionText,
      this.typeText,
      this.priorityText,
      this.timeText,
      this.closeButtonGraphics,
      this.closeButtonText,
    ]);

    this.container.setAlpha(0);

    this.layout();
    this.drawBackground();

    scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: FADE_DURATION,
      ease: 'Power2',
    });
  }

  update(task: Task): void {
    if (this.destroyed) return;
    this.currentTask = task;
    this.layout();
    this.drawBackground();
  }

  getDescriptionText(): string {
    return this.currentTask.description;
  }

  getProgress(): number {
    return this.currentTask.progress;
  }

  getStatus(): TaskStatus {
    return this.currentTask.status;
  }

  getTaskType(): string {
    return this.currentTask.taskType;
  }

  getCurrentAction(): string {
    return this.currentTask.currentAction;
  }

  getPriority(): 'high' | 'medium' | 'low' {
    return this.currentTask.metadata?.priority ?? 'medium';
  }

  getElapsedTime(): number {
    if (!this.currentTask.assignedAt) return 0;
    return Date.now() - this.currentTask.assignedAt;
  }

  getBorderColor(): number {
    const priority = this.getPriority();
    return TaskDetailPanel.PRIORITY_COLORS[priority];
  }

  close(): void {
    if (this.destroyed) return;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: FADE_DURATION,
      ease: 'Power2',
      onComplete: () => {
        this.onClose();
      },
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.background.destroy();
    this.borderGraphics.destroy();
    this.titleText.destroy();
    this.descriptionText.destroy();
    this.statusText.destroy();
    this.progressLabel.destroy();
    this.progressGraphics.destroy();
    this.actionText.destroy();
    this.typeText.destroy();
    this.priorityText.destroy();
    this.timeText.destroy();
    this.closeButtonGraphics.destroy();
    this.closeButtonText.destroy();
    this.container.destroy();
  }

  private layout(): void {
    const task = this.currentTask;
    const leftX = -PANEL_WIDTH / 2 + PADDING;
    let curY = -PANEL_HEIGHT / 2 + PADDING;

    this.titleText.setText('TASK DETAILS');
    this.titleText.setPosition(leftX, curY);
    curY += 18;

    this.descriptionText.setText(task.description);
    this.descriptionText.setPosition(leftX, curY);
    curY += Math.max(this.descriptionText.height, 20) + 6;

    this.statusText.setText(`Status: ${task.status}`);
    this.statusText.setPosition(leftX, curY);
    curY += 16;

    this.progressLabel.setText(`Progress: ${task.progress}%`);
    this.progressLabel.setPosition(leftX, curY);
    curY += 14;

    this.actionText.setText(`Action: ${task.currentAction}`);
    this.actionText.setPosition(leftX, curY);
    curY += 16;

    this.typeText.setText(`Type: ${task.taskType}`);
    this.typeText.setPosition(leftX, curY);
    curY += 16;

    const priority = task.metadata?.priority ?? 'medium';
    this.priorityText.setText(`Priority: ${priority}`);
    this.priorityText.setPosition(leftX, curY);
    curY += 16;

    const elapsed = this.getElapsedTime();
    const elapsedSec = Math.floor(elapsed / 1000);
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    this.timeText.setText(`Time: ${minutes}m ${seconds}s`);
    this.timeText.setPosition(leftX, curY);

    const closeX = PANEL_WIDTH / 2 - PADDING - CLOSE_BUTTON_SIZE / 2;
    const closeY = -PANEL_HEIGHT / 2 + PADDING + CLOSE_BUTTON_SIZE / 2;
    this.closeButtonGraphics.setPosition(closeX, closeY);
    this.closeButtonText.setPosition(closeX, closeY);
  }

  private drawBackground(): void {
    this.background.clear();
    this.borderGraphics.clear();
    this.progressGraphics.clear();

    const borderColor = this.getBorderColor();
    const halfW = PANEL_WIDTH / 2;
    const halfH = PANEL_HEIGHT / 2;

    this.borderGraphics.fillStyle(borderColor, 1);
    this.borderGraphics.fillRoundedRect(-halfW, -halfH, PANEL_WIDTH, PANEL_HEIGHT, BORDER_RADIUS);

    this.background.fillStyle(BG_COLOR, BG_ALPHA);
    this.background.fillRoundedRect(-halfW + 2, -halfH + 2, PANEL_WIDTH - 4, PANEL_HEIGHT - 4, BORDER_RADIUS - 1);

    const barY = this.progressLabel.y + 12;
    const barX = -PANEL_WIDTH / 2 + PADDING;
    const barWidth = PANEL_WIDTH - PADDING * 2;
    this.progressGraphics.fillStyle(0x374151, 1);
    this.progressGraphics.fillRoundedRect(barX, barY, barWidth, PROGRESS_BAR_HEIGHT, 3);

    const fillWidth = (this.currentTask.progress / 100) * barWidth;
    this.progressGraphics.fillStyle(borderColor, 1);
    this.progressGraphics.fillRoundedRect(barX, barY, fillWidth, PROGRESS_BAR_HEIGHT, 3);

    const closeX = PANEL_WIDTH / 2 - PADDING - CLOSE_BUTTON_SIZE / 2;
    const closeY = -PANEL_HEIGHT / 2 + PADDING + CLOSE_BUTTON_SIZE / 2;
    this.closeButtonGraphics.setPosition(closeX, closeY);
    this.closeButtonGraphics.fillStyle(0x374151, 0.5);
    this.closeButtonGraphics.fillRoundedRect(
      -CLOSE_BUTTON_SIZE / 2,
      -CLOSE_BUTTON_SIZE / 2,
      CLOSE_BUTTON_SIZE,
      CLOSE_BUTTON_SIZE,
      4
    );
  }
}
