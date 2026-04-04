import { TaskManager } from '../systems/TaskManager';
import { TaskBubble } from './TaskBubble';
import { ProgressBar } from './ProgressBar';
import { TaskDetailPanel } from './TaskDetailPanel';
import { Task, TaskStatus } from '../types/Task';
import Phaser from 'phaser';

const BUBBLE_OFFSET_Y = -60;
const PROGRESS_BAR_OFFSET_Y = -48;
const COMPLETED_HIDE_DELAY = 2000;
const PANEL_OFFSET_X = 100;
const PANEL_OFFSET_Y = -50;
const PANEL_UPDATE_INTERVAL = 100;

export class TaskVisualizer {
  private scene: Phaser.Scene;
  private taskManager: TaskManager;
  private taskBubbles: Map<string, TaskBubble> = new Map();
  private progressBars: Map<string, ProgressBar> = new Map();
  private agentPositions: Map<string, { x: number; y: number }> = new Map();
  private completedTimers: Map<string, Phaser.Time.TimerEvent> = new Map();
  private detailPanel: TaskDetailPanel | null = null;
  private detailPanelAgentId: string | null = null;
  private lastPanelUpdate: number = 0;

  constructor(scene: Phaser.Scene, taskManager: TaskManager) {
    this.scene = scene;
    this.taskManager = taskManager;
  }

  update(): void {
    const activeTasks = this.taskManager.getAllActiveTasks();

    for (const task of activeTasks) {
      const agentId = task.agentId;
      let bubble = this.taskBubbles.get(agentId);
      let bar = this.progressBars.get(agentId);

      if (!bubble) {
        bubble = new TaskBubble(this.scene);
        this.taskBubbles.set(agentId, bubble);
      }
      if (!bar) {
        bar = new ProgressBar(this.scene);
        this.progressBars.set(agentId, bar);
      }

      const pos = this.agentPositions.get(agentId);
      if (pos) {
        bubble.setPosition(pos.x, pos.y + BUBBLE_OFFSET_Y);
        bar.setPosition(pos.x, pos.y + PROGRESS_BAR_OFFSET_Y);
      }

      bubble.setStatus(task.status);
      bubble.setText(task.currentAction);
      bubble.setPriority(task.metadata?.priority ?? 'medium');
      bar.setProgress(task.progress);
      bar.setPriority(task.metadata?.priority ?? 'medium');

      bubble.update();
      bar.update();
    }

    this.cleanupCompletedAgents(activeTasks);

    const now = Date.now();
    if (this.detailPanel && this.detailPanelAgentId && now - this.lastPanelUpdate >= PANEL_UPDATE_INTERVAL) {
      const task = this.taskManager.getTaskByAgent(this.detailPanelAgentId);
      if (task) {
        this.detailPanel.update(task);
        this.lastPanelUpdate = now;
      }
    }
  }

  showTask(agentId: string, task: Task): void {
    let bubble = this.taskBubbles.get(agentId);
    let bar = this.progressBars.get(agentId);

    if (!bubble) {
      bubble = new TaskBubble(this.scene);
      this.taskBubbles.set(agentId, bubble);
    }
    if (!bar) {
      bar = new ProgressBar(this.scene);
      this.progressBars.set(agentId, bar);
    }

    const pos = this.agentPositions.get(agentId) ?? { x: 0, y: 0 };
    bubble.show(pos.x, pos.y + BUBBLE_OFFSET_Y, task.status, task.currentAction);
    bubble.setPriority(task.metadata?.priority ?? 'medium');
    bar.show(pos.x, pos.y + PROGRESS_BAR_OFFSET_Y);
    bar.setProgress(task.progress);
    bar.setPriority(task.metadata?.priority ?? 'medium');
  }

  hideTask(agentId: string): void {
    const bubble = this.taskBubbles.get(agentId);
    const bar = this.progressBars.get(agentId);

    if (bubble) bubble.hide();
    if (bar) bar.hide();

    const existingTimer = this.completedTimers.get(agentId);
    if (existingTimer) {
      existingTimer.remove(false);
      this.completedTimers.delete(agentId);
    }

    this.scene.time.delayedCall(300, () => {
      if (bubble) {
        bubble.destroy();
        this.taskBubbles.delete(agentId);
      }
      if (bar) {
        bar.destroy();
        this.progressBars.delete(agentId);
      }
    });
  }

  updateAgentPosition(agentId: string, x: number, y: number): void {
    this.agentPositions.set(agentId, { x, y });
  }

  updateProgress(agentId: string, progress: number): void {
    const bar = this.progressBars.get(agentId);
    if (bar) {
      bar.setProgress(progress);
    }
  }

  showTaskDetailPanel(agentId: string, task: Task): void {
    this.hideTaskDetailPanel();

    const pos = this.agentPositions.get(agentId);
    const panelX = (pos ? pos.x + PANEL_OFFSET_X : 200);
    const panelY = (pos ? pos.y + PANEL_OFFSET_Y : 100);

    this.detailPanel = new TaskDetailPanel(this.scene, {
      task,
      position: { x: panelX, y: panelY },
      onClose: () => {
        this.detailPanel = null;
        this.detailPanelAgentId = null;
      },
    });
    this.detailPanelAgentId = agentId;
  }

  hideTaskDetailPanel(): void {
    if (this.detailPanel) {
      this.detailPanel.destroy();
      this.detailPanel = null;
      this.detailPanelAgentId = null;
    }
  }

  getDetailPanel(): TaskDetailPanel | null {
    return this.detailPanel;
  }

  destroy(): void {
    for (const timer of this.completedTimers.values()) {
      timer.remove(false);
    }
    this.completedTimers.clear();

    for (const bubble of this.taskBubbles.values()) {
      bubble.destroy();
    }
    this.taskBubbles.clear();

    for (const bar of this.progressBars.values()) {
      bar.destroy();
    }
    this.progressBars.clear();
    this.agentPositions.clear();

    this.hideTaskDetailPanel();
  }

  getTaskBubble(agentId: string): TaskBubble | undefined {
    return this.taskBubbles.get(agentId);
  }

  getProgressBar(agentId: string): ProgressBar | undefined {
    return this.progressBars.get(agentId);
  }

  private cleanupCompletedAgents(activeTasks: Task[]): void {
    const activeAgentIds = new Set(activeTasks.map(t => t.agentId));

    for (const [agentId, bubble] of this.taskBubbles.entries()) {
      if (!activeAgentIds.has(agentId) && bubble.isActive()) {
        this.scheduleHideTask(agentId);
      }
    }
  }

  private scheduleHideTask(agentId: string): void {
    if (this.completedTimers.has(agentId)) return;

    const timer = this.scene.time.delayedCall(COMPLETED_HIDE_DELAY, () => {
      this.hideTask(agentId);
      this.completedTimers.delete(agentId);
    });

    this.completedTimers.set(agentId, timer);
  }
}
