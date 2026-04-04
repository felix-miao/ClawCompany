import { TaskHistoryStore } from '../TaskHistoryStore';
import { Task, TaskStatus } from '../../types/Task';

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

describe('TaskHistoryStore', () => {
  let store: TaskHistoryStore;

  beforeEach(() => {
    store = new TaskHistoryStore();
  });

  describe('addRecord', () => {
    it('should add a record', () => {
      const task = createTestTask({
        id: '1',
        assignedAt: Date.now() - 5000,
        completedAt: Date.now(),
      });

      store.addRecord(task);

      expect(store.getRecords()).toHaveLength(1);
      expect(store.getRecords()[0].task.id).toBe('1');
    });

    it('should calculate duration from assignedAt and completedAt', () => {
      const assignedAt = Date.now() - 10000;
      const completedAt = Date.now();
      const task = createTestTask({
        id: '1',
        assignedAt,
        completedAt,
      });

      store.addRecord(task);

      const record = store.getRecords()[0];
      expect(record.duration).toBeGreaterThanOrEqual(9000);
      expect(record.completedAt).toBe(completedAt);
    });

    it('should handle task without completedAt using current time', () => {
      const task = createTestTask({ id: '1', completedAt: null });
      const before = Date.now();

      store.addRecord(task);

      const after = Date.now();
      const record = store.getRecords()[0];
      expect(record.completedAt).toBeGreaterThanOrEqual(before);
      expect(record.completedAt).toBeLessThanOrEqual(after);
    });

    it('should add records in reverse chronological order', () => {
      const task1 = createTestTask({ id: '1' });
      const task2 = createTestTask({ id: '2' });

      store.addRecord(task1);
      store.addRecord(task2);

      const records = store.getRecords();
      expect(records[0].task.id).toBe('2');
      expect(records[1].task.id).toBe('1');
    });

    it('should store a copy of the task', () => {
      const task = createTestTask({ id: '1', progress: 50 });
      store.addRecord(task);

      task.progress = 100;

      expect(store.getRecords()[0].task.progress).toBe(50);
    });
  });

  describe('maxRecords', () => {
    it('should limit records to maxRecords', () => {
      store.setMaxRecords(5);

      for (let i = 0; i < 10; i++) {
        store.addRecord(createTestTask({ id: String(i) }));
      }

      expect(store.getRecords()).toHaveLength(5);
    });

    it('should keep the most recent records', () => {
      store.setMaxRecords(3);

      for (let i = 0; i < 5; i++) {
        store.addRecord(createTestTask({ id: String(i) }));
      }

      const records = store.getRecords();
      expect(records.map((r) => r.task.id)).toEqual(['4', '3', '2']);
    });

    it('should use default maxRecords of 100', () => {
      expect(store.getRecordCount()).toBe(0);
    });

    it('should trim existing records when maxRecords is reduced', () => {
      for (let i = 0; i < 10; i++) {
        store.addRecord(createTestTask({ id: String(i) }));
      }

      store.setMaxRecords(3);

      expect(store.getRecords()).toHaveLength(3);
    });
  });

  describe('getRecordsByAgent', () => {
    it('should filter records by agentId', () => {
      const task1 = createTestTask({ id: '1', agentId: 'alice' });
      const task2 = createTestTask({ id: '2', agentId: 'bob' });

      store.addRecord(task1);
      store.addRecord(task2);

      expect(store.getRecordsByAgent('alice')).toHaveLength(1);
      expect(store.getRecordsByAgent('bob')).toHaveLength(1);
    });

    it('should include records where agent is in handoffs', () => {
      store.recordHandoff('task-1', 'alice', 'bob');
      store.addRecord(createTestTask({ id: 'task-1', agentId: 'bob' }));

      expect(store.getRecordsByAgent('alice')).toHaveLength(1);
      expect(store.getRecordsByAgent('bob')).toHaveLength(1);
    });

    it('should return empty array for unknown agent', () => {
      store.addRecord(createTestTask({ agentId: 'alice' }));
      expect(store.getRecordsByAgent('unknown')).toHaveLength(0);
    });
  });

  describe('getRecordsByDateRange', () => {
    it('should filter by date range', () => {
      const now = Date.now();
      const task1 = createTestTask({ id: '1', completedAt: now - 2000 });
      const task2 = createTestTask({ id: '2', completedAt: now });

      store.addRecord(task1);
      store.addRecord(task2);

      const filtered = store.getRecordsByDateRange(now - 1000, now + 1000);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].task.id).toBe('2');
    });

    it('should return empty array for range with no records', () => {
      const task = createTestTask({ completedAt: Date.now() });
      store.addRecord(task);

      const filtered = store.getRecordsByDateRange(0, 1000);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('getRecordsByStatus', () => {
    it('should filter by completed status', () => {
      store.addRecord(createTestTask({ id: '1', status: 'completed' }));
      store.addRecord(createTestTask({ id: '2', status: 'failed' }));

      expect(store.getRecordsByStatus('completed')).toHaveLength(1);
      expect(store.getRecordsByStatus('failed')).toHaveLength(1);
    });
  });

  describe('getAverageDuration', () => {
    it('should return 0 for empty store', () => {
      expect(store.getAverageDuration()).toBe(0);
    });

    it('should calculate average duration', () => {
      const now = Date.now();
      store.addRecord(createTestTask({
        id: '1',
        assignedAt: now - 1000,
        completedAt: now,
      }));
      store.addRecord(createTestTask({
        id: '2',
        assignedAt: now - 3000,
        completedAt: now,
      }));

      const avg = store.getAverageDuration();
      expect(avg).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('handoffs', () => {
    it('should record handoffs for a task', () => {
      store.recordHandoff('task-1', 'alice', 'bob');
      store.addRecord(createTestTask({ id: 'task-1' }));

      const record = store.getRecords()[0];
      expect(record.handoffs).toEqual(['alice', 'bob']);
    });

    it('should record multiple handoffs', () => {
      store.recordHandoff('task-1', 'alice', 'bob');
      store.recordHandoff('task-1', 'bob', 'charlie');
      store.addRecord(createTestTask({ id: 'task-1' }));

      const record = store.getRecords()[0];
      expect(record.handoffs).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should handle task with no handoffs', () => {
      store.addRecord(createTestTask({ id: 'task-1' }));

      const record = store.getRecords()[0];
      expect(record.handoffs).toEqual([]);
    });

    it('should clean up handoff data after adding record', () => {
      store.recordHandoff('task-1', 'alice', 'bob');
      store.addRecord(createTestTask({ id: 'task-1' }));

      store.addRecord(createTestTask({ id: 'task-1', assignedAt: Date.now() - 5000 }));
      expect(store.getRecords()[0].handoffs).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all records', () => {
      store.addRecord(createTestTask());
      store.addRecord(createTestTask());
      store.clear();

      expect(store.getRecordCount()).toBe(0);
    });

    it('should clear handoff data', () => {
      store.recordHandoff('task-1', 'alice', 'bob');
      store.clear();
      store.addRecord(createTestTask({ id: 'task-1' }));

      expect(store.getRecords()[0].handoffs).toEqual([]);
    });
  });

  describe('getRecordCount', () => {
    it('should return current record count', () => {
      expect(store.getRecordCount()).toBe(0);
      store.addRecord(createTestTask());
      expect(store.getRecordCount()).toBe(1);
    });
  });
});
