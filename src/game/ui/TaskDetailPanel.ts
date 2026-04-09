import * as Phaser from 'phaser';

import { TaskArtifact } from '../../lib/core/types';
import { Task, TaskStatus } from '../types/Task';

export interface TaskDetailPanelConfig {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
  eventBus?: { emit: (type: string, event: unknown) => unknown };
}

const PANEL_WIDTH = 240;
const BASE_PANEL_HEIGHT = 200;
const BORDER_RADIUS = 8;
const PADDING = 14;
const FONT_SIZE = '14px';
const SMALL_FONT_SIZE = '11px';
const BG_COLOR = 0x1a1a2e;
const BG_ALPHA = 0.9;
const PROGRESS_BAR_HEIGHT = 6;
const CLOSE_BUTTON_SIZE = 16;
const FADE_DURATION = 200;
const ARTIFACT_CARD_HEIGHT = 48;
const ARTIFACT_CARD_GAP = 6;
const ARTIFACTS_SECTION_HEADER = 22;
const ARTIFACT_ICON_SIZE = 20;
const ARTIFACT_BUTTON_PADDING = 6;

const ARTIFACT_TYPE_COLORS: Record<TaskArtifact['type'], number> = {
  html: 0xF97316,
  code: 0x8B5CF6,
  image: 0x3B82F6,
  file: 0x6B7280,
};

const ARTIFACT_TYPE_ICONS: Record<TaskArtifact['type'], string> = {
  html: '🌐',
  code: '<>',
  image: '🖼',
  file: '📄',
};

