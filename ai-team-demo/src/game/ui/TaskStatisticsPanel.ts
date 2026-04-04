import * as Phaser from 'phaser';
import { TaskStatisticsStore, TaskStatistics } from '../data/TaskStatisticsStore';
import { TaskHistoryPanel } from './TaskHistoryPanel';

const PANEL_WIDTH = 280;
const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 25;
const PADDING = 8;
const BORDER_RADIUS = 6;
const BG_COLOR = 0x1a1a2e;
const BG_ALPHA = 0.92;
const FONT_SIZE = '13px';
const ROW_FONT_SIZE = '12px';
const SMALL_FONT_SIZE = '11px';
const FADE_DURATION = 200;

const STAT_COLORS = {
  total: '#9CA3AF',
  completed: '#10B981',
  failed: '#EF4444',
  duration: '#F59E0B',
  rate: '#3B82F6',
  agent: '#8B5CF6',
};

export class TaskStatisticsPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private statisticsStore: TaskStatisticsStore;
  private destroyed: boolean = false;
  private visible: boolean = false;

  private background: Phaser.GameObjects.Graphics;
  private headerText: Phaser.GameObjects.Text;
  private contentObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, statisticsStore: TaskStatisticsStore) {
    this.scene = scene;
    this.statisticsStore = statisticsStore;
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
    this.statisticsStore.update();
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

  update(): void {
    if (this.destroyed || !this.visible) return;
    this.statisticsStore.update();
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearContent();
    this.background.destroy();
    this.headerText.destroy();
    this.container.destroy();
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  private render(): void {
    this.clearContent();

    const stats = this.statisticsStore.getStatistics();

    const agentRows = stats.agentDistribution.size;
    const totalHeight = HEADER_HEIGHT + 6 * ROW_HEIGHT + PADDING + (agentRows > 0 ? ROW_HEIGHT + agentRows * 18 : 0) + PADDING;

    this.background.clear();
    this.background.fillStyle(BG_COLOR, BG_ALPHA);
    this.background.fillRoundedRect(0, 0, PANEL_WIDTH, totalHeight, BORDER_RADIUS);

    this.headerText.setText('任务统计');

    let y = HEADER_HEIGHT;

    y = this.renderStatRow(y, '总任务数', `${stats.totalTasks}`, STAT_COLORS.total);
    y = this.renderStatRow(y, '完成数', `${stats.completedTasks}`, STAT_COLORS.completed);
    y = this.renderStatRow(y, '失败数', `${stats.failedTasks}`, STAT_COLORS.failed);
    y = this.renderStatRow(y, '平均时长', TaskHistoryPanel.formatDuration(stats.averageDuration), STAT_COLORS.duration);
    y = this.renderStatRow(y, '成功率', `${stats.successRate.toFixed(1)}%`, STAT_COLORS.rate);

    y = this.renderStatRow(y, '进行中', `${stats.totalTasks - stats.completedTasks - stats.failedTasks}`, STAT_COLORS.total);

    if (agentRows > 0) {
      y = this.renderAgentDistribution(y, stats);
    }
  }

  private renderStatRow(y: number, label: string, value: string, color: string): number {
    const labelText = this.scene.add.text(PADDING + 4, y, label + ':', {
      fontSize: ROW_FONT_SIZE,
      color: '#aaaaaa',
      fontFamily: 'Arial',
    });
    this.container.add(labelText);
    this.contentObjects.push(labelText);

    const valueText = this.scene.add.text(PADDING + 120, y, value, {
      fontSize: ROW_FONT_SIZE,
      color,
      fontFamily: 'Arial',
    });
    this.container.add(valueText);
    this.contentObjects.push(valueText);

    return y + ROW_HEIGHT;
  }

  private renderAgentDistribution(y: number, stats: TaskStatistics): number {
    const title = this.scene.add.text(PADDING + 4, y, 'Agent 任务分布:', {
      fontSize: ROW_FONT_SIZE,
      color: '#aaaaaa',
      fontFamily: 'Arial',
    });
    this.container.add(title);
    this.contentObjects.push(title);

    y += ROW_HEIGHT;

    stats.agentDistribution.forEach((count, agentId) => {
      const text = this.scene.add.text(PADDING + 16, y, `${agentId}: ${count}`, {
        fontSize: SMALL_FONT_SIZE,
        color: STAT_COLORS.agent,
        fontFamily: 'Arial',
      });
      this.container.add(text);
      this.contentObjects.push(text);
      y += 18;
    });

    return y;
  }

  private clearContent(): void {
    for (const obj of this.contentObjects) {
      this.container.remove(obj as Phaser.GameObjects.GameObject);
      (obj as Phaser.GameObjects.GameObject).destroy(true);
    }
    this.contentObjects = [];
  }
}
