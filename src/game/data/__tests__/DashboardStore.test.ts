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

describe('DashboardStore', () => {
  let store: DashboardStore;

  beforeEach(() => {
    store = new DashboardStore();
  });

  describe('initial state', () => {
    it('should have default agent configs', () => {
      const agents = store.getAgents();
      expect(agents).toHaveLength(4);
      expect(agents.map(a => a.id)).toEqual(['alice', 'bob', 'charlie', 'diana']);
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
        agentId: 'alice',
        status: 'working',
      };

      store.processEvent(event);

      const agent = store.getAgentById('alice');
      expect(agent?.status).toBe('working');
    });

    it('should track previous status', () => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'bob',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'bob',
        status: 'idle',
        previousStatus: 'busy',
      });

      const agent = store.getAgentById('bob');
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
        agentId: 'charlie',
        taskId: 'task-1',
        taskType: 'review',
        description: 'Review the code',
      };

      store.processEvent(event);

      const tasks = store.getActiveTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        taskId: 'task-1',
        agentId: 'charlie',
        description: 'Review the code',
      });
    });

    it('should update agent status to working', () => {
      store.processEvent({
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'alice',
        taskId: 'task-1',
        taskType: 'develop',
        description: 'Build feature',
      });

      expect(store.getAgentById('alice')?.status).toBe('working');
    });
  });

  describe('processEvent - agent:task-completed', () => {
    beforeEach(() => {
      store.processEvent({
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'alice',
        taskId: 'task-1',
        taskType: 'develop',
        description: 'Build feature',
      });
    });

    it('should remove task from active tasks', () => {
      store.processEvent({
        type: 'agent:task-completed',
        timestamp: Date.now(),
        agentId: 'alice',
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
        agentId: 'alice',
        taskId: 'task-1',
        result: 'success',
        duration: 5000,
      });

      expect(store.getAgentById('alice')?.status).toBe('idle');
    });
  });

  describe('processEvent - agent:emotion-change', () => {
    it('should update agent emotion', () => {
      store.processEvent({
        type: 'agent:emotion-change',
        timestamp: Date.now(),
        agentId: 'diana',
        emotion: 'happy',
        source: 'manual',
      });

      expect(store.getAgentById('diana')?.emotion).toBe('happy');
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
        agentId: 'alice',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:status-change',
        timestamp: 2000,
        agentId: 'bob',
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
          agentId: 'alice',
          status: 'busy',
        });
      }

      expect(limitedStore.getEvents()).toHaveLength(maxEvents);
    });

    it('should get events by type', () => {
      store.processEvent({
        type: 'agent:status-change',
        timestamp: 1000,
        agentId: 'alice',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:emotion-change',
        timestamp: 2000,
        agentId: 'alice',
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
        agentId: 'alice',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:status-change',
        timestamp: 2000,
        agentId: 'bob',
        status: 'working',
      });

      const aliceEvents = store.getEventsByAgent('alice');
      expect(aliceEvents).toHaveLength(1);
    });
  });

  describe('subscriber notifications', () => {
    it('should notify subscribers on event', () => {
      const callback = jest.fn();
      store.subscribe(callback);

      store.processEvent({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'alice',
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
        agentId: 'alice',
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
        agentId: 'alice',
        status: 'busy',
      });

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAgentById', () => {
    it('should return agent by id', () => {
      const alice = store.getAgentById('alice');
      expect(alice).toMatchObject({
        id: 'alice',
        name: 'Alice',
        role: 'Developer',
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
        agentId: 'alice',
        status: 'busy',
      });

      store.processEvent({
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'alice',
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
        agentId: 'alice',
        status: 'busy',
      });

      store.reset();

      expect(store.getEvents()).toEqual([]);
      expect(store.getAgentById('alice')?.status).toBe('idle');
      expect(store.getActiveTasks()).toEqual([]);
    });
  });
});
