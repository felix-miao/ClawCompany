import * as Phaser from 'phaser';
import { TaskHistoryStore, TaskHistoryRecord } from '../data/TaskHistoryStore';
import { TaskDetailPanel } from './TaskDetailPanel';

const MAX_VISIBLE_RECORDS = 10;
const PANEL_WIDTH = 320;
const RECORD_HEIGHT = 40;
const HEADER_HEIGHT = 30;
const PADDING = 8;
const BORDER_RADIUS = 6;
const BG_COLOR = 0x1a1a2e;
const BG_ALPHA = 0.92;
const FONT_SIZE = '13px';
const SMALL_FONT_SIZE = '10px';
const FADE_DURATION = 200;

export class TaskHistoryPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private historyStore: TaskHistoryStore;
  private records: TaskHistoryRecord[] = [];
  private scrollOffset: number = 0;
  private destroyed: boolean = false;
  private visible: boolean = false;

  private background: Phaser.GameObjects.Graphics;
  private headerText: Phaser.GameObjects.Text;
  private recordContainers: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, historyStore: TaskHistoryStore) {
    this.scene = scene;
    this.historyStore = historyStore;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(250);
    this.container.setVisible(false);

    this.background = scene.add.graphics();
    this.container.add(this.background);

    this.headerText = scene.add.text(PADDING, PADDING, '', {
      fontSize: FONT_SIZE,
      color: '#9CA3AF',
      fontFamily: 'Arial',
    });
    this.container.add(this.headerText);
  }

  show(): void {
    if (this.destroyed) return;
    this.records = this.historyStore.getRecords();
    this.scrollOffset = 0;
    this.render();
    this.container.setVisible(true);
    this.visible = true;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: FADE_DURATION,
      ease: 'Power2',
    });
  }

  hide(): void {
    if (this.destroyed) return;
    this.visible = false;
    this.container.setVisible(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  getRecordCount(): number {
    return this.records.length;
  }

  scrollUp(): void {
    if (this.scrollOffset > 0) {
      this.scrollOffset--;
      this.render();
    }
  }

  scrollDown(): void {
    const maxOffset = Math.max(0, this.records.length - MAX_VISIBLE_RECORDS);
    if (this.scrollOffset < maxOffset) {
      this.scrollOffset++;
      this.render();
    }
  }

  update(): void {
    if (this.destroyed || !this.visible) return;
    this.records = this.historyStore.getRecords();
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearRecords();
    this.background.destroy();
    this.headerText.destroy();
    this.container.destroy();
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    }
    return `${seconds}秒`;
  }

  private render(): void {
    this.clearRecords();

    this.background.clear();
    this.background.fillStyle(BG_COLOR, BG_ALPHA);
    const totalHeight = HEADER_HEIGHT + MAX_VISIBLE_RECORDS * (RECORD_HEIGHT + PADDING) + PADDING;
    this.background.fillRoundedRect(0, 0, PANEL_WIDTH, totalHeight, BORDER_RADIUS);

    this.headerText.setText(`任务历史 (${this.records.length})`);

    const visibleRecords = this.records.slice(
      this.scrollOffset,
      this.scrollOffset + MAX_VISIBLE_RECORDS
    );

    visibleRecords.forEach((record, index) => {
      const y = HEADER_HEIGHT + index * (RECORD_HEIGHT + PADDING);
      const recordContainer = this.renderRecord(record, y);
      this.recordContainers.push(recordContainer);
      this.container.add(recordContainer);
    });
  }

  private renderRecord(
    record: TaskHistoryRecord,
    y: number
  ): Phaser.GameObjects.Container {
    const recordContainer = this.scene.add.container(0, y);

    const bg = this.scene.add.graphics();
    const priorityColor =
      TaskDetailPanel.PRIORITY_COLORS[
        record.task.metadata?.priority ?? 'medium'
      ];
    bg.fillStyle(0x333333, 0.8);
    bg.fillRoundedRect(PADDING, 0, PANEL_WIDTH - PADDING * 2, RECORD_HEIGHT, 4);
    bg.fillStyle(priorityColor, 0.3);
    bg.fillRoundedRect(PADDING, 0, PANEL_WIDTH - PADDING * 2, RECORD_HEIGHT, 4);
    recordContainer.add(bg);

    const desc =
      record.task.description.length > 28
        ? record.task.description.substring(0, 28) + '...'
        : record.task.description;
    const descText = this.scene.add.text(PADDING + 8, 4, desc, {
      fontSize: SMALL_FONT_SIZE,
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    recordContainer.add(descText);

    const statusText = this.scene.add.text(
      PANEL_WIDTH - PADDING - 60,
      4,
      record.task.status,
      {
        fontSize: SMALL_FONT_SIZE,
        color: record.task.status === 'completed' ? '#10B981' : '#EF4444',
        fontFamily: 'Arial',
      }
    );
    recordContainer.add(statusText);

    const durationStr = TaskHistoryPanel.formatDuration(record.duration);
    const timeText = this.scene.add.text(PADDING + 8, 22, durationStr, {
      fontSize: SMALL_FONT_SIZE,
      color: '#6B7280',
      fontFamily: 'Arial',
    });
    recordContainer.add(timeText);

    if (record.handoffs.length > 1) {
      const handoffStr = record.handoffs.join(' → ');
      const handoffText = this.scene.add.text(
        PADDING + 8 + timeText.width + 12,
        22,
        handoffStr,
        {
          fontSize: SMALL_FONT_SIZE,
          color: '#9CA3AF',
          fontFamily: 'Arial',
        }
      );
      recordContainer.add(handoffText);
    }

    return recordContainer;
  }

  private clearRecords(): void {
    for (const rc of this.recordContainers) {
      this.container.remove(rc);
      rc.destroy(true);
    }
    this.recordContainers = [];
  }
}
