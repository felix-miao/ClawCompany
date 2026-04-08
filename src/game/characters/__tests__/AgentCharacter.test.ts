import { EmotionSystem } from '../../systems/EmotionSystem';
import { PathPoint } from '../../systems/PathfindingSystem';

import type { AgentConfig } from '@/types/agent-config';

interface AgentState {
  config: AgentConfig;
  isWorking: boolean;
  isNavigating: boolean;
  currentPath: PathPoint[];
  currentPathIndex: number;
  originalPosition: { x: number; y: number } | null;
  targetPosition: { x: number; y: number } | null;
  emotionSystem: EmotionSystem;
}

function createAgentState(config: AgentConfig, x: number, y: number): AgentState {
  return {
    config,
    isWorking: false,
    isNavigating: false,
    currentPath: [],
    currentPathIndex: 0,
    originalPosition: null,
    targetPosition: null,
    emotionSystem: new EmotionSystem(),
  };
}

function moveTo(state: AgentState, path: PathPoint[], targetX: number, targetY: number, startX: number, startY: number): void {
  if (!state.originalPosition) {
    state.originalPosition = { x: startX, y: startY };
  }
  state.currentPath = path;
  state.currentPathIndex = 0;
  state.targetPosition = { x: targetX, y: targetY };
  state.isNavigating = true;
}

describe('Multi-Agent State Management', () => {
  describe('AgentConfig', () => {
    it('should store unique config per agent', () => {
      const a1 = createAgentState({ id: 'dev1', name: 'Alice', role: 'Developer' }, 100, 200);
      const a2 = createAgentState({ id: 'dev2', name: 'Bob', role: 'Developer' }, 200, 300);

      expect(a1.config.id).toBe('dev1');
      expect(a1.config.name).toBe('Alice');
      expect(a2.config.id).toBe('dev2');
      expect(a2.config.name).toBe('Bob');
      expect(a1.config.id).not.toBe(a2.config.id);
    });

    it('should default to general role', () => {
      const agent = createAgentState({ id: 'x', name: 'X', role: 'general' }, 0, 0);
      expect(agent.config.role).toBe('general');
    });
  });

  describe('Navigation State Isolation', () => {
    it('should not share path state between agents', () => {
      const pathA: PathPoint[] = [{ x: 200, y: 200, action: 'move' }];
      const pathB: PathPoint[] = [{ x: 300, y: 300, action: 'move' }, { x: 400, y: 300, action: 'jump' }];

      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 150, 250);

      moveTo(a1, pathA, 200, 200, 100, 200);
      moveTo(a2, pathB, 400, 300, 150, 250);

      expect(a1.currentPath).toHaveLength(1);
      expect(a2.currentPath).toHaveLength(2);
      expect(a1.currentPathIndex).toBe(0);
      expect(a2.currentPathIndex).toBe(0);
      expect(a1.targetPosition).toEqual({ x: 200, y: 200 });
      expect(a2.targetPosition).toEqual({ x: 400, y: 300 });
    });

    it('should independently advance path indices', () => {
      const path: PathPoint[] = [
        { x: 150, y: 200, action: 'move' },
        { x: 200, y: 200, action: 'move' },
        { x: 250, y: 200, action: 'move' },
      ];

      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 100, 200);

      moveTo(a1, path, 250, 200, 100, 200);
      moveTo(a2, path, 250, 200, 100, 200);

      a1.currentPathIndex = 2;
      a2.currentPathIndex = 0;

      expect(a1.currentPathIndex).toBe(2);
      expect(a2.currentPathIndex).toBe(0);
    });

    it('should store original position on first move', () => {
      const agent = createAgentState({ id: 'a', name: 'A', role: 'dev' }, 100, 200);
      moveTo(agent, [{ x: 200, y: 200, action: 'move' }], 200, 200, 100, 200);

      expect(agent.originalPosition).toEqual({ x: 100, y: 200 });
    });
  });

  describe('Working State Isolation', () => {
    it('should track working state independently', () => {
      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 200, 300);

      a1.isWorking = true;
      expect(a1.isWorking).toBe(true);
      expect(a2.isWorking).toBe(false);
    });
  });

  describe('Emotion Independence', () => {
    it('should have independent emotion systems', () => {
      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 200, 300);

      a1.emotionSystem.setEmotion('focused');
      a2.emotionSystem.setEmotion('happy');

      expect(a1.emotionSystem.getActiveEmotion()).toBe('focused');
      expect(a2.emotionSystem.getActiveEmotion()).toBe('happy');
    });

    it('should derive emotions from task descriptions independently', () => {
      const a1 = createAgentState({ id: 'a1', name: 'A', role: 'dev' }, 100, 200);
      const a2 = createAgentState({ id: 'a2', name: 'B', role: 'pm' }, 200, 300);

      const e1 = a1.emotionSystem.getEmotionFromTask('implement the feature');
      const e2 = a2.emotionSystem.getEmotionFromTask('urgent hotfix needed');

      expect(e1).toBe('focused');
      expect(e2).toBe('stressed');
    });
  });

  describe('Multi-Agent Task Queue', () => {
    it('should track multiple active tasks simultaneously', () => {
      const activeTasks = new Map<string, { agentId: string; targetX: number; targetY: number; returning: boolean }>();

      activeTasks.set('a1', { agentId: 'a1', targetX: 200, targetY: 200, returning: false });
      activeTasks.set('a2', { agentId: 'a2', targetX: 400, targetY: 300, returning: false });

      expect(activeTasks.size).toBe(2);
      expect(activeTasks.get('a1')?.targetX).toBe(200);
      expect(activeTasks.get('a2')?.targetX).toBe(400);
    });

    it('should allow completing tasks independently', () => {
      const activeTasks = new Map<string, { agentId: string; targetX: number; targetY: number; returning: boolean }>();

      activeTasks.set('a1', { agentId: 'a1', targetX: 200, targetY: 200, returning: false });
      activeTasks.set('a2', { agentId: 'a2', targetX: 400, targetY: 300, returning: false });

      activeTasks.delete('a1');

      expect(activeTasks.size).toBe(1);
      expect(activeTasks.has('a1')).toBe(false);
      expect(activeTasks.has('a2')).toBe(true);
    });

    it('should filter idle agents for new tasks', () => {
      const agents = [
        { id: 'a1', isNavigating: false },
        { id: 'a2', isNavigating: true },
        { id: 'a3', isNavigating: false },
      ];
      const activeTasks = new Map<string, boolean>();
      activeTasks.set('a3', true);

      const idle = agents.filter(a => !activeTasks.has(a.id) && !a.isNavigating);

      expect(idle).toHaveLength(1);
      expect(idle[0].id).toBe('a1');
    });
  });
});
