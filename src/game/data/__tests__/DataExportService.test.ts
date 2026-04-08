import { DataExportService, ExportFilters } from '../DataExportService';
import { TaskHistoryStore, TaskHistoryRecord } from '../TaskHistoryStore';
import { GameEventStore } from '../GameEventStore';
import { Task, TaskStatus } from '../../types/Task';
import { GameEvent } from '../../types/GameEvents';

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-' + Math.random().toString(36).slice(2, 8),
    agentId: 'alice',
    description: 'Test task',
    status: 'pending' as TaskStatus,
    progress: 0,
    currentAction: 'Idle',
    taskType: 'coding',
    assignedAt: Date.now(),
    completedAt: null,
    parentTaskId: null,
    ...overrides,
  };
}

describe('DataExportService', () => {
  let taskHistoryStore: TaskHistoryStore;
  let gameEventStore: GameEventStore;
  let service: DataExportService;

  beforeEach(() => {
    taskHistoryStore = new TaskHistoryStore();
    gameEventStore = new GameEventStore();
    service = new DataExportService(taskHistoryStore, gameEventStore);
  });

  describe('JSON export', () => {
    it('should export task history as JSON', () => {
      taskHistoryStore.addRecord(createTestTask({ id: '1', status: 'completed' }));
      taskHistoryStore.addRecord(createTestTask({ id: '2', status: 'failed' }));

      const json = service.exportTasksAsJson();

      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].task.id).toBe('2');
      expect(parsed[1].task.id).toBe('1');
    });

    it('should export task history as JSON with all fields', () => {
      const now = Date.now();
      taskHistoryStore.addRecord(
        createTestTask({
          id: '1',
          agentId: 'alice',
          status: 'completed',
          taskType: 'coding',
          description: 'Implement feature X',
          assignedAt: now - 5000,
          completedAt: now,
        })
      );

      const json = service.exportTasksAsJson();
      const parsed = JSON.parse(json);

      expect(parsed[0].task.id).toBe('1');
      expect(parsed[0].task.agentId).toBe('alice');
      expect(parsed[0].task.taskType).toBe('coding');
      expect(parsed[0].task.description).toBe('Implement feature X');
      expect(parsed[0].completedAt).toBe(now);
      expect(parsed[0].duration).toBeGreaterThanOrEqual(5000);
    });

    it('should export events as JSON', () => {
      const event: GameEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'alice',
        status: 'working',
      } as GameEvent;
      gameEventStore.push(event);

      const json = service.exportEventsAsJson();
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('agent:status-change');
      expect(parsed[0].agentId).toBe('alice');
    });

    it('should export empty data as valid JSON array', () => {
      const json = service.exportTasksAsJson();
      expect(JSON.parse(json)).toEqual([]);
    });

    it('should export combined dashboard data as JSON', () => {
      taskHistoryStore.addRecord(createTestTask({ id: '1', status: 'completed' }));
      const event: GameEvent = {
        type: 'session:started',
        timestamp: Date.now(),
        sessionKey: 'session-1',
        role: 'dev',
        task: 'build feature',
      } as GameEvent;
      gameEventStore.push(event);

      const json = service.exportDashboardAsJson();
      const parsed = JSON.parse(json);

      expect(parsed.tasks).toBeDefined();
      expect(parsed.events).toBeDefined();
      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.totalTasks).toBe(1);
      expect(parsed.summary.totalEvents).toBe(1);
      expect(parsed.tasks).toHaveLength(1);
      expect(parsed.events).toHaveLength(1);
    });
  });

  describe('CSV export', () => {
    it('should export task history as CSV with header', () => {
      taskHistoryStore.addRecord(createTestTask({ id: '1', status: 'completed' }));

      const csv = service.exportTasksAsCsv();
      const lines = csv.split('\n');

      expect(lines[0]).toContain('id');
      expect(lines[0]).toContain('agentId');
      expect(lines[0]).toContain('status');
      expect(lines[0]).toContain('taskType');
      expect(lines[0]).toContain('completedAt');
      expect(lines[0]).toContain('duration');
    });

    it('should export task history as CSV with data rows', () => {
      taskHistoryStore.addRecord(createTestTask({ id: '1', agentId: 'alice', status: 'completed' }));

      const csv = service.exportTasksAsCsv();
      const lines = csv.split('\n').filter((l) => l.trim().length > 0);

      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('1');
      expect(lines[1]).toContain('alice');
      expect(lines[1]).toContain('completed');
    });

    it('should escape commas and quotes in CSV values', () => {
      taskHistoryStore.addRecord(
        createTestTask({
          id: '1',
          description: 'Fix bug "critical" in module, urgent',
        })
      );

      const csv = service.exportTasksAsCsv();
      const lines = csv.split('\n').filter((l) => l.trim().length > 0);

      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('"Fix bug ""critical"" in module, urgent"');
    });

    it('should export empty data as CSV with only header', () => {
      const csv = service.exportTasksAsCsv();
      const lines = csv.split('\n').filter((l) => l.trim().length > 0);

      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('id');
    });

    it('should export events as CSV', () => {
      const event: GameEvent = {
        type: 'agent:status-change',
        timestamp: 1700000000000,
        agentId: 'alice',
        status: 'working',
      } as GameEvent;
      gameEventStore.push(event);

      const csv = service.exportEventsAsCsv();
      const lines = csv.split('\n').filter((l) => l.trim().length > 0);

      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('type');
      expect(lines[0]).toContain('timestamp');
      expect(lines[0]).toContain('agentId');
      expect(lines[1]).toContain('agent:status-change');
      expect(lines[1]).toContain('alice');
    });
  });

  describe('historical data query', () => {
    it('should query tasks by date range', () => {
      const now = Date.now();
      taskHistoryStore.addRecord(
        createTestTask({ id: 'old', completedAt: now - 100000 })
      );
      taskHistoryStore.addRecord(
        createTestTask({ id: 'recent', completedAt: now - 1000 })
      );

      const filters: ExportFilters = {
        dateRange: { start: now - 5000, end: now + 1000 },
      };

      const results = service.queryTaskHistory(filters);

      expect(results).toHaveLength(1);
      expect(results[0].task.id).toBe('recent');
    });

    it('should query tasks by agent', () => {
      taskHistoryStore.addRecord(createTestTask({ id: '1', agentId: 'alice' }));
      taskHistoryStore.addRecord(createTestTask({ id: '2', agentId: 'bob' }));

      const filters: ExportFilters = { agentId: 'alice' };

      const results = service.queryTaskHistory(filters);

      expect(results).toHaveLength(1);
      expect(results[0].task.agentId).toBe('alice');
    });

    it('should query tasks by status', () => {
      taskHistoryStore.addRecord(createTestTask({ id: '1', status: 'completed' }));
      taskHistoryStore.addRecord(createTestTask({ id: '2', status: 'failed' }));

      const filters: ExportFilters = { status: 'completed' };

      const results = service.queryTaskHistory(filters);

      expect(results).toHaveLength(1);
      expect(results[0].task.status).toBe('completed');
    });

    it('should query tasks by task type', () => {
      taskHistoryStore.addRecord(createTestTask({ id: '1', taskType: 'coding' }));
      taskHistoryStore.addRecord(createTestTask({ id: '2', taskType: 'testing' }));

      const filters: ExportFilters = { taskType: 'coding' };

      const results = service.queryTaskHistory(filters);

      expect(results).toHaveLength(1);
      expect(results[0].task.taskType).toBe('coding');
    });

    it('should combine multiple filters', () => {
      const now = Date.now();
      taskHistoryStore.addRecord(
        createTestTask({
          id: '1',
          agentId: 'alice',
          status: 'completed',
          taskType: 'coding',
          completedAt: now,
        })
      );
      taskHistoryStore.addRecord(
        createTestTask({
          id: '2',
          agentId: 'alice',
          status: 'failed',
          taskType: 'coding',
          completedAt: now,
        })
      );
      taskHistoryStore.addRecord(
        createTestTask({
          id: '3',
          agentId: 'bob',
          status: 'completed',
          taskType: 'coding',
          completedAt: now,
        })
      );

      const filters: ExportFilters = {
        agentId: 'alice',
        status: 'completed',
        taskType: 'coding',
      };

      const results = service.queryTaskHistory(filters);

      expect(results).toHaveLength(1);
      expect(results[0].task.id).toBe('1');
    });

    it('should query events by date range', () => {
      const now = Date.now();
      gameEventStore.push({
        type: 'agent:status-change',
        timestamp: now - 100000,
        agentId: 'alice',
        status: 'working',
      } as GameEvent);
      gameEventStore.push({
        type: 'agent:status-change',
        timestamp: now - 1000,
        agentId: 'bob',
        status: 'idle',
      } as GameEvent);

      const filters: ExportFilters = {
        dateRange: { start: now - 5000, end: now + 1000 },
      };

      const results = service.queryEvents(filters);

      expect(results).toHaveLength(1);
      expect(results[0].agentId).toBe('bob');
    });

    it('should query events by type', () => {
      gameEventStore.push({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'alice',
        status: 'working',
      } as GameEvent);
      gameEventStore.push({
        type: 'session:started',
        timestamp: Date.now(),
        sessionKey: 's-1',
        role: 'dev',
        task: 'task',
      } as GameEvent);

      const filters: ExportFilters = { eventType: 'session:started' };

      const results = service.queryEvents(filters);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('session:started');
    });

    it('should query events by agent', () => {
      gameEventStore.push({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'alice',
        status: 'working',
      } as GameEvent);
      gameEventStore.push({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'bob',
        status: 'idle',
      } as GameEvent);

      const filters: ExportFilters = { agentId: 'alice' };

      const results = service.queryEvents(filters);

      expect(results).toHaveLength(1);
      expect(results[0].agentId).toBe('alice');
    });

    it('should export queried results as CSV', () => {
      const now = Date.now();
      taskHistoryStore.addRecord(
        createTestTask({ id: '1', agentId: 'alice', status: 'completed', completedAt: now })
      );
      taskHistoryStore.addRecord(
        createTestTask({ id: '2', agentId: 'bob', status: 'failed', completedAt: now })
      );

      const filters: ExportFilters = { agentId: 'alice' };
      const csv = service.exportFilteredTasksAsCsv(filters);
      const lines = csv.split('\n').filter((l) => l.trim().length > 0);

      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('alice');
      expect(lines[1]).not.toContain('bob');
    });

    it('should export queried results as JSON', () => {
      const now = Date.now();
      taskHistoryStore.addRecord(
        createTestTask({ id: '1', agentId: 'alice', status: 'completed', completedAt: now })
      );
      taskHistoryStore.addRecord(
        createTestTask({ id: '2', agentId: 'bob', status: 'failed', completedAt: now })
      );

      const filters: ExportFilters = { agentId: 'alice' };
      const json = service.exportFilteredTasksAsJson(filters);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].task.agentId).toBe('alice');
    });
  });
});
