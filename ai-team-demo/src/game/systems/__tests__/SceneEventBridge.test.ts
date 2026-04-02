import { SceneEventBridge, SceneActions } from '../SceneEventBridge';
import { EventBus } from '../EventBus';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: {}) => void) | null = null;
  onopen: (() => void) | null = null;
  url: string;
  readyState: number = 0;

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    this.readyState = MockEventSource.CONNECTING;
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      this.onopen?.();
    }, 0);
  }

  addEventListener() {}
  removeEventListener() {}
  close() { this.readyState = MockEventSource.CLOSED; }

  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

describe('SceneEventBridge', () => {
  let bridge: SceneEventBridge;
  let mockActions: jest.Mocked<SceneActions>;
  let originalEventSource: typeof globalThis.EventSource;

  beforeAll(() => {
    originalEventSource = globalThis.EventSource;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).EventSource = MockEventSource;
  });

  afterAll(() => {
    globalThis.EventSource = originalEventSource;
  });

  beforeEach(() => {
    MockEventSource.reset();
    mockActions = {
      setAgentWorking: jest.fn(),
      moveAgentToRoom: jest.fn(),
      moveAgentToPosition: jest.fn(),
      setAgentEmotion: jest.fn(),
      getAgentStatus: jest.fn().mockReturnValue('idle'),
      triggerParticleEffect: jest.fn(),
    };
    bridge = new SceneEventBridge(mockActions, { url: '/api/game-events' });
  });

  afterEach(() => {
    bridge.disconnect();
  });

  describe('agent:status-change', () => {
    it('should set agent working on busy status', () => {
      bridge.getEventBus().emit({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      });

      expect(mockActions.setAgentWorking).toHaveBeenCalledWith('dev1', true);
    });

    it('should set agent not working on idle status', () => {
      bridge.getEventBus().emit({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'idle',
      });

      expect(mockActions.setAgentWorking).toHaveBeenCalledWith('dev1', false);
    });

    it('should set agent working on working status', () => {
      bridge.getEventBus().emit({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'working',
      });

      expect(mockActions.setAgentWorking).toHaveBeenCalledWith('dev1', true);
    });
  });

  describe('agent:task-assigned', () => {
    it('should move agent to room and set working', () => {
      bridge.getEventBus().emit({
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'dev1',
        taskId: 'task-1',
        taskType: 'coding',
        description: 'Write tests',
        targetRoom: 'dev-studio',
      });

      expect(mockActions.moveAgentToRoom).toHaveBeenCalledWith('dev1', 'dev-studio');
      expect(mockActions.setAgentWorking).toHaveBeenCalledWith('dev1', true);
      expect(mockActions.setAgentEmotion).toHaveBeenCalledWith('dev1', 'focused');
    });

    it('should work without targetRoom', () => {
      bridge.getEventBus().emit({
        type: 'agent:task-assigned',
        timestamp: Date.now(),
        agentId: 'pm',
        taskId: 'task-2',
        taskType: 'meeting',
        description: 'Sprint planning',
      });

      expect(mockActions.setAgentWorking).toHaveBeenCalledWith('pm', true);
      expect(mockActions.moveAgentToRoom).not.toHaveBeenCalled();
    });
  });

  describe('agent:task-completed', () => {
    it('should celebrate on success', () => {
      bridge.getEventBus().emit({
        type: 'agent:task-completed',
        timestamp: Date.now(),
        agentId: 'dev1',
        taskId: 'task-1',
        result: 'success',
        duration: 5000,
      });

      expect(mockActions.setAgentWorking).toHaveBeenCalledWith('dev1', false);
      expect(mockActions.setAgentEmotion).toHaveBeenCalledWith('dev1', 'celebrating');
    });

    it('should show stress on failure', () => {
      bridge.getEventBus().emit({
        type: 'agent:task-completed',
        timestamp: Date.now(),
        agentId: 'dev1',
        taskId: 'task-1',
        result: 'failure',
        duration: 5000,
      });

      expect(mockActions.setAgentEmotion).toHaveBeenCalledWith('dev1', 'stressed');
    });
  });

  describe('agent:navigation-request', () => {
    it('should move agent to room when targetRoom is provided', () => {
      bridge.getEventBus().emit({
        type: 'agent:navigation-request',
        timestamp: Date.now(),
        agentId: 'dev1',
        targetX: 200,
        targetY: 300,
        targetRoom: 'dev-studio',
      });

      expect(mockActions.moveAgentToRoom).toHaveBeenCalledWith('dev1', 'dev-studio');
    });

    it('should move agent to position when no targetRoom', () => {
      bridge.getEventBus().emit({
        type: 'agent:navigation-request',
        timestamp: Date.now(),
        agentId: 'dev1',
        targetX: 200,
        targetY: 300,
      });

      expect(mockActions.moveAgentToPosition).toHaveBeenCalledWith('dev1', 200, 300);
    });
  });

  describe('agent:emotion-change', () => {
    it('should set agent emotion', () => {
      bridge.getEventBus().emit({
        type: 'agent:emotion-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        emotion: 'thinking',
        source: 'task',
      });

      expect(mockActions.setAgentEmotion).toHaveBeenCalledWith('dev1', 'thinking', undefined);
    });

    it('should pass duration to emotion', () => {
      bridge.getEventBus().emit({
        type: 'agent:emotion-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        emotion: 'happy',
        duration: 3000,
        source: 'manual',
      });

      expect(mockActions.setAgentEmotion).toHaveBeenCalledWith('dev1', 'happy', 3000);
    });
  });

  describe('session:started', () => {
    it('should set agent working and move to room', () => {
      bridge.getEventBus().emit({
        type: 'session:started',
        timestamp: Date.now(),
        sessionKey: 'sess-1',
        role: 'dev1',
        task: 'Implement feature',
      });

      expect(mockActions.setAgentWorking).toHaveBeenCalledWith('dev1', true);
      expect(mockActions.setAgentEmotion).toHaveBeenCalledWith('dev1', 'thinking');
      expect(mockActions.moveAgentToRoom).toHaveBeenCalledWith('dev1', 'dev-studio');
    });
  });

  describe('session:completed', () => {
    it('should celebrate on success', () => {
      bridge.getEventBus().emit({
        type: 'session:completed',
        timestamp: Date.now(),
        sessionKey: 'sess-1',
        role: 'dev1',
        status: 'completed',
        duration: 30000,
      });

      expect(mockActions.setAgentWorking).toHaveBeenCalledWith('dev1', false);
      expect(mockActions.setAgentEmotion).toHaveBeenCalledWith('dev1', 'celebrating');
    });

    it('should show stress on failure', () => {
      bridge.getEventBus().emit({
        type: 'session:completed',
        timestamp: Date.now(),
        sessionKey: 'sess-1',
        role: 'dev1',
        status: 'failed',
        duration: 30000,
      });

      expect(mockActions.setAgentEmotion).toHaveBeenCalledWith('dev1', 'stressed');
    });
  });

  describe('stats', () => {
    it('should track events processed', () => {
      expect(bridge.getStats().eventsProcessed).toBe(0);

      bridge.getEventBus().emit({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      });

      expect(bridge.getStats().eventsProcessed).toBe(1);
    });

    it('should track last event time', () => {
      expect(bridge.getStats().lastEventAt).toBeNull();

      bridge.getEventBus().emit({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      });

      expect(bridge.getStats().lastEventAt).toBeGreaterThan(0);
    });
  });

  describe('connect/disconnect', () => {
    it('should connect via session manager', (done) => {
      bridge.getEventBus().on('connection:open', () => {
        expect(bridge.isConnected()).toBe(true);
        done();
      });

      bridge.connect();
    });

    it('should disconnect', (done) => {
      bridge.getEventBus().on('connection:open', () => {
        bridge.disconnect();
        expect(bridge.isConnected()).toBe(false);
        done();
      });

      bridge.connect();
    });
  });

  describe('particle effects integration', () => {
    it('should trigger celebration particle on successful task completion', () => {
      bridge.getEventBus().emit({
        type: 'agent:task-completed',
        timestamp: Date.now(),
        agentId: 'dev1',
        taskId: 'task-1',
        result: 'success',
        duration: 5000,
      });

      expect(mockActions.triggerParticleEffect).toHaveBeenCalledWith('dev1', 'celebration');
    });

    it('should trigger error particle on failed task completion', () => {
      bridge.getEventBus().emit({
        type: 'agent:task-completed',
        timestamp: Date.now(),
        agentId: 'dev1',
        taskId: 'task-1',
        result: 'failure',
        duration: 5000,
      });

      expect(mockActions.triggerParticleEffect).toHaveBeenCalledWith('dev1', 'error');
    });

    it('should trigger work-start particle on busy status change', () => {
      bridge.getEventBus().emit({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'busy',
      });

      expect(mockActions.triggerParticleEffect).toHaveBeenCalledWith('dev1', 'work-start');
    });

    it('should not trigger particle on idle status change', () => {
      bridge.getEventBus().emit({
        type: 'agent:status-change',
        timestamp: Date.now(),
        agentId: 'dev1',
        status: 'idle',
      });

      expect(mockActions.triggerParticleEffect).not.toHaveBeenCalled();
    });

    it('should trigger celebration particle on completed session', () => {
      bridge.getEventBus().emit({
        type: 'session:completed',
        timestamp: Date.now(),
        sessionKey: 'sess-1',
        role: 'dev1',
        status: 'completed',
        duration: 30000,
      });

      expect(mockActions.triggerParticleEffect).toHaveBeenCalledWith('dev1', 'celebration');
    });

    it('should trigger error particle on failed session', () => {
      bridge.getEventBus().emit({
        type: 'session:completed',
        timestamp: Date.now(),
        sessionKey: 'sess-1',
        role: 'dev1',
        status: 'failed',
        duration: 30000,
      });

      expect(mockActions.triggerParticleEffect).toHaveBeenCalledWith('dev1', 'error');
    });

    it('should expose particle system', () => {
      expect(bridge.getParticleSystem()).toBeDefined();
      expect(bridge.getParticleSystem().getAvailablePresets().length).toBeGreaterThan(0);
    });
  });
});
