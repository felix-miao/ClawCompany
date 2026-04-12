import { DashboardStore } from '../DashboardStore';
import {
  TaskVisualizationAssignedEvent,
  TaskVisualizationHandoverEvent,
  TaskVisualizationProgressEvent,
  TaskVisualizationFailedEvent,
  SessionProgressEvent,
} from '../../types/GameEvents';

describe('DashboardStore blocker signal derivation', () => {
  let store: DashboardStore;

  beforeEach(() => {
    store = new DashboardStore();
  });

  describe('real-time blocker signal from session:progress', () => {
    it('should track latest session progress for active task identification', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: Date.now() - 10000,
        task: { id: 'task-1', description: 'Test task', taskType: 'feature' },
        agentId: 'dev-agent',
      } as any);

      store.processEvent({
        type: 'session:progress',
        timestamp: Date.now() - 5000,
        sessionKey: 'session-1',
        progress: 25,
        message: 'Implementing authentication flow',
      } as SessionProgressEvent);

      const progress = store.getLatestProgress();
      expect(progress).toMatchObject({
        progress: 25,
        message: 'Implementing authentication flow',
      });
    });

    it('should update session progress as task advances', () => {
      store.processEvent({
        type: 'session:progress',
        timestamp: Date.now() - 60000,
        sessionKey: 'session-1',
        progress: 10,
        message: 'Starting',
      } as SessionProgressEvent);

      store.processEvent({
        type: 'session:progress',
        timestamp: Date.now() - 30000,
        sessionKey: 'session-1',
        progress: 50,
        message: 'Processing data',
      } as SessionProgressEvent);

      const progress = store.getLatestProgress();
      expect(progress?.progress).toBe(50);
      expect(progress?.message).toBe('Processing data');
    });
  });

  describe('task progress derived from recent events', () => {
    it('should tolerate legacy task:assigned payloads without nested task data', () => {
      expect(() => {
        store.processEvent({
          type: 'task:assigned',
          timestamp: Date.now() - 20000,
          taskId: 'legacy-task-1',
          description: 'Legacy payload task',
          agentId: 'dev-agent',
        } as any)
      }).not.toThrow()

      const task = store.getTaskHistoryById('legacy-task-1')
      expect(task?.description).toBe('Legacy payload task')
      expect(store.getActiveTasks()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taskId: 'legacy-task-1', description: 'Legacy payload task' }),
        ])
      )
    })

    it('should track progress percentage from task:progress events', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: Date.now() - 20000,
        task: { id: 'task-1', description: 'Feature task', taskType: 'feature' },
        agentId: 'dev-agent',
      } as TaskVisualizationAssignedEvent);

      store.processEvent({
        type: 'task:progress',
        timestamp: Date.now() - 10000,
        taskId: 'task-1',
        progress: 30,
        currentAction: 'Implementing feature A',
        agentId: 'dev-agent',
      } as TaskVisualizationProgressEvent);

      const task = store.getTaskHistoryById('task-1');
      expect(task).toBeDefined();
      const progressEvent = task?.recentEvents.find(e => e.type === 'task:progress');
      expect(progressEvent).toBeDefined();
      expect((progressEvent as any)?.progress).toBe(30);
    });

    it('should keep only last 5 recent events per task', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: Date.now() - 20000,
        task: { id: 'task-1', description: 'Test task', taskType: 'feature' },
        agentId: 'dev-agent',
      } as TaskVisualizationAssignedEvent);

      const taskId = 'task-1';
      for (let i = 0; i < 7; i++) {
        store.processEvent({
          type: 'task:progress',
          timestamp: Date.now() - (7 - i) * 1000,
          taskId,
          progress: i * 10,
          currentAction: `Action ${i}`,
          agentId: 'dev-agent',
        } as TaskVisualizationProgressEvent);
      }

      const task = store.getTaskHistoryById(taskId);
      expect(task?.recentEvents).toHaveLength(5);
    });
  });

  describe('failure phase and failure summary tracking', () => {
    it('should track failure summary from task:failed event', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: Date.now() - 10000,
        task: { id: 'task-1', description: 'Test task', taskType: 'feature' },
        agentId: 'dev-agent',
      } as TaskVisualizationAssignedEvent);

      store.processEvent({
        type: 'task:failed',
        timestamp: Date.now(),
        taskId: 'task-1',
        error: 'compilation error: undefined variable x',
        agentId: 'dev-agent',
        result: 'failure',
      } as TaskVisualizationFailedEvent);

      const task = store.getTaskHistoryById('task-1');
      expect(task?.status).toBe('failed');
      expect(task?.failureSummary).toBe('compilation error: undefined variable x');
    });

    it('should mark the failed phase in task phases', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: Date.now() - 20000,
        task: { id: 'task-2', description: 'Test task', taskType: 'feature' },
        agentId: 'dev-agent',
      } as TaskVisualizationAssignedEvent);

      store.processEvent({
        type: 'task:failed',
        timestamp: Date.now() - 5000,
        taskId: 'task-2',
        error: 'test suite failed',
        agentId: 'test-agent',
        result: 'failure',
      } as TaskVisualizationFailedEvent);

      const task = store.getTaskHistoryById('task-2');
      expect(task?.status).toBe('failed');
      
      const failedPhase = task?.phases.find(p => p.status === 'failed');
      expect(failedPhase?.phase).toBe('tester');
    });

    it('should store failure summary in task history', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: Date.now() - 15000,
        task: { id: 'task-3', description: 'Feature', taskType: 'feature' },
        agentId: 'dev-agent',
      } as TaskVisualizationAssignedEvent);

      store.processEvent({
        type: 'task:failed',
        timestamp: Date.now(),
        taskId: 'task-3',
        error: 'TypeScript compilation failed: Cannot find name logger',
        agentId: 'dev-agent',
        result: 'failure',
      } as TaskVisualizationFailedEvent);

      const task = store.getTaskHistoryById('task-3');
      expect(task?.failureSummary).toBe('TypeScript compilation failed: Cannot find name logger');
    });
  });

  describe('waiting-on-someone detection from handover events', () => {
    it('should detect when task is handed over to another agent', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: Date.now() - 30000,
        task: { id: 'task-1', description: 'Feature', taskType: 'feature' },
        agentId: 'dev-agent',
      } as TaskVisualizationAssignedEvent);

      store.processEvent({
        type: 'task:handover',
        timestamp: Date.now() - 10000,
        taskId: 'task-1',
        description: 'Feature',
        fromAgentId: 'dev-agent',
        toAgentId: 'review-agent',
      } as TaskVisualizationHandoverEvent);

      const task = store.getTaskHistoryById('task-1');
      const lastEvent = task?.recentEvents[task.recentEvents.length - 1];
      expect(lastEvent?.type).toBe('task:handover');
      expect((lastEvent as any)?.toAgentId).toBe('review-agent');
    });
  });
});
