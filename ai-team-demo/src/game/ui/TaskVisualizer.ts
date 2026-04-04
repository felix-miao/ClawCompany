import { TaskManager } from '../systems/TaskManager';
import { TaskBubble } from './TaskBubble';
import { ProgressBar } from './ProgressBar';
import { Task, TaskStatus } from '../types/Task';
import Phaser from 'phaser';

const BUBBLE_OFFSET_Y = -60;
const PROGRESS_BAR_OFFSET_Y = -48;
const COMPLETED_HIDE_DELAY = 2000;

export class TaskVisualizer {
  private scene: Phaser.Scene;
  private taskManager: TaskManager;
  private taskBubbles: Map<string, TaskBubble> = new Map();
  private progressBars: Map<string, ProgressBar> = new Map();
  private agentPositions: Map<string, { x: number; y: number }> = new Map();
  private completedTimers: Map<string, Phaser.Time.TimerEvent> = new Map();

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
      bar.setProgress(task.progress);

      bubble.update();
      bar.update();
    }

    this.cleanupCompletedAgents(activeTasks);
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
    bar.show(pos.x, pos.y + PROGRESS_BAR_OFFSET_Y);
    bar.setProgress(task.progress);
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
