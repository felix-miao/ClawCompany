import { TaskStatisticsStore } from '../TaskStatisticsStore';
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

describe('TaskStatisticsStore', () => {
  let historyStore: TaskHistoryStore;
  let statsStore: TaskStatisticsStore;

  beforeEach(() => {
    historyStore = new TaskHistoryStore();
    statsStore = new TaskStatisticsStore(historyStore);
  });

  describe('total tasks', () => {
    it('should return 0 for empty store', () => {
      const stats = statsStore.getStatistics();
      expect(stats.totalTasks).toBe(0);
    });

    it('should calculate total tasks', () => {
      historyStore.addRecord(createTestTask({ id: '1' }));
      historyStore.addRecord(createTestTask({ id: '2' }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.totalTasks).toBe(2);
    });
  });

  describe('completed and failed tasks', () => {
    it('should calculate completed tasks', () => {
      historyStore.addRecord(createTestTask({ id: '1', status: 'completed' }));
      historyStore.addRecord(createTestTask({ id: '2', status: 'failed' }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.completedTasks).toBe(1);
      expect(stats.failedTasks).toBe(1);
    });

    it('should count only completed and failed from total', () => {
      historyStore.addRecord(createTestTask({ id: '1', status: 'completed' }));
      historyStore.addRecord(createTestTask({ id: '2', status: 'completed' }));
      historyStore.addRecord(createTestTask({ id: '3', status: 'failed' }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.totalTasks).toBe(3);
      expect(stats.completedTasks).toBe(2);
      expect(stats.failedTasks).toBe(1);
    });
  });

  describe('success rate', () => {
    it('should return 0 for empty store', () => {
      const stats = statsStore.getStatistics();
      expect(stats.successRate).toBe(0);
    });

    it('should calculate success rate', () => {
      historyStore.addRecord(createTestTask({ id: '1', status: 'completed' }));
      historyStore.addRecord(createTestTask({ id: '2', status: 'completed' }));
      historyStore.addRecord(createTestTask({ id: '3', status: 'failed' }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });

    it('should return 100 when all tasks completed', () => {
      historyStore.addRecord(createTestTask({ id: '1', status: 'completed' }));
      historyStore.addRecord(createTestTask({ id: '2', status: 'completed' }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.successRate).toBe(100);
    });

    it('should return 0 when all tasks failed', () => {
      historyStore.addRecord(createTestTask({ id: '1', status: 'failed' }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.successRate).toBe(0);
    });
  });

  describe('average duration', () => {
    it('should return 0 for empty store', () => {
      const stats = statsStore.getStatistics();
      expect(stats.averageDuration).toBe(0);
    });

    it('should calculate average duration', () => {
      const now = Date.now();
      historyStore.addRecord(createTestTask({
        id: '1',
        assignedAt: now - 1000,
        completedAt: now,
      }));
      historyStore.addRecord(createTestTask({
        id: '2',
        assignedAt: now - 3000,
        completedAt: now,
      }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.averageDuration).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('agent distribution', () => {
    it('should return empty map for no records', () => {
      const stats = statsStore.getStatistics();
      expect(stats.agentDistribution.size).toBe(0);
    });

    it('should calculate agent distribution from handoffs', () => {
      historyStore.recordHandoff('task-1', 'pm', 'dev');
      historyStore.addRecord(createTestTask({ id: 'task-1' }));
      historyStore.recordHandoff('task-2', 'pm', 'reviewer');
      historyStore.addRecord(createTestTask({ id: 'task-2' }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.agentDistribution.get('pm')).toBe(2);
      expect(stats.agentDistribution.get('dev')).toBe(1);
      expect(stats.agentDistribution.get('reviewer')).toBe(1);
    });

    it('should use agentId for tasks without handoffs', () => {
      historyStore.addRecord(createTestTask({ id: '1', agentId: 'alice' }));
      historyStore.addRecord(createTestTask({ id: '2', agentId: 'bob' }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.agentDistribution.get('alice')).toBe(1);
      expect(stats.agentDistribution.get('bob')).toBe(1);
    });

    it('should count handoff agents for each task', () => {
      historyStore.recordHandoff('task-1', 'alice', 'bob');
      historyStore.recordHandoff('task-1', 'bob', 'charlie');
      historyStore.addRecord(createTestTask({ id: 'task-1' }));

      statsStore.update();
      const stats = statsStore.getStatistics();

      expect(stats.agentDistribution.get('alice')).toBe(1);
      expect(stats.agentDistribution.get('bob')).toBe(1);
      expect(stats.agentDistribution.get('charlie')).toBe(1);
    });
  });

  describe('update', () => {
    it('should refresh statistics on update', () => {
      const stats1 = statsStore.getStatistics();
      expect(stats1.totalTasks).toBe(0);

      historyStore.addRecord(createTestTask({ id: '1' }));
      statsStore.update();

      const stats2 = statsStore.getStatistics();
      expect(stats2.totalTasks).toBe(1);
    });
  });
});
