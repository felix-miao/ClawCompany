import {
  GameSDK,
  GameSDKConfig,
  GameSDKState,
} from '../GameSDK';

describe('GameSDK', () => {
  let sdk: GameSDK;

  beforeEach(() => {
    sdk = new GameSDK();
  });

  afterEach(() => {
    sdk.destroy();
  });

  const validConfig: GameSDKConfig = {
    containerId: 'test-container',
    width: 800,
    height: 600,
    agents: [
      { id: 'alice', name: 'Alice', role: 'Developer' },
      { id: 'bob', name: 'Bob', role: 'PM' },
    ],
  };

  describe('constructor', () => {
    it('should initialize with idle state', () => {
      expect(sdk.getState()).toBe('idle');
    });

    it('should have no active agents', () => {
      expect(sdk.getAgents()).toEqual([]);
    });

    it('should not be connected', () => {
      expect(sdk.isConnected()).toBe(false);
    });

    it('should accept config in constructor', () => {
      const configured = new GameSDK(validConfig);
      expect(configured.getConfig().containerId).toBe('test-container');
      configured.destroy();
    });
  });

  describe('configure', () => {
    it('should accept configuration', () => {
      sdk.configure(validConfig);
      expect(sdk.getConfig().containerId).toBe('test-container');
    });

    it('should validate configuration', () => {
      expect(() => {
        sdk.configure({ containerId: '', width: -1, height: -1, agents: [] });
      }).toThrow();
    });

    it('should collect validation warnings', () => {
      const config = { ...validConfig, width: 200 };
      sdk.configure(config);
      expect(sdk.getWarnings().length).toBeGreaterThan(0);
    });

    it('should throw if already started', () => {
      sdk.configure(validConfig);
      sdk.simulateStart();
      expect(() => sdk.configure(validConfig)).toThrow();
    });
  });

  describe('validate', () => {
    it('should return validation result without throwing', () => {
      const result = sdk.validate(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid result for bad config', () => {
      const result = sdk.validate({ containerId: '', width: 0, height: 0, agents: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('event system', () => {
    it('should support on/emit pattern', () => {
      const handler = jest.fn();
      sdk.on('agent:select', handler);
      sdk.emit('agent:select', { agentId: 'alice' });
      expect(handler).toHaveBeenCalledWith({ agentId: 'alice' });
    });

    it('should support off to remove handler', () => {
      const handler = jest.fn();
      sdk.on('agent:select', handler);
      sdk.off('agent:select', handler);
      sdk.emit('agent:select', { agentId: 'alice' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support once for one-time handlers', () => {
      const handler = jest.fn();
      sdk.once('agent:select', handler);
      sdk.emit('agent:select', { agentId: 'alice' });
      sdk.emit('agent:select', { agentId: 'bob' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support wildcard handler', () => {
      const handler = jest.fn();
      sdk.on('*', handler);
      sdk.emit('agent:select', { agentId: 'alice' });
      sdk.emit('connection:open', {});
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should not throw on emit with no listeners', () => {
      expect(() => sdk.emit('agent:select', {})).not.toThrow();
    });
  });

  describe('agent management', () => {
    beforeEach(() => {
      sdk.configure(validConfig);
      sdk.simulateStart();
    });

    it('should return configured agents', () => {
      const agents = sdk.getAgents();
      expect(agents).toHaveLength(2);
      expect(agents[0].id).toBe('alice');
    });

    it('should get agent by id', () => {
      const agent = sdk.getAgent('alice');
      expect(agent).not.toBeNull();
      expect(agent!.id).toBe('alice');
      expect(agent!.name).toBe('Alice');
    });

    it('should return null for unknown agent', () => {
      expect(sdk.getAgent('unknown')).toBeNull();
    });

    it('should update agent status', () => {
      sdk.setAgentStatus('alice', 'working');
      const agent = sdk.getAgent('alice');
      expect(agent!.status).toBe('working');
    });

    it('should update agent emotion', () => {
      sdk.setAgentEmotion('alice', 'focused');
      const agent = sdk.getAgent('alice');
      expect(agent!.emotion).toBe('focused');
    });

    it('should clear agent emotion', () => {
      sdk.setAgentEmotion('alice', 'focused');
      sdk.setAgentEmotion('alice', null);
      const agent = sdk.getAgent('alice');
      expect(agent!.emotion).toBeNull();
    });

    it('should assign task to agent', () => {
      sdk.assignTask('alice', 'Build feature');
      const agent = sdk.getAgent('alice');
      expect(agent!.currentTask).toBe('Build feature');
      expect(agent!.status).toBe('working');
    });

    it('should clear task when setting idle', () => {
      sdk.assignTask('alice', 'Task');
      sdk.setAgentStatus('alice', 'idle');
      const agent = sdk.getAgent('alice');
      expect(agent!.currentTask).toBeNull();
      expect(agent!.status).toBe('idle');
    });

    it('should emit events when status changes', () => {
      const handler = jest.fn();
      sdk.on('agent:status-change', handler);
      sdk.setAgentStatus('alice', 'working');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        agentId: 'alice',
        status: 'working',
      }));
    });

    it('should emit events when emotion changes', () => {
      const handler = jest.fn();
      sdk.on('agent:emotion-change', handler);
      sdk.setAgentEmotion('alice', 'happy');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        agentId: 'alice',
        emotion: 'happy',
      }));
    });

    it('should emit events when task is assigned', () => {
      const handler = jest.fn();
      sdk.on('agent:task-assigned', handler);
      sdk.assignTask('alice', 'New task');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        agentId: 'alice',
        task: 'New task',
      }));
    });
  });

  describe('state management', () => {
    beforeEach(() => {
      sdk.configure(validConfig);
      sdk.simulateStart();
    });

    it('should save state to GameStateManager', () => {
      const state = sdk.saveState({ label: 'test-save' });
      expect(state.agents).toHaveLength(2);
      expect(state.metadata.label).toBe('test-save');
    });

    it('should restore state from snapshot', () => {
      sdk.setAgentStatus('alice', 'working');
      sdk.setAgentEmotion('alice', 'focused');
      const saved = sdk.saveState({ label: 'working-state' });

      sdk.setAgentStatus('alice', 'idle');
      sdk.setAgentEmotion('alice', null);

      sdk.restoreState(saved);
      const agent = sdk.getAgent('alice');
      expect(agent!.status).toBe('working');
      expect(agent!.emotion).toBe('focused');
    });

    it('should list saved snapshots', () => {
      sdk.saveState({ label: 'save-1' });
      sdk.saveState({ label: 'save-2' });
      const snapshots = sdk.listSnapshots();
      expect(snapshots).toHaveLength(2);
    });

    it('should export state as string', () => {
      const state = sdk.saveState();
      const exported = sdk.exportState(state);
      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThan(0);
    });

    it('should import state from string', () => {
      const state = sdk.saveState({ label: 'export-test' });
      const exported = sdk.exportState(state);
      const imported = sdk.importState(exported);
      expect(imported).not.toBeNull();
      expect(imported!.metadata.label).toBe('export-test');
    });

    it('should return null for corrupt import', () => {
      expect(sdk.importState('garbage!!!data')).toBeNull();
    });
  });

  describe('lifecycle', () => {
    it('should track state transitions', () => {
      expect(sdk.getState()).toBe('idle');

      sdk.configure(validConfig);
      expect(sdk.getState()).toBe('configured');

      sdk.simulateStart();
      expect(sdk.getState()).toBe('running');

      sdk.simulateStop();
      expect(sdk.getState()).toBe('stopped');
    });

    it('should transition to error state on failure', () => {
      sdk.configure(validConfig);
      sdk.simulateStart();
      sdk.simulateError('Connection lost');
      expect(sdk.getState()).toBe('error');
    });

    it('should allow destroy from any state', () => {
      sdk.configure(validConfig);
      sdk.simulateStart();
      sdk.destroy();
      expect(sdk.getState()).toBe('destroyed');
    });

    it('should clear all handlers on destroy', () => {
      const handler = jest.fn();
      sdk.on('agent:select', handler);
      sdk.destroy();
      sdk.emit('agent:select', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should be idempotent on destroy', () => {
      sdk.configure(validConfig);
      sdk.destroy();
      sdk.destroy();
      expect(sdk.getState()).toBe('destroyed');
    });
  });

  describe('getStats', () => {
    it('should return comprehensive stats', () => {
      sdk.configure(validConfig);
      sdk.simulateStart();
      const stats = sdk.getStats();
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('agentCount');
      expect(stats).toHaveProperty('snapshotCount');
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('uptime');
      expect(stats.agentCount).toBe(2);
    });

    it('should track uptime after start', () => {
      sdk.configure(validConfig);
      sdk.simulateStart();
      const stats = sdk.getStats();
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      sdk.configure(validConfig);
      sdk.simulateStart();
      sdk.setAgentStatus('alice', 'working');

      sdk.reset();

      expect(sdk.getState()).toBe('idle');
      expect(sdk.getAgents()).toEqual([]);
      expect(sdk.isConnected()).toBe(false);
    });

    it('should clear all listeners on reset', () => {
      const handler = jest.fn();
      sdk.on('agent:select', handler);
      sdk.reset();
      sdk.emit('agent:select', {});
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