interface ArtifactUIElements {
  container: Phaser.GameObjects.Container;
  cardGraphics: Phaser.GameObjects.Graphics;
  iconText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  buttons: Phaser.GameObjects.Text[];
}

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
  private artifactsHeaderText: Phaser.GameObjects.Text;
  private artifactsSectionGraphics: Phaser.GameObjects.Graphics;

  private currentTask: Task;
  private onClose: () => void;
  private destroyed: boolean = false;
  private x: number = 0;
  private y: number = 0;
  private clickHandler: (pointer: Phaser.Input.Pointer) => void;
  private eventBus?: { emit: (type: string, event: unknown) => unknown };
  private artifactElements: ArtifactUIElements[] = [];

  constructor(scene: Phaser.Scene, config: TaskDetailPanelConfig) {
    this.scene = scene;
    this.currentTask = config.task;
    this.onClose = config.onClose;
    this.eventBus = config.eventBus;
    this.x = config.position.x;
    this.y = config.position.y;

    this.container = scene.add.container(this.x, this.y);
    this.container.setDepth(200);

    this.background = scene.add.graphics();
    this.borderGraphics = scene.add.graphics();
    this.closeButtonGraphics = scene.add.graphics();
    this.artifactsSectionGraphics = scene.add.graphics();

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

    this.artifactsHeaderText = scene.add.text(0, 0, '', {
      fontSize: SMALL_FONT_SIZE,
      color: '#9CA3AF',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    });

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
      this.artifactsSectionGraphics,
      this.artifactsHeaderText,
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

    this.clickHandler = (pointer: Phaser.Input.Pointer) => {
      const containerBounds = this.container.getBounds();
      if (!containerBounds.contains(pointer.worldX, pointer.worldY)) {
        this.close();
      }
    };
    scene.input.on('pointerdown', this.clickHandler);
  }

  getArtifacts(): TaskArtifact[] {
    return this.currentTask.metadata?.artifacts ?? [];
  }

  getPanelHeight(): number {
    const artifacts = this.getArtifacts();
    if (artifacts.length === 0) return BASE_PANEL_HEIGHT;
    return BASE_PANEL_HEIGHT + ARTIFACTS_SECTION_HEADER + artifacts.length * (ARTIFACT_CARD_HEIGHT + ARTIFACT_CARD_GAP);
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

    this.scene.input.off('pointerdown', this.clickHandler);

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

    this.scene.input.off('pointerdown', this.clickHandler);

    this.clearArtifactElements();
    this.artifactsHeaderText.destroy();
    this.artifactsSectionGraphics.destroy();
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

  private clearArtifactElements(): void {
    for (const elements of this.artifactElements) {
      this.container.remove(elements.container);
      elements.container.destroy(true);
    }
    this.artifactElements = [];
  }

  private layout(): void {
    const task = this.currentTask;
    const panelHeight = this.getPanelHeight();
    const leftX = -PANEL_WIDTH / 2 + PADDING;
    let curY = -panelHeight / 2 + PADDING;

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
    const closeY = -panelHeight / 2 + PADDING + CLOSE_BUTTON_SIZE / 2;
    this.closeButtonGraphics.setPosition(closeX, closeY);
    this.closeButtonText.setPosition(closeX, closeY);

    this.layoutArtifacts(panelHeight);
  }

  private layoutArtifacts(panelHeight: number): void {
    this.clearArtifactElements();

    const artifacts = this.getArtifacts();
    const leftX = -PANEL_WIDTH / 2 + PADDING;

    if (artifacts.length === 0) {
      this.artifactsHeaderText.setText('');
      this.artifactsSectionGraphics.clear();
      return;
    }

    const baseContentBottom = -panelHeight / 2 + BASE_PANEL_HEIGHT - PADDING + 8;
    let curY = baseContentBottom;

    this.artifactsHeaderText.setText('ARTIFACTS');
    this.artifactsHeaderText.setPosition(leftX, curY);
    curY += ARTIFACTS_SECTION_HEADER;

    for (const artifact of artifacts) {
      this.createArtifactCard(artifact, curY);
      curY += ARTIFACT_CARD_HEIGHT + ARTIFACT_CARD_GAP;
    }
  }

  private createArtifactCard(artifact: TaskArtifact, y: number): void {
    const leftX = -PANEL_WIDTH / 2 + PADDING;
    const cardWidth = PANEL_WIDTH - PADDING * 2;
    const typeColor = ARTIFACT_TYPE_COLORS[artifact.type];
    const typeIcon = ARTIFACT_TYPE_ICONS[artifact.type];

    const cardContainer = this.scene.add.container(leftX, y);

    const cardGraphics = this.scene.add.graphics();
    cardGraphics.fillStyle(0x2d2d44, 0.85);
    cardGraphics.fillRoundedRect(0, 0, cardWidth, ARTIFACT_CARD_HEIGHT, 6);
    cardGraphics.fillStyle(typeColor, 0.1);
    cardGraphics.fillRoundedRect(0, 0, cardWidth, ARTIFACT_CARD_HEIGHT, 6);
    cardGraphics.lineStyle(1, typeColor, 0.3);
    cardGraphics.strokeRoundedRect(0, 0, cardWidth, ARTIFACT_CARD_HEIGHT, 6);
    cardContainer.add(cardGraphics);

    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(typeColor, 0.2);
    iconBg.fillRoundedRect(6, (ARTIFACT_CARD_HEIGHT - ARTIFACT_ICON_SIZE) / 2, ARTIFACT_ICON_SIZE, ARTIFACT_ICON_SIZE, 4);
    cardContainer.add(iconBg);

    const iconText = this.scene.add.text(
      6 + ARTIFACT_ICON_SIZE / 2,
      ARTIFACT_CARD_HEIGHT / 2,
      typeIcon,
      {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Arial',
      }
    );
    iconText.setOrigin(0.5);
    cardContainer.add(iconText);

    const nameText = this.scene.add.text(
      ARTIFACT_ICON_SIZE + 16,
      8,
      artifact.name.length > 20 ? artifact.name.substring(0, 20) + '...' : artifact.name,
      {
        fontSize: SMALL_FONT_SIZE,
        color: '#ffffff',
        fontFamily: 'Arial',
      }
    );
    cardContainer.add(nameText);

    const buttons: Phaser.GameObjects.Text[] = [];
    const buttonConfigs = this.getArtifactButtons(artifact);
    let btnX = cardWidth - 8;

    for (let i = buttonConfigs.length - 1; i >= 0; i--) {
      const btnConfig = buttonConfigs[i];
      const btn = this.scene.add.text(btnX, ARTIFACT_CARD_HEIGHT / 2 + 2, btnConfig.label, {
        fontSize: '9px',
        color: '#D1D5DB',
        fontFamily: 'Arial',
        backgroundColor: '#374151',
        padding: { x: ARTIFACT_BUTTON_PADDING, y: 2 },
      });
      btn.setOrigin(1, 0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        this.emitArtifactEvent(btnConfig.eventType, artifact);
      });
      cardContainer.add(btn);
      buttons.push(btn);
      btnX -= (btn.width + 4);
    }

    this.container.add(cardContainer);

    this.artifactElements.push({
      container: cardContainer,
      cardGraphics,
      iconText,
      nameText,
      buttons,
    });
  }

  private getArtifactButtons(artifact: TaskArtifact): Array<{ label: string; eventType: string }> {
    switch (artifact.type) {
      case 'html':
        return [
          { label: 'Preview', eventType: 'artifact-preview' },
          { label: 'Browser', eventType: 'artifact-open-browser' },
        ];
      case 'code':
        return [
          { label: 'View Code', eventType: 'artifact-preview' },
        ];
      default:
        return [
          { label: 'Open Folder', eventType: 'artifact-open-folder' },
        ];
    }
  }

  private emitArtifactEvent(eventType: string, artifact: TaskArtifact): void {
    if (this.eventBus) {
      this.eventBus.emit(eventType, {
        type: eventType,
        artifact,
        taskId: this.currentTask.id,
        timestamp: Date.now(),
      });
    }
  }

  private drawBackground(): void {
    this.background.clear();
    this.borderGraphics.clear();
    this.progressGraphics.clear();

    const panelHeight = this.getPanelHeight();
    const borderColor = this.getBorderColor();
    const halfW = PANEL_WIDTH / 2;
    const halfH = panelHeight / 2;

    this.borderGraphics.fillStyle(borderColor, 1);
    this.borderGraphics.fillRoundedRect(-halfW, -halfH, PANEL_WIDTH, panelHeight, BORDER_RADIUS);

    this.background.fillStyle(BG_COLOR, BG_ALPHA);
    this.background.fillRoundedRect(-halfW + 2, -halfH + 2, PANEL_WIDTH - 4, panelHeight - 4, BORDER_RADIUS - 1);

    const barY = this.progressLabel.y + 12;
    const barX = -PANEL_WIDTH / 2 + PADDING;
    const barWidth = PANEL_WIDTH - PADDING * 2;
    this.progressGraphics.fillStyle(0x374151, 1);
    this.progressGraphics.fillRoundedRect(barX, barY, barWidth, PROGRESS_BAR_HEIGHT, 3);

    const fillWidth = (this.currentTask.progress / 100) * barWidth;
    this.progressGraphics.fillStyle(borderColor, 1);
    this.progressGraphics.fillRoundedRect(barX, barY, fillWidth, PROGRESS_BAR_HEIGHT, 3);

    const closeX = PANEL_WIDTH / 2 - PADDING - CLOSE_BUTTON_SIZE / 2;
    const closeY = -panelHeight / 2 + PADDING + CLOSE_BUTTON_SIZE / 2;
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
