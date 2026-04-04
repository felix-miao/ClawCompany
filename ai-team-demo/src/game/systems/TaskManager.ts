import { EventBus } from './EventBus';
import { Task, TaskStatus } from '../types/Task';
import {
  TaskVisualizationAssignedEvent,
  TaskVisualizationProgressEvent,
  TaskVisualizationCompletedEvent,
  TaskVisualizationFailedEvent,
  TaskVisualizationHandoverEvent,
} from '../types/GameEvents';

export interface TaskManagerConfig {
  maxHistorySize?: number;
}

const DEFAULT_MAX_HISTORY_SIZE = 100;

export class TaskManager {
  private activeTasks: Map<string, Task> = new Map();
  private taskHistory: Map<string, Task> = new Map();
  private taskQueue: Task[] = [];
  private eventBus: EventBus;
  private maxHistorySize: number;

  constructor(eventBus: EventBus, config?: TaskManagerConfig) {
    this.eventBus = eventBus;
    this.maxHistorySize = config?.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
  }

  assignTask(agentId: string, task: Task): void {
    const existingTask = this.activeTasks.get(agentId);
    if (existingTask) {
      this.moveToHistory(existingTask);
    }

    const assignedTask: Task = {
      ...task,
      agentId,
      status: 'assigned' as TaskStatus,
      assignedAt: task.assignedAt || Date.now(),
    };

    this.activeTasks.set(agentId, assignedTask);

    this.eventBus.emit({
      type: 'task:assigned',
      timestamp: Date.now(),
      agentId,
      task: {
        id: assignedTask.id,
        description: assignedTask.description,
        taskType: assignedTask.taskType,
        metadata: assignedTask.metadata as Record<string, unknown> | undefined,
      },
    } as TaskVisualizationAssignedEvent);
  }

  updateProgress(agentId: string, progress: number, currentAction?: string): void {
    const task = this.activeTasks.get(agentId);
    if (!task) return;

    const clampedProgress = Math.max(0, Math.min(100, progress));

    task.progress = clampedProgress;
    if (currentAction !== undefined) {
      task.currentAction = currentAction;
    }

    if (task.status === 'assigned' && clampedProgress > 0) {
      task.status = 'working';
    }

    this.eventBus.emit({
      type: 'task:progress',
      timestamp: Date.now(),
      agentId,
      taskId: task.id,
      progress: clampedProgress,
      currentAction: task.currentAction,
    } as TaskVisualizationProgressEvent);
  }

  completeTask(agentId: string, result: 'success' | 'failure'): void {
    const task = this.activeTasks.get(agentId);
    if (!task) return;

    const now = Date.now();
    task.completedAt = now;
    task.status = result === 'success' ? 'completed' : 'failed';

    if (result === 'success') {
      task.progress = 100;
    }

    this.moveToHistory(task);
    this.activeTasks.delete(agentId);

    if (result === 'success') {
      this.eventBus.emit({
        type: 'task:completed',
        timestamp: now,
        agentId,
        taskId: task.id,
        result: 'success',
        duration: now - task.assignedAt,
      } as TaskVisualizationCompletedEvent);
    } else {
      this.eventBus.emit({
        type: 'task:failed',
        timestamp: now,
        agentId,
        taskId: task.id,
        error: 'Task failed',
      } as TaskVisualizationFailedEvent);
    }
  }

  handoverTask(fromAgentId: string, toAgentId: string, taskId: string): void {
    const task = this.activeTasks.get(fromAgentId);
    if (!task || task.id !== taskId) return;

    this.activeTasks.delete(fromAgentId);

    const description = task.description;

    task.agentId = toAgentId;
    task.status = 'assigned';

    this.activeTasks.set(toAgentId, task);

    this.eventBus.emit({
      type: 'task:handover',
      timestamp: Date.now(),
      fromAgentId,
      toAgentId,
      taskId,
      description,
    } as TaskVisualizationHandoverEvent);

    this.eventBus.emit({
      type: 'task:assigned',
      timestamp: Date.now(),
      agentId: toAgentId,
      task: {
        id: task.id,
        description: task.description,
        taskType: task.taskType,
        metadata: task.metadata as Record<string, unknown> | undefined,
      },
    } as TaskVisualizationAssignedEvent);
  }

  getTaskByAgent(agentId: string): Task | undefined {
    return this.activeTasks.get(agentId);
  }

  getTaskById(taskId: string): Task | undefined {
    for (const task of this.activeTasks.values()) {
      if (task.id === taskId) return task;
    }
    return this.taskHistory.get(taskId);
  }

  getAllActiveTasks(): Task[] {
    return Array.from(this.activeTasks.values());
  }

  getTaskHistory(): Task[] {
    return Array.from(this.taskHistory.values());
  }

  enqueueTask(task: Task): void {
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const aPriority = a.metadata?.priority ?? 'medium';
      const bPriority = b.metadata?.priority ?? 'medium';
      return (priorityOrder[aPriority] ?? 1) - (priorityOrder[bPriority] ?? 1);
    });
  }

  dequeueNextTask(_agentId: string): Task | undefined {
    return this.taskQueue.shift();
  }

  private moveToHistory(task: Task): void {
    this.taskHistory.set(task.id, { ...task });
    this.cleanupHistory();
  }

  private cleanupHistory(): void {
    while (this.taskHistory.size > this.maxHistorySize) {
      const firstKey = this.taskHistory.keys().next().value;
      if (firstKey !== undefined) {
        this.taskHistory.delete(firstKey);
      } else {
        break;
      }
    }
  }
}
