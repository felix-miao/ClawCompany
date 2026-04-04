import { Task } from '../types/Task';

export interface TaskHistoryRecord {
  task: Task;
  completedAt: number;
  duration: number;
  handoffs: string[];
}

const DEFAULT_MAX_RECORDS = 100;

export class TaskHistoryStore {
  private records: TaskHistoryRecord[] = [];
  private maxRecords: number;
  private handoffMap: Map<string, string[]> = new Map();

  constructor(maxRecords: number = DEFAULT_MAX_RECORDS) {
    this.maxRecords = maxRecords;
  }

  recordHandoff(taskId: string, fromAgentId: string, toAgentId: string): void {
    const handoffs = this.handoffMap.get(taskId) ?? [];
    if (handoffs.length === 0) {
      handoffs.push(fromAgentId);
    }
    handoffs.push(toAgentId);
    this.handoffMap.set(taskId, handoffs);
  }

  addRecord(task: Task): void {
    const handoffs = this.handoffMap.get(task.id) ?? [];
    const completedAt = task.completedAt ?? Date.now();
    const duration = task.assignedAt ? completedAt - task.assignedAt : 0;

    const record: TaskHistoryRecord = {
      task: { ...task },
      completedAt,
      duration,
      handoffs,
    };

    this.records.unshift(record);
    this.handoffMap.delete(task.id);

    while (this.records.length > this.maxRecords) {
      this.records.pop();
    }
  }

  getRecords(): TaskHistoryRecord[] {
    return this.records;
  }

  getRecordsByAgent(agentId: string): TaskHistoryRecord[] {
    return this.records.filter(
      (r) => r.task.agentId === agentId || r.handoffs.includes(agentId)
    );
  }

  getRecordsByDateRange(start: number, end: number): TaskHistoryRecord[] {
    return this.records.filter(
      (r) => r.completedAt >= start && r.completedAt <= end
    );
  }

  getRecordsByStatus(status: string): TaskHistoryRecord[] {
    return this.records.filter((r) => r.task.status === status);
  }

  getAverageDuration(): number {
    if (this.records.length === 0) return 0;
    const total = this.records.reduce((sum, r) => sum + r.duration, 0);
    return total / this.records.length;
  }

  getRecordCount(): number {
    return this.records.length;
  }

  setMaxRecords(max: number): void {
    this.maxRecords = max;
    while (this.records.length > this.maxRecords) {
      this.records.pop();
    }
  }

  clear(): void {
    this.records = [];
    this.handoffMap.clear();
  }
}
