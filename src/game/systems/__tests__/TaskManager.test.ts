import { TaskManager } from '../TaskManager';
import { EventBus } from '../EventBus';
import { Task, TaskStatus } from '../../types/Task';

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    taskManager = new TaskManager(eventBus);
  });

  describe('assignTask', () => {
    it('should assign a task to an agent', () => {
      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      const result = taskManager.getTaskByAgent('alice');
      expect(result).toBeDefined();
      expect(result!.id).toBe(task.id);
      expect(result!.agentId).toBe('alice');
    });

    it('should emit task:assigned event', () => {
      const handler = jest.fn();
      eventBus.on('task:assigned', handler);

      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task:assigned',
          agentId: 'alice',
        })
      );
    });

    it('should set status to assigned', () => {
      const task = createTestTask({ agentId: 'alice', status: 'pending' });
      taskManager.assignTask('alice', task);

      const result = taskManager.getTaskByAgent('alice');
      expect(result!.status).toBe('assigned');
    });

    it('should replace existing task for the same agent', () => {
      const task1 = createTestTask({ id: 'task-1', agentId: 'alice' });
      const task2 = createTestTask({ id: 'task-2', agentId: 'alice' });

      taskManager.assignTask('alice', task1);
      taskManager.assignTask('alice', task2);

      const result = taskManager.getTaskByAgent('alice');
      expect(result!.id).toBe('task-2');
    });
  });

  describe('updateProgress', () => {
    it('should update task progress', () => {
      const task = createTestTask({ agentId: 'alice', progress: 0 });
      taskManager.assignTask('alice', task);

      taskManager.updateProgress('alice', 50);

      const result = taskManager.getTaskByAgent('alice');
      expect(result!.progress).toBe(50);
    });

    it('should update currentAction when provided', () => {
      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      taskManager.updateProgress('alice', 30, 'Writing code...');

      const result = taskManager.getTaskByAgent('alice');
      expect(result!.currentAction).toBe('Writing code...');
    });

    it('should emit task:progress event', () => {
      const handler = jest.fn();
      eventBus.on('task:progress', handler);

      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      taskManager.updateProgress('alice', 50, 'Working...');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task:progress',
          agentId: 'alice',
          progress: 50,
          currentAction: 'Working...',
        })
      );
    });

    it('should set status to working when progress > 0', () => {
      const task = createTestTask({ agentId: 'alice', status: 'assigned' });
      taskManager.assignTask('alice', task);

      taskManager.updateProgress('alice', 10);

      const result = taskManager.getTaskByAgent('alice');
      expect(result!.status).toBe('working');
    });

    it('should not emit event for unknown agent', () => {
      const handler = jest.fn();
      eventBus.on('task:progress', handler);

      taskManager.updateProgress('unknown', 50);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should clamp progress to 0-100 range', () => {
      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      taskManager.updateProgress('alice', 150);
      expect(taskManager.getTaskByAgent('alice')!.progress).toBe(100);

      taskManager.updateProgress('alice', -10);
      expect(taskManager.getTaskByAgent('alice')!.progress).toBe(0);
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed on success', () => {
      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      taskManager.completeTask('alice', 'success');

      const activeTask = taskManager.getTaskByAgent('alice');
      expect(activeTask).toBeUndefined();

      const history = taskManager.getTaskHistory();
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('completed');
      expect(history[0].completedAt).toBeGreaterThan(0);
    });

    it('should mark task as failed on failure', () => {
      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      taskManager.completeTask('alice', 'failure');

      const history = taskManager.getTaskHistory();
      expect(history[0].status).toBe('failed');
    });

    it('should emit task:completed event on success', () => {
      const handler = jest.fn();
      eventBus.on('task:completed', handler);

      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      taskManager.completeTask('alice', 'success');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task:completed',
          agentId: 'alice',
          result: 'success',
        })
      );
    });

    it('should emit task:failed event on failure', () => {
      const handler = jest.fn();
      eventBus.on('task:failed', handler);

      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      taskManager.completeTask('alice', 'failure');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task:failed',
          agentId: 'alice',
        })
      );
    });

    it('should remove task from active tasks', () => {
      const task = createTestTask({ agentId: 'alice' });
      taskManager.assignTask('alice', task);

      taskManager.completeTask('alice', 'success');

      expect(taskManager.getTaskByAgent('alice')).toBeUndefined();
    });
  });

  describe('concurrent tasks', () => {
    it('should support multiple agents with independent tasks', () => {
      const aliceTask = createTestTask({ id: 't1', agentId: 'alice' });
      const bobTask = createTestTask({ id: 't2', agentId: 'bob' });

      taskManager.assignTask('alice', aliceTask);
      taskManager.assignTask('bob', bobTask);

      expect(taskManager.getTaskByAgent('alice')!.id).toBe('t1');
      expect(taskManager.getTaskByAgent('bob')!.id).toBe('t2');
    });

    it('should update progress independently for each agent', () => {
      const aliceTask = createTestTask({ agentId: 'alice' });
      const bobTask = createTestTask({ agentId: 'bob' });

      taskManager.assignTask('alice', aliceTask);
      taskManager.assignTask('bob', bobTask);

      taskManager.updateProgress('alice', 30);
      taskManager.updateProgress('bob', 70);

      expect(taskManager.getTaskByAgent('alice')!.progress).toBe(30);
      expect(taskManager.getTaskByAgent('bob')!.progress).toBe(70);
    });

    it('should not affect other agents when one completes', () => {
      const aliceTask = createTestTask({ agentId: 'alice' });
      const bobTask = createTestTask({ agentId: 'bob' });

      taskManager.assignTask('alice', aliceTask);
      taskManager.assignTask('bob', bobTask);

      taskManager.completeTask('alice', 'success');

      expect(taskManager.getTaskByAgent('alice')).toBeUndefined();
      expect(taskManager.getTaskByAgent('bob')!.id).toBe(bobTask.id);
    });

    it('should return all active tasks', () => {
      taskManager.assignTask('alice', createTestTask({ agentId: 'alice' }));
      taskManager.assignTask('bob', createTestTask({ agentId: 'bob' }));

      const active = taskManager.getAllActiveTasks();
      expect(active).toHaveLength(2);
    });
  });

  describe('getTaskById', () => {
    it('should return task by id from active tasks', () => {
      const task = createTestTask({ id: 'task-42', agentId: 'alice' });
      taskManager.assignTask('alice', task);

      expect(taskManager.getTaskById('task-42')).toBeDefined();
      expect(taskManager.getTaskById('task-42')!.id).toBe('task-42');
    });

    it('should return task by id from history', () => {
      const task = createTestTask({ id: 'task-42', agentId: 'alice' });
      taskManager.assignTask('alice', task);
      taskManager.completeTask('alice', 'success');

      expect(taskManager.getTaskById('task-42')).toBeDefined();
    });

    it('should return undefined for unknown task id', () => {
      expect(taskManager.getTaskById('nonexistent')).toBeUndefined();
    });
  });

  describe('handoverTask', () => {
    it('should transfer task from one agent to another', () => {
      const task = createTestTask({ id: 't1', agentId: 'charlie' });
      taskManager.assignTask('charlie', task);

      taskManager.handoverTask('charlie', 'alice', 't1');

      expect(taskManager.getTaskByAgent('charlie')).toBeUndefined();
      expect(taskManager.getTaskByAgent('alice')!.id).toBe('t1');
      expect(taskManager.getTaskByAgent('alice')!.agentId).toBe('alice');
    });

    it('should emit task:handover event', () => {
      const handler = jest.fn();
      eventBus.on('task:handover', handler);

      const task = createTestTask({ id: 't1', agentId: 'charlie' });
      taskManager.assignTask('charlie', task);

      taskManager.handoverTask('charlie', 'alice', 't1');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task:handover',
          fromAgentId: 'charlie',
          toAgentId: 'alice',
          taskId: 't1',
        })
      );
    });

    it('should emit task:assigned event for the receiving agent', () => {
      const handler = jest.fn();
      eventBus.on('task:assigned', handler);

      const task = createTestTask({ id: 't1', agentId: 'charlie' });
      taskManager.assignTask('charlie', task);

      taskManager.handoverTask('charlie', 'alice', 't1');

      const assignedCalls = handler.mock.calls;
      expect(assignedCalls.length).toBeGreaterThanOrEqual(1);
      const lastCall = assignedCalls[assignedCalls.length - 1][0];
      expect(lastCall.agentId).toBe('alice');
    });
  });

  describe('enqueueTask / dequeueNextTask', () => {
    it('should enqueue a task', () => {
      const task = createTestTask({ id: 't1' });
      taskManager.enqueueTask(task);

      const dequeued = taskManager.dequeueNextTask('alice');
      expect(dequeued).toBeDefined();
      expect(dequeued!.id).toBe('t1');
    });

    it('should sort by priority (high first)', () => {
      const lowTask = createTestTask({
        id: 'low',
        metadata: { priority: 'low' },
      });
      const highTask = createTestTask({
        id: 'high',
        metadata: { priority: 'high' },
      });
      const medTask = createTestTask({
        id: 'med',
        metadata: { priority: 'medium' },
      });

      taskManager.enqueueTask(lowTask);
      taskManager.enqueueTask(highTask);
      taskManager.enqueueTask(medTask);

      expect(taskManager.dequeueNextTask('alice')!.id).toBe('high');
      expect(taskManager.dequeueNextTask('alice')!.id).toBe('med');
      expect(taskManager.dequeueNextTask('alice')!.id).toBe('low');
    });

    it('should return undefined when queue is empty', () => {
      expect(taskManager.dequeueNextTask('alice')).toBeUndefined();
    });
  });

  describe('history cleanup', () => {
    it('should limit history to maxHistorySize', () => {
      const smallManager = new TaskManager(eventBus, { maxHistorySize: 2 });

      for (let i = 0; i < 5; i++) {
        const task = createTestTask({ id: `task-${i}`, agentId: 'alice' });
        smallManager.assignTask('alice', task);
        smallManager.completeTask('alice', 'success');
      }

      expect(smallManager.getTaskHistory().length).toBeLessThanOrEqual(2);
    });
  });

  describe('Phase 2: 4-agent concurrent tasks', () => {
    it('should assign tasks to 4 agents simultaneously', () => {
      const agents = ['alice', 'bob', 'charlie', 'diana'];
      agents.forEach(agent => {
        taskManager.assignTask(agent, createTestTask({ agentId: agent }));
      });

      agents.forEach(agent => {
        expect(taskManager.getTaskByAgent(agent)).toBeDefined();
        expect(taskManager.getTaskByAgent(agent)!.agentId).toBe(agent);
      });
    });

    it('should emit task:assigned for each agent', () => {
      const handler = jest.fn();
      eventBus.on('task:assigned', handler);

      ['alice', 'bob', 'charlie', 'diana'].forEach(agent => {
        taskManager.assignTask(agent, createTestTask({ agentId: agent }));
      });

      expect(handler).toHaveBeenCalledTimes(4);
      const agentIds = handler.mock.calls.map(call => call[0].agentId);
      expect(agentIds).toContain('alice');
      expect(agentIds).toContain('bob');
      expect(agentIds).toContain('charlie');
      expect(agentIds).toContain('diana');
    });

    it('should update progress independently for 4 agents', () => {
      const agents = ['alice', 'bob', 'charlie', 'diana'];
      agents.forEach((agent, i) => {
        taskManager.assignTask(agent, createTestTask({ agentId: agent }));
        taskManager.updateProgress(agent, (i + 1) * 25);
      });

      expect(taskManager.getTaskByAgent('alice')!.progress).toBe(25);
      expect(taskManager.getTaskByAgent('bob')!.progress).toBe(50);
      expect(taskManager.getTaskByAgent('charlie')!.progress).toBe(75);
      expect(taskManager.getTaskByAgent('diana')!.progress).toBe(100);
    });

    it('should maintain Map integrity with 4 active tasks', () => {
      const agents = ['alice', 'bob', 'charlie', 'diana'];
      agents.forEach(agent => {
        taskManager.assignTask(agent, createTestTask({ id: `task-${agent}`, agentId: agent }));
      });

      const allActive = taskManager.getAllActiveTasks();
      expect(allActive).toHaveLength(4);

      const activeIds = allActive.map(t => t.id).sort();
      expect(activeIds).toEqual(['task-alice', 'task-bob', 'task-charlie', 'task-diana']);
    });
  });

  describe('Phase 2: edge cases', () => {
    it('should handle agent completing task then receiving new task', () => {
      taskManager.assignTask('alice', createTestTask({ id: 'task-1', agentId: 'alice' }));
      taskManager.completeTask('alice', 'success');

      expect(taskManager.getTaskByAgent('alice')).toBeUndefined();

      taskManager.assignTask('alice', createTestTask({ id: 'task-2', agentId: 'alice' }));
      expect(taskManager.getTaskByAgent('alice')!.id).toBe('task-2');
    });

    it('should handle agent with no task returning undefined', () => {
      expect(taskManager.getTaskByAgent('alice')).toBeUndefined();
    });

    it('should handle task failure with progress preserved in history', () => {
      taskManager.assignTask('alice', createTestTask({ id: 'fail-task', agentId: 'alice' }));
      taskManager.updateProgress('alice', 60);

      taskManager.completeTask('alice', 'failure');

      expect(taskManager.getTaskByAgent('alice')).toBeUndefined();
      const history = taskManager.getTaskHistory();
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('failed');
      expect(history[0].progress).toBe(60);
    });

    it('should handle completeTask for agent with no task', () => {
      expect(() => taskManager.completeTask('unknown', 'success')).not.toThrow();
    });

    it('should handle handover between busy agents', () => {
      taskManager.assignTask('alice', createTestTask({ id: 't1', agentId: 'alice' }));
      taskManager.assignTask('bob', createTestTask({ id: 't2', agentId: 'bob' }));

      taskManager.handoverTask('alice', 'bob', 't1');

      expect(taskManager.getTaskByAgent('alice')).toBeUndefined();
      expect(taskManager.getTaskByAgent('bob')!.id).toBe('t1');
    });

    it('should handle rapid assign-complete-assign cycles', () => {
      for (let i = 0; i < 10; i++) {
        taskManager.assignTask('alice', createTestTask({ id: `task-${i}`, agentId: 'alice' }));
        taskManager.completeTask('alice', i % 3 === 0 ? 'failure' : 'success');
      }

      expect(taskManager.getTaskByAgent('alice')).toBeUndefined();
      expect(taskManager.getTaskHistory().length).toBe(10);
    });
  });

  describe('Phase 2: performance stress test', () => {
    it('should handle 100 rapid progress updates across 4 agents', () => {
      const agents = ['alice', 'bob', 'charlie', 'diana'];
      agents.forEach(agent => {
        taskManager.assignTask(agent, createTestTask({ agentId: agent }));
      });

      const handler = jest.fn();
      eventBus.on('task:progress', handler);

      for (let i = 0; i < 100; i++) {
        agents.forEach(agent => {
          taskManager.updateProgress(agent, i + 1, `Processing ${i + 1}%`);
        });
      }

      expect(handler).toHaveBeenCalledTimes(400);

      expect(taskManager.getTaskByAgent('alice')!.progress).toBe(100);
      expect(taskManager.getTaskByAgent('bob')!.progress).toBe(100);
      expect(taskManager.getTaskByAgent('charlie')!.progress).toBe(100);
      expect(taskManager.getTaskByAgent('diana')!.progress).toBe(100);
    });

    it('should not leak memory with many task cycles', () => {
      const limitedManager = new TaskManager(eventBus, { maxHistorySize: 50 });

      for (let i = 0; i < 200; i++) {
        limitedManager.assignTask('alice', createTestTask({ id: `task-${i}`, agentId: 'alice' }));
        limitedManager.completeTask('alice', 'success');
      }

      expect(limitedManager.getTaskHistory().length).toBeLessThanOrEqual(50);
      expect(limitedManager.getAllActiveTasks()).toHaveLength(0);
    });
  });
});

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
