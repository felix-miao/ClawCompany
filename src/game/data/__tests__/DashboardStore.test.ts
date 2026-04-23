import { DashboardStore } from '../DashboardStore';
import {
  AgentStatusEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  EmotionChangeEvent,
  NavigationRequestEvent,
  SessionStartedEvent,
  SessionCompletedEvent,
  SessionProgressEvent,
  ConnectionEvent,
} from '../../types/GameEvents';
import { createDefaultAgents } from '@/lib/gateway/default-agents';

describe('DashboardStore', () => {
  let store: DashboardStore;

  beforeEach(() => {
    store = new DashboardStore();
  });

  describe('initial state', () => {
    it('should have default agent configs', () => {
      const agents = store.getAgents();
      expect(agents).toHaveLength(4);
      expect(agents.map(a => a.id)).toEqual(['sidekick-claw', 'dev-claw', 'reviewer-claw', 'tester-claw']);
      expect(agents).toEqual(createDefaultAgents());
    });

    it('should keep defaults aligned with gateway ids after refreshes', () => {
      store.loadAgents([]);
      store.reset();

      expect(store.getAgents().map(a => a.id)).toEqual(['sidekick-claw', 'dev-claw', 'reviewer-claw', 'tester-claw']);
    });

    it('should have all agents idle initially', () => {
      const agents = store.getAgents();
      agents.forEach(agent => {
        expect(agent.status).toBe('idle');
      });
    });

    it('should have empty events initially', () => {
      expect(store.getEvents()).toEqual([]);
    });

    it('should have empty active tasks initially', () => {
      expect(store.getActiveTasks()).toEqual([]);
    });

    it('should not be connected initially', () => {
      expect(store.isConnected()).toBe(false);
    });
  });

  describe('processEvent - agent:status-change', () => {
    it('should update agent status', () => {
      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'sidekick-claw',
        status: 'working',
      };

      store.processEvent(event);

      const agent = store.getAgentById('sidekick-claw');
      expect(agent?.status).toBe('working');
    });

    it('should track previous status', () => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev-claw',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev-claw',
        status: 'idle',
        previousStatus: 'busy',
      });

      const agent = store.getAgentById('dev-claw');
      expect(agent?.status).toBe('idle');
    });

    it('should handle unknown agent gracefully', () => {
      const event: AgentStatusEvent = {
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'unknown-agent',
        status: 'working',
      };

      expect(() => store.processEvent(event)).not.toThrow();
      expect(store.getAgentById('unknown-agent')).toBeUndefined();
    });
  });

  describe('processEvent - agent:task-assigned', () => {
    it('should add task to active tasks', () => {
      const event: TaskAssignedEvent = {
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'reviewer-claw',
        taskId: 'task-1',
        taskType: 'review',
        description: 'Review the code',
      };

      store.processEvent(event);

      const tasks = store.getActiveTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        taskId: 'task-1',
        agentId: 'reviewer-claw',
        description: 'Review the code',
      });
    });

    it('should update agent status to working', () => {
      store.processEvent({
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'sidekick-claw',
        taskId: 'task-1',
        taskType: 'develop',
        description: 'Build feature',
      });

      expect(store.getAgentById('sidekick-claw')?.status).toBe('working');
    });
  });

  describe('processEvent - agent:task-completed', () => {
    beforeEach(() => {
      store.processEvent({
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'sidekick-claw',
        taskId: 'task-1',
        taskType: 'develop',
        description: 'Build feature',
      });
    });

    it('should remove task from active tasks', () => {
      store.processEvent({
        type: 'agent:task-completed',
        timestamp: Date.now(),
        agentId: 'sidekick-claw',
        taskId: 'task-1',
        result: 'success',
        duration: 5000,
      });

      expect(store.getActiveTasks()).toHaveLength(0);
    });

    it('should set agent status to idle', () => {
      store.processEvent({
        type: 'agent:task-completed',
        timestamp: Date.now(),
        agentId: 'sidekick-claw',
        taskId: 'task-1',
        result: 'success',
        duration: 5000,
      });

      expect(store.getAgentById('sidekick-claw')?.status).toBe('idle');
    });
  });

  describe('processEvent - agent:emotion-change', () => {
    it('should update agent emotion', () => {
      store.processEvent({
        type: 'agent:emotion-change',
        timestamp: Date.now(),
        agentId: 'tester-claw',
        emotion: 'happy',
        source: 'manual',
      });

      expect(store.getAgentById('tester-claw')?.emotion).toBe('happy');
    });
  });

  describe('processEvent - session events', () => {
    it('should handle session:started', () => {
      store.processEvent({
        type: 'session:started',
        timestamp: Date.now(),
        sessionKey: 'sess-1',
        role: 'pm',
        task: 'Plan sprint',
      });

      expect(store.getSessionCount()).toBe(1);
    });

    it('should handle session:completed', () => {
      store.processEvent({
        type: 'session:started',
        timestamp: Date.now(),
        sessionKey: 'sess-1',
        role: 'pm',
        task: 'Plan sprint',
      });

      store.processEvent({
        type: 'session:completed',
        timestamp: Date.now(),
        sessionKey: 'sess-1',
        role: 'pm',
        status: 'completed',
        duration: 10000,
      });

      expect(store.getCompletedSessionCount()).toBe(1);
    });

    it('should handle session:progress', () => {
      store.processEvent({
        type: 'session:progress',
        timestamp: Date.now(),
        sessionKey: 'sess-1',
        progress: 50,
        message: 'Halfway done',
      });

      const progress = store.getLatestProgress();
      expect(progress).toMatchObject({
        sessionKey: 'sess-1',
        progress: 50,
        message: 'Halfway done',
      });
    });
  });

  describe('processEvent - connection events', () => {
    it('should track connection state on open', () => {
      store.processEvent({
        type: 'connection:open',
        timestamp: Date.now(),
        url: '/api/game-events',
      });

      expect(store.isConnected()).toBe(true);
    });

    it('should track connection state on close', () => {
      store.processEvent({
        type: 'connection:open',
        timestamp: Date.now(),
        url: '/api/game-events',
      });

      store.processEvent({
        type: 'connection:close',
        timestamp: Date.now(),
      });

      expect(store.isConnected()).toBe(false);
    });
  });

  describe('event history', () => {
    it('should store all processed events', () => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: 1000,
        agentId: 'sidekick-claw',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:status-change',
        timestamp: 2000,
        agentId: 'dev-agent',
        status: 'working',
      });

      expect(store.getEvents()).toHaveLength(2);
    });

    it('should limit event history', () => {
      const maxEvents = 50;
      const limitedStore = new DashboardStore(maxEvents);

      for (let i = 0; i < 100; i++) {
        limitedStore.processEvent({
          type: 'agent:status-change',
          timestamp: i * 1000,
          agentId: 'pm-agent',
          status: 'busy',
        });
      }

      expect(limitedStore.getEvents()).toHaveLength(maxEvents);
    });

    it('should get events by type', () => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: 1000,
        agentId: 'pm-agent',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:emotion-change',
        timestamp: 2000,
        agentId: 'pm-agent',
        emotion: 'happy',
        source: 'manual',
      });

      const statusEvents = store.getEventsByType('agent:status-change');
      expect(statusEvents).toHaveLength(1);
    });

    it('should get events by agent', () => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: 1000,
        agentId: 'pm-agent',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:status-change',
        timestamp: 2000,
        agentId: 'dev-agent',
        status: 'working',
      });

      const aliceEvents = store.getEventsByAgent('pm-agent');
      expect(aliceEvents).toHaveLength(1);
    });
  });

  describe('task history recent events', () => {
    it('should track recent events for each task', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: { id: 'task-events', description: 'Test task', taskType: 'feature' },
      });

      store.processEvent({
        type: 'agent:status-change',
        timestamp: 150,
        agentId: 'pm-agent',
        status: 'working',
      });

      store.processEvent({
        type: 'task:handover',
        timestamp: 200,
        fromAgentId: 'pm-agent',
        toAgentId: 'dev-agent',
        taskId: 'task-events',
        description: 'Test task',
      });

      store.processEvent({
        type: 'agent:status-change',
        timestamp: 250,
        agentId: 'dev-agent',
        status: 'working',
      });

      const task = store.getTaskHistoryById('task-events');
      expect(task?.recentEvents).toBeDefined();
      expect(task?.recentEvents?.length).toBeGreaterThanOrEqual(2);
    });

    it('should include error in recent events for failed tasks', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'dev-agent',
        task: { id: 'task-fail', description: 'Failing task', taskType: 'bugfix' },
      });

      store.processEvent({
        type: 'task:failed',
        timestamp: 200,
        agentId: 'dev-agent',
        taskId: 'task-fail',
        error: 'compilation error: undefined variable',
      });

      const task = store.getTaskHistoryById('task-fail');
      expect(task?.status).toBe('failed');
      expect(task?.recentEvents).toBeDefined();
      const errorEvent = task?.recentEvents?.find(e => e.type === 'task:failed');
      expect(errorEvent).toBeDefined();
    });

    it('should limit recent events to last 5 per task', () => {
      const store2 = new DashboardStore(100);

      store2.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: { id: 'task-many', description: 'Many events task', taskType: 'feature' },
      });

      for (let i = 0; i < 10; i++) {
        store2.processEvent({
          type: 'agent:status-change',
          timestamp: 200 + i * 10,
          agentId: 'pm-agent',
          status: i % 2 === 0 ? 'working' : 'idle',
        });
      }

      const task = store2.getTaskHistoryById('task-many');
      expect(task?.recentEvents?.length).toBeLessThanOrEqual(5);
    });
  });

  describe('task failure summary', () => {
    it('should derive failure summary from failed task events', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'dev-agent',
        task: { id: 'task-fail-summary', description: 'Test failure', taskType: 'bugfix' },
      });

      store.processEvent({
        type: 'task:failed',
        timestamp: 200,
        agentId: 'dev-agent',
        taskId: 'task-fail-summary',
        error: 'Test failed: assertion error in test suite',
      });

      const task = store.getTaskHistoryById('task-fail-summary');
      expect(task?.failureSummary).toBeDefined();
      expect(task?.failureSummary).toContain('Test failed');
    });

    it('should show error details for failed reviewer stage', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: { id: 'task-review-fail', description: 'Code review task', taskType: 'feature' },
      });

      store.processEvent({
        type: 'task:handover',
        timestamp: 150,
        fromAgentId: 'pm-agent',
        toAgentId: 'dev-agent',
        taskId: 'task-review-fail',
        description: 'Code review task',
      });

      store.processEvent({
        type: 'task:handover',
        timestamp: 200,
        fromAgentId: 'dev-agent',
        toAgentId: 'review-agent',
        taskId: 'task-review-fail',
        description: 'Code review task',
      });

      store.processEvent({
        type: 'task:failed',
        timestamp: 250,
        agentId: 'review-agent',
        taskId: 'task-review-fail',
        error: 'Security vulnerability detected in auth module',
      });

      const task = store.getTaskHistoryById('task-review-fail');
      expect(task?.status).toBe('failed');
      expect(task?.failureSummary).toBeDefined();
      expect(task?.failureSummary).toContain('Security vulnerability');
    });
  });

  describe('iteration and rework tracking', () => {
    it('should track dev:iteration-start events', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: { id: 'task-iter', description: 'Task with iterations', taskType: 'feature' },
      });

      store.processEvent({
        type: 'dev:iteration-start',
        timestamp: 200,
        taskId: 'task-iter',
        iteration: 1,
        hasFeedback: false,
      });

      store.processEvent({
        type: 'dev:iteration-start',
        timestamp: 300,
        taskId: 'task-iter',
        iteration: 2,
        hasFeedback: true,
      });

      const task = store.getTaskHistoryById('task-iter');
      expect(task).toBeDefined();
      expect(task?.iterationCount).toBe(2);
    });

    it('should track review:rejected events and store feedback', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: { id: 'task-reject', description: 'Task to be rejected', taskType: 'feature' },
      });

      store.processEvent({
        type: 'dev:iteration-start',
        timestamp: 200,
        taskId: 'task-reject',
        iteration: 1,
        hasFeedback: false,
      });

      store.processEvent({
        type: 'review:rejected',
        timestamp: 300,
        taskId: 'task-reject',
        iteration: 1,
        feedback: 'Missing unit tests for the new API endpoint',
      });

      const task = store.getTaskHistoryById('task-reject');
      expect(task?.rejectionCount).toBe(1);
      expect(task?.lastReviewFeedback).toBe('Missing unit tests for the new API endpoint');
    });

    it('should track multiple rejections', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: { id: 'task-multi-reject', description: 'Task with multiple rejections', taskType: 'feature' },
      });

      store.processEvent({
        type: 'review:rejected',
        timestamp: 200,
        taskId: 'task-multi-reject',
        iteration: 1,
        feedback: 'First round feedback',
      });

      store.processEvent({
        type: 'dev:iteration-start',
        timestamp: 250,
        taskId: 'task-multi-reject',
        iteration: 2,
        hasFeedback: true,
      });

      store.processEvent({
        type: 'review:rejected',
        timestamp: 300,
        taskId: 'task-multi-reject',
        iteration: 2,
        feedback: 'Second round feedback - still missing tests',
      });

      const task = store.getTaskHistoryById('task-multi-reject');
      expect(task?.rejectionCount).toBe(2);
      expect(task?.iterationCount).toBe(2);
      expect(task?.lastReviewFeedback).toBe('Second round feedback - still missing tests');
    });

    it('should mark task as in rework when iteration > 1', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: { id: 'task-rework', description: 'Task in rework', taskType: 'feature' },
      });

      store.processEvent({
        type: 'dev:iteration-start',
        timestamp: 200,
        taskId: 'task-rework',
        iteration: 1,
        hasFeedback: false,
      });

      store.processEvent({
        type: 'review:rejected',
        timestamp: 300,
        taskId: 'task-rework',
        iteration: 1,
        feedback: 'Code quality issues',
      });

      store.processEvent({
        type: 'dev:iteration-start',
        timestamp: 400,
        taskId: 'task-rework',
        iteration: 2,
        hasFeedback: true,
      });

      const task = store.getTaskHistoryById('task-rework');
      expect(task?.isInRework).toBe(true);
      expect(task?.iterationCount).toBe(2);
    });

    it('should track workflow:iteration-complete with approved status', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: { id: 'task-approved', description: 'Task to be approved', taskType: 'feature' },
      });

      store.processEvent({
        type: 'dev:iteration-start',
        timestamp: 200,
        taskId: 'task-approved',
        iteration: 1,
        hasFeedback: false,
      });

      store.processEvent({
        type: 'workflow:iteration-complete',
        timestamp: 300,
        taskId: 'task-approved',
        totalIterations: 1,
        approved: true,
      });

      const task = store.getTaskHistoryById('task-approved');
      expect(task?.lastApproved).toBe(true);
    });

    it('should handle review rejection followed by approved iteration', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: { id: 'task-retry', description: 'Task with retry then approved', taskType: 'feature' },
      });

      store.processEvent({
        type: 'review:rejected',
        timestamp: 200,
        taskId: 'task-retry',
        iteration: 1,
        feedback: 'Initial rejection',
      });

      store.processEvent({
        type: 'dev:iteration-start',
        timestamp: 250,
        taskId: 'task-retry',
        iteration: 2,
        hasFeedback: true,
      });

      store.processEvent({
        type: 'workflow:iteration-complete',
        timestamp: 300,
        taskId: 'task-retry',
        totalIterations: 2,
        approved: true,
      });

      const task = store.getTaskHistoryById('task-retry');
      expect(task?.rejectionCount).toBe(1);
      expect(task?.iterationCount).toBe(2);
      expect(task?.lastApproved).toBe(true);
    });
  });

  describe('task history timeline', () => {
    it('should derive a task timeline from visualization events', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'pm-agent',
        task: {
          id: 'task-1',
          description: '实现传统任务视图',
          taskType: 'feature',
        },
      });

      store.processEvent({
        type: 'task:handover',
        timestamp: 200,
        fromAgentId: 'pm-agent',
        toAgentId: 'dev-agent',
        taskId: 'task-1',
        description: '实现传统任务视图',
      });

      store.processEvent({
        type: 'task:handover',
        timestamp: 300,
        fromAgentId: 'dev-agent',
        toAgentId: 'review-agent',
        taskId: 'task-1',
        description: '实现传统任务视图',
      });

      store.processEvent({
        type: 'task:completed',
        timestamp: 400,
        agentId: 'review-agent',
        taskId: 'task-1',
        result: 'success',
        duration: 100,
      });

      const [task] = store.getTaskHistory();
      expect(task).toMatchObject({
        taskId: 'task-1',
        description: '实现传统任务视图',
        currentPhase: 'done',
        status: 'completed',
        result: 'success',
      });

      const developerPhase = task.phases.find(phase => phase.phase === 'developer');
      const reviewerPhase = task.phases.find(phase => phase.phase === 'reviewer');
      const donePhase = task.phases.find(phase => phase.phase === 'done');

      expect(developerPhase).toMatchObject({ status: 'completed', agentId: 'dev-agent' });
      expect(reviewerPhase).toMatchObject({ status: 'completed', agentId: 'review-agent' });
      expect(donePhase).toMatchObject({ status: 'completed' });
    });

    it('should mark failed tasks and clear them from active tasks', () => {
      store.processEvent({
        type: 'task:assigned',
        timestamp: 100,
        agentId: 'dev-agent',
        task: {
          id: 'task-2',
          description: '处理错误态',
          taskType: 'bugfix',
        },
      });

      store.processEvent({
        type: 'task:failed',
        timestamp: 200,
        agentId: 'dev-agent',
        taskId: 'task-2',
        error: 'unit tests failed',
      });

      const task = store.getTaskHistoryById('task-2');
      const donePhase = task?.phases.find(phase => phase.phase === 'done');

      expect(task).toMatchObject({
        taskId: 'task-2',
        currentPhase: 'done',
        status: 'failed',
        result: 'failure',
      });
      expect(donePhase).toMatchObject({ status: 'failed' });
      expect(store.getActiveTasks()).toEqual([]);
    });
  });

  describe('subscriber notifications', () => {
    it('should notify subscribers on event', () => {
      const callback = jest.fn();
      store.subscribe(callback);

      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'pm-agent',
        status: 'busy',
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const callback = jest.fn();
      const unsub = store.subscribe(callback);

      unsub();

      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'pm-agent',
        status: 'busy',
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify multiple subscribers', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      store.subscribe(cb1);
      store.subscribe(cb2);

      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'pm-agent',
        status: 'busy',
      });

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAgentById', () => {
    it('should return agent by id', () => {
      const alice = store.getAgentById('sidekick-claw');
      expect(alice).toMatchObject({
        id: 'sidekick-claw',
        name: 'PM',
        role: 'PM',
      });
    });

    it('should return undefined for unknown agent', () => {
      expect(store.getAgentById('unknown')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return dashboard stats', () => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'sidekick-claw',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'sidekick-claw',
        taskId: 'task-1',
        taskType: 'develop',
        description: 'Build',
      });

      const stats = store.getStats();
      expect(stats).toMatchObject({
        totalEvents: 2,
        activeTasks: 1,
        sessionCount: 0,
        connected: false,
      });
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'pm-agent',
        status: 'busy',
      });

      store.reset();

      expect(store.getEvents()).toEqual([]);
      expect(store.getAgentById('sidekick-claw')?.status).toBe('idle');
      expect(store.getActiveTasks()).toEqual([]);
    });

    it('should clear all events on reset', () => {
      const maxEvents = 10;
      const storeWithLimit = new DashboardStore(maxEvents);

      for (let i = 0; i < 20; i++) {
        storeWithLimit.processEvent({
          type: 'agent:status-change',
          timestamp: i,
          agentId: 'sidekick-claw',
          status: 'busy',
        });
      }

      storeWithLimit.reset();

      expect(storeWithLimit.getEvents()).toEqual([]);
      expect(storeWithLimit.getStats().totalEvents).toBe(0);
    });
  });

  describe('ring buffer behavior', () => {
    it('should keep only latest N events when exceeding maxEvents', () => {
      const maxEvents = 5;
      const limitedStore = new DashboardStore(maxEvents);

      for (let i = 0; i < 10; i++) {
        limitedStore.processEvent({
          type: 'agent:status-change',
          timestamp: i,
          agentId: 'pm-agent',
          status: 'busy',
        });
      }

      const events = limitedStore.getEvents();
      expect(events).toHaveLength(maxEvents);

      const timestamps = events.map(e => e.timestamp);
      expect(timestamps).toEqual([5, 6, 7, 8, 9]);
    });

    it('should maintain chronological order after exceeding maxEvents', () => {
      const maxEvents = 3;
      const limitedStore = new DashboardStore(maxEvents);

      limitedStore.processEvent({ type: 'agent:status-change', timestamp: 100, agentId: 'pm-agent', status: 'busy' });
      limitedStore.processEvent({ type: 'agent:status-change', timestamp: 200, agentId: 'dev-agent', status: 'working' });
      limitedStore.processEvent({ type: 'agent:status-change', timestamp: 300, agentId: 'test-agent', status: 'idle' });
      limitedStore.processEvent({ type: 'agent:status-change', timestamp: 400, agentId: 'pm-agent', status: 'working' });

      const events = limitedStore.getEvents();
      expect(events).toHaveLength(3);
      expect(events[0].timestamp).toBe(200);
      expect(events[1].timestamp).toBe(300);
      expect(events[2].timestamp).toBe(400);
    });

    it('should keep correct order after many events', () => {
      const maxEvents = 50;
      const limitedStore = new DashboardStore(maxEvents);

      for (let i = 0; i < 200; i++) {
        limitedStore.processEvent({
          type: 'agent:status-change',
          timestamp: i * 1000,
          agentId: 'pm-agent',
          status: 'busy',
        });
      }

      const events = limitedStore.getEvents();
      expect(events).toHaveLength(50);
      expect(events[0].timestamp).toBe(150000);
      expect(events[49].timestamp).toBe(199000);
    });

    it('should maintain correct order after reset and new events', () => {
      const maxEvents = 5;
      const limitedStore = new DashboardStore(maxEvents);

      for (let i = 0; i < 10; i++) {
        limitedStore.processEvent({
          type: 'agent:status-change',
          timestamp: i,
          agentId: 'pm-agent',
          status: 'busy',
        });
      }

      limitedStore.reset();

      limitedStore.processEvent({ type: 'agent:status-change', timestamp: 1000, agentId: 'pm-agent', status: 'working' });
      limitedStore.processEvent({ type: 'agent:status-change', timestamp: 2000, agentId: 'dev-agent', status: 'busy' });
      limitedStore.processEvent({ type: 'agent:status-change', timestamp: 3000, agentId: 'test-agent', status: 'idle' });

      const events = limitedStore.getEvents();
      expect(events).toHaveLength(3);
      expect(events[0].timestamp).toBe(1000);
      expect(events[1].timestamp).toBe(2000);
      expect(events[2].timestamp).toBe(3000);
    });
  });
});
