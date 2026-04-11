import { ExportFilters } from './types/DataExportService';
import { TaskHistoryStore, TaskHistoryRecord } from './TaskHistoryStore';
import { GameEventStore } from './GameEventStore';
import { Task, TaskStatus } from '../types/Task';
import { GameEvent } from '../types/GameEvents';

function escapeCsvField(value: string | undefined | null): string {
  if (value == null) return '""';
  return `"${value.replace(/"/g, '""')}"`;
}

function getEventProp(event: GameEvent, prop: string): unknown {
  return (event as unknown as Record<string, unknown>)[prop];
}

export class DataExportService {
  constructor(
    private taskHistoryStore: TaskHistoryStore,
    private gameEventStore: GameEventStore
  ) {}

  exportTasksAsJson(): string {
    return this.exportFilteredTasksAsJson();
  }

  exportTasksAsCsv(): string {
    return this.exportFilteredTasksAsCsv();
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
      getEventProp(event, 'sessionKey') || '',
      getEventProp(event, 'role') || '',
      escapeCsvField(getEventProp(event, 'task') as string | undefined),
      getEventProp(event, 'status') || '',
      escapeCsvField(getEventProp(event, 'error') as string | undefined)
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
          (event.timestamp ?? 0) >= filters.dateRange!.start && (event.timestamp ?? 0) <= filters.dateRange!.end
        );
      }

      if (filters.eventType) {
        events = events.filter(event => event.type === filters.eventType);
      }

      if (filters.agentId) {
        events = events.filter(event => event.agentId === filters.agentId);
      }
    }

    return events;
  }

  private formatRecordsAsCsv(records: TaskHistoryRecord[]): string {
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
        escapeCsvField(task.description),
        task.status,
        task.taskType,
        task.progress,
        escapeCsvField(task.currentAction),
        task.assignedAt,
        completedAt,
        duration
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  exportFilteredTasksAsCsv(filters?: ExportFilters): string {
    const records = this.queryTaskHistory(filters);
    return this.formatRecordsAsCsv(records);
  }

  exportFilteredTasksAsJson(filters?: ExportFilters): string {
    const records = this.queryTaskHistory(filters);
    return JSON.stringify(records, null, 2);
  }
}
