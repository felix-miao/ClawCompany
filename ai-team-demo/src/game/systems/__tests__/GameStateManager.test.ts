import { GameStateManager, GameState, AgentState, SnapshotMetadata } from '../GameStateManager';

describe('GameStateManager', () => {
  let manager: GameStateManager;

  beforeEach(() => {
    manager = new GameStateManager();
  });

  const sampleAgentStates: AgentState[] = [
    {
      id: 'alice',
      name: 'Alice',
      role: 'Developer',
      x: 100,
      y: 200,
      status: 'working',
      emotion: 'focused',
      isWorking: true,
      currentTask: 'Building feature X',
    },
    {
      id: 'bob',
      name: 'Bob',
      role: 'Developer',
      x: 300,
      y: 200,
      status: 'idle',
      emotion: null,
      isWorking: false,
      currentTask: null,
    },
  ];

  describe('capture', () => {
    it('should capture a game state with timestamp', () => {
      const state = manager.capture(sampleAgentStates);
      expect(state.timestamp).toBeGreaterThan(0);
      expect(state.version).toBe('1.0.0');
      expect(state.agents).toHaveLength(2);
    });

    it('should capture agent positions and states', () => {
      const state = manager.capture(sampleAgentStates);
      expect(state.agents[0]).toEqual(sampleAgentStates[0]);
      expect(state.agents[1]).toEqual(sampleAgentStates[1]);
    });

    it('should include metadata', () => {
      const state = manager.capture(sampleAgentStates);
      expect(state.metadata).toBeDefined();
      expect(state.metadata.agentCount).toBe(2);
      expect(state.metadata.activeTasks).toBe(1);
    });

    it('should capture with custom metadata', () => {
      const state = manager.capture(sampleAgentStates, { label: 'before-bugfix' });
      expect(state.metadata.label).toBe('before-bugfix');
    });

    it('should handle empty agents array', () => {
      const state = manager.capture([]);
      expect(state.agents).toEqual([]);
      expect(state.metadata.agentCount).toBe(0);
    });
  });

  describe('serialize / deserialize', () => {
    it('should serialize state to JSON string', () => {
      const state = manager.capture(sampleAgentStates);
      const json = manager.serialize(state);
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.agents).toHaveLength(2);
    });

    it('should deserialize JSON string back to state', () => {
      const original = manager.capture(sampleAgentStates);
      const json = manager.serialize(original);
      const restored = manager.deserialize(json);
      expect(restored).not.toBeNull();
      expect(restored!.version).toBe(original.version);
      expect(restored!.agents).toEqual(original.agents);
      expect(restored!.timestamp).toBe(original.timestamp);
    });

    it('should return null for invalid JSON', () => {
      const result = manager.deserialize('not json');
      expect(result).toBeNull();
    });

    it('should return null for valid JSON but invalid state structure', () => {
      const result = manager.deserialize('{"foo":"bar"}');
      expect(result).toBeNull();
    });

    it('should return null for state with missing required fields', () => {
      const result = manager.deserialize('{"version":"1.0.0"}');
      expect(result).toBeNull();
    });

    it('should preserve exact floating point numbers', () => {
      const states: AgentState[] = [{
        id: 'alice', name: 'Alice', role: 'Dev',
        x: 123.456, y: 789.012, status: 'idle',
        emotion: null, isWorking: false, currentTask: null,
      }];
      const state = manager.capture(states);
      const json = manager.serialize(state);
      const restored = manager.deserialize(json);
      expect(restored!.agents[0].x).toBeCloseTo(123.456, 3);
      expect(restored!.agents[0].y).toBeCloseTo(789.012, 3);
    });
  });

  describe('snapshot history', () => {
    it('should store snapshots', () => {
      manager.capture(sampleAgentStates);
      manager.capture(sampleAgentStates);
      expect(manager.getSnapshotCount()).toBe(2);
    });

    it('should return snapshots in chronological order', () => {
      const state1 = manager.capture(sampleAgentStates);
      const state2 = manager.capture(sampleAgentStates);
      const snapshots = manager.getSnapshots();
      expect(snapshots[0].timestamp).toBeLessThanOrEqual(snapshots[1].timestamp);
    });

    it('should limit snapshot history to maxSnapshots', () => {
      const smallManager = new GameStateManager({ maxSnapshots: 3 });
      for (let i = 0; i < 5; i++) {
        smallManager.capture(sampleAgentStates);
      }
      expect(smallManager.getSnapshotCount()).toBe(3);
    });

    it('should get latest snapshot', () => {
      manager.capture(sampleAgentStates);
      const latest = manager.capture(sampleAgentStates);
      const retrieved = manager.getLatestSnapshot();
      expect(retrieved).not.toBeNull();
      expect(retrieved!.timestamp).toBe(latest.timestamp);
    });

    it('should return null for latest when no snapshots', () => {
      expect(manager.getLatestSnapshot()).toBeNull();
    });

    it('should get snapshot by index', () => {
      const first = manager.capture(sampleAgentStates);
      manager.capture(sampleAgentStates);
      const retrieved = manager.getSnapshot(0);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.timestamp).toBe(first.timestamp);
    });

    it('should return null for out-of-range index', () => {
      expect(manager.getSnapshot(99)).toBeNull();
    });

    it('should find snapshot by label', () => {
      manager.capture(sampleAgentStates, { label: 'checkpoint-1' });
      manager.capture(sampleAgentStates);
      const found = manager.findSnapshotByLabel('checkpoint-1');
      expect(found).not.toBeNull();
      expect(found!.metadata.label).toBe('checkpoint-1');
    });

    it('should return null when label not found', () => {
      manager.capture(sampleAgentStates);
      expect(manager.findSnapshotByLabel('nonexistent')).toBeNull();
    });
  });

  describe('clearSnapshots', () => {
    it('should clear all snapshots', () => {
      manager.capture(sampleAgentStates);
      manager.capture(sampleAgentStates);
      manager.clearSnapshots();
      expect(manager.getSnapshotCount()).toBe(0);
    });
  });

  describe('diff', () => {
    it('should detect agent position changes', () => {
      const state1 = manager.capture(sampleAgentStates);
      const modifiedStates = sampleAgentStates.map(s =>
        s.id === 'alice' ? { ...s, x: 500, y: 600 } : s
      );
      const state2 = manager.capture(modifiedStates);
      const diff = manager.diff(state1, state2);
      expect(diff.changedAgents).toHaveLength(1);
      expect(diff.changedAgents[0].id).toBe('alice');
      expect(diff.changedAgents[0].changes).toContain('position');
    });

    it('should detect status changes', () => {
      const state1 = manager.capture(sampleAgentStates);
      const modifiedStates = sampleAgentStates.map(s =>
        s.id === 'bob' ? { ...s, status: 'working' } : s
      );
      const state2 = manager.capture(modifiedStates);
      const diff = manager.diff(state1, state2);
      expect(diff.changedAgents).toHaveLength(1);
      expect(diff.changedAgents[0].changes).toContain('status');
    });

    it('should detect emotion changes', () => {
      const state1 = manager.capture(sampleAgentStates);
      const modifiedStates = sampleAgentStates.map(s =>
        s.id === 'bob' ? { ...s, emotion: 'happy' } : s
      );
      const state2 = manager.capture(modifiedStates);
      const diff = manager.diff(state1, state2);
      expect(diff.changedAgents[0].changes).toContain('emotion');
    });

    it('should detect task changes', () => {
      const state1 = manager.capture(sampleAgentStates);
      const modifiedStates = sampleAgentStates.map(s =>
        s.id === 'bob' ? { ...s, currentTask: 'New task' } : s
      );
      const state2 = manager.capture(modifiedStates);
      const diff = manager.diff(state1, state2);
      expect(diff.changedAgents[0].changes).toContain('task');
    });

    it('should return empty diff for identical states', () => {
      const state1 = manager.capture(sampleAgentStates);
      const state2 = manager.capture(sampleAgentStates);
      const diff = manager.diff(state1, state2);
      expect(diff.changedAgents).toHaveLength(0);
      expect(diff.addedAgents).toHaveLength(0);
      expect(diff.removedAgents).toHaveLength(0);
    });

    it('should detect added agents', () => {
      const state1 = manager.capture(sampleAgentStates.slice(0, 1));
      const state2 = manager.capture(sampleAgentStates);
      const diff = manager.diff(state1, state2);
      expect(diff.addedAgents).toHaveLength(1);
      expect(diff.addedAgents[0]).toBe('bob');
    });

    it('should detect removed agents', () => {
      const state1 = manager.capture(sampleAgentStates);
      const state2 = manager.capture(sampleAgentStates.slice(0, 1));
      const diff = manager.diff(state1, state2);
      expect(diff.removedAgents).toHaveLength(1);
      expect(diff.removedAgents[0]).toBe('bob');
    });

    it('should summarize total changes', () => {
      const state1 = manager.capture(sampleAgentStates);
      const modifiedStates = sampleAgentStates.map(s =>
        s.id === 'alice'
          ? { ...s, x: 999, status: 'idle', emotion: 'happy' }
          : { ...s, status: 'working' }
      );
      const state2 = manager.capture(modifiedStates);
      const diff = manager.diff(state1, state2);
      expect(diff.totalChanges).toBeGreaterThan(0);
    });
  });

  describe('exportToStorage / importFromStorage', () => {
    it('should export to base64 string', () => {
      const state = manager.capture(sampleAgentStates);
      const exported = manager.exportToStorage(state);
      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThan(0);
    });

    it('should round-trip through storage', () => {
      const state = manager.capture(sampleAgentStates, { label: 'test' });
      const exported = manager.exportToStorage(state);
      const imported = manager.importFromStorage(exported);
      expect(imported).not.toBeNull();
      expect(imported!.agents).toEqual(state.agents);
      expect(imported!.metadata.label).toBe('test');
    });

    it('should return null for corrupt storage data', () => {
      const result = manager.importFromStorage('not-valid-base64!!!');
      expect(result).toBeNull();
    });
  });
});
