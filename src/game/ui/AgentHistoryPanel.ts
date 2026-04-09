import * as Phaser from 'phaser';

import { TaskHistoryStore, TaskHistoryRecord } from '../data/TaskHistoryStore';
import { TaskDetailPanel } from './TaskDetailPanel';

const MAX_VISIBLE_RECORDS = 10;
const PANEL_WIDTH = 300;
const RECORD_HEIGHT = 50;
const HEADER_HEIGHT = 40;
const CLOSE_BUTTON_SIZE = 24;
const PADDING = 8;
const BORDER_RADIUS = 8;
const TIMELINE_LEFT = 24;
const TIMELINE_NODE_RADIUS = 5;
const BG_COLOR = 0x1a1a2e;
const BG_ALPHA = 0.95;
const FONT_SIZE = '13px';
const SMALL_FONT_SIZE = '11px';
const TITLE_FONT_SIZE = '15px';
const FADE_DURATION = 200;

export class AgentHistoryPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private historyStore: TaskHistoryStore;
  private records: TaskHistoryRecord[] = [];
  private scrollOffset: number = 0;
  private destroyed: boolean = false;
  private visible: boolean = false;
  private currentAgentId: string | null = null;

  private background: Phaser.GameObjects.Graphics;
  private headerText: Phaser.GameObjects.Text;
  private closeButtonBg: Phaser.GameObjects.Graphics;
  private closeButtonText: Phaser.GameObjects.Text;
  private recordContainers: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, historyStore: TaskHistoryStore) {
    this.scene = scene;
    this.historyStore = historyStore;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(260);
    this.container.setVisible(false);

    this.background = scene.add.graphics();
    this.container.add(this.background);

    this.headerText = scene.add.text(PADDING, PADDING, '', {
      fontSize: TITLE_FONT_SIZE,
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    });
    this.container.add(this.headerText);

    this.closeButtonBg = scene.add.graphics();
    this.container.add(this.closeButtonBg);

    this.closeButtonText = scene.add.text(0, 0, '✕', {
      fontSize: '16px',
      color: '#9CA3AF',
      fontFamily: 'Arial',
    });
    this.closeButtonText.setOrigin(0.5);
    this.closeButtonText.setInteractive({ useHandCursor: true });
    this.closeButtonText.on('pointerdown', () => this.hide());
    this.container.add(this.closeButtonText);
  }

  showForAgent(agentId: string, agentName: string): void {
    if (this.destroyed) return;
    this.currentAgentId = agentId;
    this.scrollOffset = 0;
    this.records = this.historyStore.getRecordsByAgent(agentId);
    this.headerText.setText(`${agentName} 的任务历史`);
    this.render();
    this.container.setVisible(true);
    this.visible = true;

    this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0, to: 1 },
      duration: FADE_DURATION,
      ease: 'Power2',
    });
  }

  hide(): void {
    if (this.destroyed) return;
    this.visible = false;
    this.currentAgentId = null;
    this.container.setVisible(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  getCurrentAgentId(): string | null {
    return this.currentAgentId;
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
    if (this.destroyed || !this.visible || !this.currentAgentId) return;
    this.records = this.historyStore.getRecordsByAgent(this.currentAgentId);
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearRecords();
    this.background.destroy();
    this.headerText.destroy();
    this.closeButtonBg.destroy();
    this.closeButtonText.destroy();
    this.container.destroy();
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  private render(): void {
    this.clearRecords();

    this.background.clear();
    const totalHeight =
      HEADER_HEIGHT + MAX_VISIBLE_RECORDS * (RECORD_HEIGHT + PADDING) + PADDING;
    this.background.fillStyle(BG_COLOR, BG_ALPHA);
    this.background.fillRoundedRect(0, 0, PANEL_WIDTH, totalHeight, BORDER_RADIUS);
    this.background.lineStyle(1, 0x374151, 0.5);
    this.background.strokeRoundedRect(0, 0, PANEL_WIDTH, totalHeight, BORDER_RADIUS);

    const closeX = PANEL_WIDTH - PADDING - CLOSE_BUTTON_SIZE / 2;
    const closeY = HEADER_HEIGHT / 2;
    this.closeButtonBg.clear();
    this.closeButtonBg.fillStyle(0x374151, 0.6);
    this.closeButtonBg.fillCircle(closeX, closeY, CLOSE_BUTTON_SIZE / 2);
    this.closeButtonText.setPosition(closeX, closeY);

    const visibleRecords = this.records.slice(
      this.scrollOffset,
      this.scrollOffset + MAX_VISIBLE_RECORDS
    );

    if (visibleRecords.length > 1) {
      const timelineStart = HEADER_HEIGHT + TIMELINE_NODE_RADIUS;
      const timelineEnd =
        HEADER_HEIGHT + (visibleRecords.length - 1) * (RECORD_HEIGHT + PADDING) + TIMELINE_NODE_RADIUS;

      const timelineLine = this.scene.add.graphics();
      timelineLine.lineStyle(2, 0x4B5563, 0.6);
      timelineLine.lineBetween(TIMELINE_LEFT, timelineStart, TIMELINE_LEFT, timelineEnd);
      this.container.add(timelineLine);
      this.recordContainers.push(timelineLine as unknown as Phaser.GameObjects.Container);
    }

    visibleRecords.forEach((record, index) => {
      const y = HEADER_HEIGHT + index * (RECORD_HEIGHT + PADDING);
      const recordContainer = this.renderTimelineNode(record, y);
      this.recordContainers.push(recordContainer);
      this.container.add(recordContainer);
    });
  }

  private renderTimelineNode(
    record: TaskHistoryRecord,
    y: number
  ): Phaser.GameObjects.Container {
    const nodeContainer = this.scene.add.container(0, y);

    const nodeGfx = this.scene.add.graphics();
    const statusColor =
      record.task.status === 'completed' ? 0x10B981 : 0xEF4444;
    nodeGfx.fillStyle(statusColor, 0.9);
    nodeGfx.fillCircle(TIMELINE_LEFT, TIMELINE_NODE_RADIUS, TIMELINE_NODE_RADIUS);
    nodeGfx.lineStyle(2, 0xffffff, 0.4);
    nodeGfx.strokeCircle(TIMELINE_LEFT, TIMELINE_NODE_RADIUS, TIMELINE_NODE_RADIUS);
    nodeContainer.add(nodeGfx);

    const cardGfx = this.scene.add.graphics();
    const priorityColor =
      TaskDetailPanel.PRIORITY_COLORS[
        record.task.metadata?.priority ?? 'medium'
      ];
    cardGfx.fillStyle(0x2d2d44, 0.85);
    cardGfx.fillRoundedRect(
      TIMELINE_LEFT + 12,
      0,
      PANEL_WIDTH - TIMELINE_LEFT - 12 - PADDING,
      RECORD_HEIGHT,
      6
    );
    cardGfx.fillStyle(priorityColor, 0.15);
    cardGfx.fillRoundedRect(
      TIMELINE_LEFT + 12,
      0,
      PANEL_WIDTH - TIMELINE_LEFT - 12 - PADDING,
      RECORD_HEIGHT,
      6
    );
    nodeContainer.add(cardGfx);

    const textLeft = TIMELINE_LEFT + 20;
    const maxWidth = PANEL_WIDTH - textLeft - PADDING - 8;

    const desc =
      record.task.description.length > 22
        ? record.task.description.substring(0, 22) + '...'
        : record.task.description;
    const descText = this.scene.add.text(textLeft, 4, desc, {
      fontSize: FONT_SIZE,
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    nodeContainer.add(descText);

    const statusLabel =
      record.task.status === 'completed' ? '✓ 完成' : '✗ 失败';
    const statusText = this.scene.add.text(
      PANEL_WIDTH - PADDING - 48,
      4,
      statusLabel,
      {
        fontSize: SMALL_FONT_SIZE,
        color: record.task.status === 'completed' ? '#10B981' : '#EF4444',
        fontFamily: 'Arial',
      }
    );
    nodeContainer.add(statusText);

    const durationMs = record.duration;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const durationStr =
      minutes > 0 ? `${minutes}分${seconds % 60}秒` : `${seconds}秒`;

    const timeStr = this.formatTime(record.completedAt);
    const metaText = this.scene.add.text(
      textLeft,
      24,
      `${timeStr} · ${durationStr}`,
      {
        fontSize: SMALL_FONT_SIZE,
        color: '#6B7280',
        fontFamily: 'Arial',
      }
    );
    nodeContainer.add(metaText);

    if (record.handoffs.length > 1) {
      const handoffStr = record.handoffs.join(' → ');
      const handoffText = this.scene.add.text(
        textLeft,
        36,
        handoffStr.length > 24 ? handoffStr.substring(0, 24) + '...' : handoffStr,
        {
          fontSize: SMALL_FONT_SIZE,
          color: '#9CA3AF',
          fontFamily: 'Arial',
        }
      );
      nodeContainer.add(handoffText);
    }

    return nodeContainer;
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private clearRecords(): void {
    for (const rc of this.recordContainers) {
      this.container.remove(rc);
      rc.destroy(true);
    }
    this.recordContainers = [];
  }
}
