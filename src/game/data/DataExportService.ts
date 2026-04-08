import { ExportFilters } from './types/DataExportService';
import { TaskHistoryStore, TaskHistoryRecord } from './TaskHistoryStore';
import { GameEventStore } from './GameEventStore';
import { Task, TaskStatus } from '../types/Task';
import { GameEvent } from '../types/GameEvents';

export interface ExportFilters {
  dateRange?: { start: number; end: number };
  agentId?: string;
  status?: TaskStatus;
  taskType?: string;
  eventType?: string;
}

export class DataExportService {
  constructor(
    private taskHistoryStore: TaskHistoryStore,
    private gameEventStore: GameEventStore
  ) {}

  exportTasksAsJson(): string {
    const records = this.taskHistoryStore.getRecords();
    return JSON.stringify(records, null, 2);
  }

  exportTasksAsCsv(): string {
    const records = this.taskHistoryStore.getRecords();
    const headers = [
      'id',
      'agentId',
      'description',
      'status',
      'taskType',
      'progress',
      'currentAction',
      'assignedAt',
      'completedAt',
      'duration'
    ];

    const rows = records.map(record => {
      const { task, completedAt } = record;
      const duration = completedAt ? completedAt - task.assignedAt : 0;
      
      return [
        task.id,
        task.agentId,
        `"${task.description.replace(/"/g, '""')}"`,
        task.status,
        task.taskType,
        task.progress,
        `"${task.currentAction.replace(/"/g, '""')}"`,
        task.assignedAt,
        completedAt,
        duration
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  exportEventsAsJson(): string {
    const events = this.gameEventStore.getEvents();
    return JSON.stringify(events, null, 2);
  }

  exportEventsAsCsv(): string {
    const events = this.gameEventStore.getEvents();
    const headers = [
      'type',
      'timestamp',
      'agentId',
      'sessionKey',
      'role',
      'task',
      'status',
      'error'
    ];

    const rows = events.map(event => [
      event.type,
      event.timestamp,
      event.agentId || '',
      event.sessionKey || '',
      event.role || '',
      `"${(event as any).task || ''}"`,
      (event as any).status || '',
      `"${(event as any).error || ''}"`
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  exportDashboardAsJson(): string {
    const records = this.taskHistoryStore.getRecords();
    const events = this.gameEventStore.getEvents();

    const summary = {
      totalTasks: records.length,
      totalEvents: events.length,
      completedTasks: records.filter(r => r.task.status === 'completed').length,
      failedTasks: records.filter(r => r.task.status === 'failed').length,
      pendingTasks: records.filter(r => r.task.status === 'pending').length
    };

    return JSON.stringify({
      tasks: records,
      events,
      summary
    }, null, 2);
  }

  queryTaskHistory(filters?: ExportFilters): TaskHistoryRecord[] {
    let records = this.taskHistoryStore.getRecords();

    if (filters) {
      if (filters.dateRange) {
        records = records.filter(record => {
          const timestamp = record.completedAt || record.task.assignedAt;
          return timestamp >= filters.dateRange!.start && timestamp <= filters.dateRange!.end;
        });
      }

      if (filters.agentId) {
        records = records.filter(record => record.task.agentId === filters.agentId);
      }

      if (filters.status) {
        records = records.filter(record => record.task.status === filters.status);
      }

      if (filters.taskType) {
        records = records.filter(record => record.task.taskType === filters.taskType);
      }
    }

    return records;
  }

  queryEvents(filters?: ExportFilters): GameEvent[] {
    let events = this.gameEventStore.getEvents();

    if (filters) {
      if (filters.dateRange) {
        events = events.filter(event => 
          event.timestamp >= filters.dateRange!.start && event.timestamp <= filters.dateRange!.end
        );
      }

      if (filters.eventType) {
        events = events.filter(event => event.type === filters.eventType);
      }

      if (filters.agentId) {
        events = events.filter(event => (event as any).agentId === filters.agentId);
      }
    }

    return events;
  }

  exportFilteredTasksAsCsv(filters?: ExportFilters): string {
    const records = this.queryTaskHistory(filters);
    const headers = [
      'id',
      'agentId',
      'description',
      'status',
      'taskType',
      'progress',
      'currentAction',
      'assignedAt',
      'completedAt',
      'duration'
    ];

    const rows = records.map(record => {
      const { task, completedAt } = record;
      const duration = completedAt ? completedAt - task.assignedAt : 0;
      
      return [
        task.id,
        task.agentId,
        `"${task.description.replace(/"/g, '""')}"`,
        task.status,
        task.taskType,
        task.progress,
        `"${task.currentAction.replace(/"/g, '""')}"`,
        task.assignedAt,
        completedAt,
        duration
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  exportFilteredTasksAsJson(filters?: ExportFilters): string {
    const records = this.queryTaskHistory(filters);
    return JSON.stringify(records, null, 2);
  }
}