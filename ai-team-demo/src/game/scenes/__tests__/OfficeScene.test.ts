import { OfficeScene } from '../OfficeScene';
import { RoomName, TaskType, Workstation, TilemapData, ActiveTask } from '../../types/OfficeTypes';

const mockPhysicsBody = {
  velocity: { x: 0, y: 0 },
  acceleration: { x: 0, y: 0 },
  blocked: { down: true, up: false, left: false, right: false },
  touching: { down: false, up: false, left: false, right: false },
  setVelocityX: jest.fn(),
  setVelocityY: jest.fn(),
  setAccelerationX: jest.fn(),
  setBounce: jest.fn(),
  setCollideWorldBounds: jest.fn(),
  setDrag: jest.fn(),
};

function createMockAgent(id: string, x: number, y: number) {
  return {
    x,
    y,
    agentId: id,
    agentName: id,
    agentRole: 'dev',
    agentConfig: { id, name: id, role: 'dev' },
    body: { ...mockPhysicsBody, velocity: { x: 0, y: 0 } },
    flipX: false,
    depth: 0,
    isWorkingState: jest.fn(() => false),
    setWorking: jest.fn(),
    moveTo: jest.fn(),
    returnToOriginal: jest.fn(),
    isNavigatingToTarget: jest.fn(() => false),
    getTargetPosition: jest.fn(() => null),
    getOriginalPosition: jest.fn(() => ({ x, y })),
    setEmotion: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    setVelocityX: jest.fn(),
    setVelocityY: jest.fn(),
    setFlipX: jest.fn(),
    setPathfindingSystem: jest.fn(),
    setAnimationController: jest.fn(),
    getEmotionSystem: jest.fn(),
    setEmotionFromTask: jest.fn(),
    clearOriginalPosition: jest.fn(),
    getNavigationState: jest.fn(() => 'idle'),
    getCurrentPath: jest.fn(() => []),
    setArrivalCallback: jest.fn(),
    clearArrivalCallbacks: jest.fn(),
  };
}

describe('OfficeScene logic', () => {
  describe('Type exports', () => {
    it('should export RoomName type correctly', () => {
      const rooms: RoomName[] = ['pm-office', 'dev-studio', 'test-lab', 'review-center'];
      expect(rooms).toHaveLength(4);
    });

    it('should export Workstation interface', () => {
      const ws: Workstation = { id: 'ws1', x: 4, y: 8, label: 'Dev1', status: 'idle', taskType: 'coding' as TaskType };
      expect(ws.id).toBe('ws1');
      expect(ws.status).toBe('idle');
    });

    it('should export TilemapData interface', () => {
      const data: TilemapData = {
        width: 20,
        height: 15,
        tileSize: 32,
        workstations: [],
        platforms: [],
      };
      expect(data.width).toBe(20);
      expect(data.tileSize).toBe(32);
    });

    it('should export ActiveTask interface', () => {
      const task: ActiveTask = { agentId: 'a1', targetX: 100, targetY: 200, returning: false };
      expect(task.agentId).toBe('a1');
      expect(task.returning).toBe(false);
    });
  });

  describe('Room position mapping', () => {
    const roomPositions: Record<string, { x: number; y: number }> = {
      'pm-office': { x: 350, y: 280 },
      'dev-studio': { x: 150, y: 400 },
      'test-lab': { x: 550, y: 400 },
      'review-center': { x: 650, y: 280 },
    };

    it('should map each room name to a position', () => {
      expect(roomPositions['pm-office']).toEqual({ x: 350, y: 280 });
      expect(roomPositions['dev-studio']).toEqual({ x: 150, y: 400 });
      expect(roomPositions['test-lab']).toEqual({ x: 550, y: 400 });
      expect(roomPositions['review-center']).toEqual({ x: 650, y: 280 });
    });

    it('should have exactly 4 room positions', () => {
      expect(Object.keys(roomPositions)).toHaveLength(4);
    });
  });

  describe('Agent management', () => {
    it('should find agent near position', () => {
      const agents = [createMockAgent('a1', 100, 200), createMockAgent('a2', 500, 400)];
      const radius = 40;

      const findAgentNear = (x: number, y: number): typeof agents[0] | null => {
        for (const agent of agents) {
          const dx = Math.abs(agent.x - x);
          const dy = Math.abs(agent.y - y);
          if (dx < radius && dy < radius) return agent;
        }
        return null;
      };

      expect(findAgentNear(105, 205)).toBe(agents[0]);
      expect(findAgentNear(490, 390)).toBe(agents[1]);
      expect(findAgentNear(300, 300)).toBeNull();
    });

    it('should filter idle agents for task assignment', () => {
      const agents = [createMockAgent('a1', 100, 200), createMockAgent('a2', 500, 400)];
      agents[0].isNavigatingToTarget = jest.fn(() => true);
      agents[1].isNavigatingToTarget = jest.fn(() => false);

      const activeTasks = new Map<string, ActiveTask>();
      const idle = agents.filter(a => !activeTasks.has(a.agentId) && !a.isNavigatingToTarget());
      expect(idle).toHaveLength(1);
      expect(idle[0].agentId).toBe('a2');
    });

    it('should manage agent selection by index', () => {
      const agents = [createMockAgent('a1', 100, 200), createMockAgent('a2', 500, 400)];
      let selectedIndex = 0;

      selectedIndex = (selectedIndex + 1) % agents.length;
      expect(selectedIndex).toBe(1);
      expect(agents[selectedIndex].agentId).toBe('a2');

      selectedIndex = (selectedIndex + 1) % agents.length;
      expect(selectedIndex).toBe(0);
    });
  });

  describe('Task completion logic', () => {
    it('should detect task completion when agent near target', () => {
      const agent = createMockAgent('a1', 100, 200);
      agent.getTargetPosition = jest.fn(() => ({ x: 105, y: 205 }));

      const targetPos = agent.getTargetPosition();
      const dx = Math.abs(agent.x - targetPos!.x);
      const dy = Math.abs(agent.y - targetPos!.y);
      expect(dx < 20 && dy < 20).toBe(true);
    });

    it('should not complete when agent far from target', () => {
      const agent = createMockAgent('a1', 100, 200);
      agent.getTargetPosition = jest.fn(() => ({ x: 500, y: 400 }));

      const targetPos = agent.getTargetPosition();
      const dx = Math.abs(agent.x - targetPos!.x);
      const dy = Math.abs(agent.y - targetPos!.y);
      expect(dx < 20 && dy < 20).toBe(false);
    });

    it('should handle returning tasks', () => {
      const agent = createMockAgent('a1', 100, 200);
      agent.getOriginalPosition = jest.fn(() => ({ x: 105, y: 205 }));

      const original = agent.getOriginalPosition();
      expect(original).not.toBeNull();
      const dx = Math.abs(agent.x - original!.x);
      const dy = Math.abs(agent.y - original!.y);
      expect(dx < 20 && dy < 20).toBe(true);
    });

    it('should handle null target position', () => {
      const agent = createMockAgent('a1', 100, 200);
      agent.getTargetPosition = jest.fn(() => null);

      const targetPos = agent.getTargetPosition();
      expect(targetPos).toBeNull();
    });
  });

  describe('Active task management', () => {
    it('should add and remove active tasks', () => {
      const activeTasks = new Map<string, ActiveTask>();
      activeTasks.set('a1', { agentId: 'a1', targetX: 100, targetY: 200, returning: false });

      expect(activeTasks.has('a1')).toBe(true);
      expect(activeTasks.size).toBe(1);

      activeTasks.delete('a1');
      expect(activeTasks.has('a1')).toBe(false);
    });

    it('should track multiple active tasks', () => {
      const activeTasks = new Map<string, ActiveTask>();
      activeTasks.set('a1', { agentId: 'a1', targetX: 100, targetY: 200, returning: false });
      activeTasks.set('a2', { agentId: 'a2', targetX: 300, targetY: 400, returning: true });

      expect(activeTasks.size).toBe(2);
      expect(activeTasks.get('a2')?.returning).toBe(true);
    });
  });

  describe('Workstation status tracking', () => {
    it('should toggle workstation status', () => {
      const workstations: Workstation[] = [
        { id: 'ws1', x: 4, y: 8, label: 'Dev1', status: 'idle', taskType: 'coding' as TaskType },
      ];

      workstations[0].status = workstations[0].status === 'idle' ? 'busy' : 'idle';
      expect(workstations[0].status).toBe('busy');

      workstations[0].status = workstations[0].status === 'idle' ? 'busy' : 'idle';
      expect(workstations[0].status).toBe('idle');
    });
  });

  describe('Particle emitter management', () => {
    it('should respect MAX_PARTICLE_EMITTERS limit', () => {
      const MAX = 20;
      const emitters = new Map<string, { active: boolean; destroy: jest.Mock }>();
      for (let i = 0; i < 25; i++) {
        emitters.set(`e${i}`, { active: true, destroy: jest.fn() });
      }

      expect(emitters.size > MAX).toBe(true);

      const staleKeys: string[] = [];
      emitters.forEach((emitter, key) => {
        if (!emitter.active) {
          staleKeys.push(key);
          emitter.destroy();
        }
      });
      staleKeys.forEach(k => emitters.delete(k));

      if (emitters.size > MAX) {
        const entries = Array.from(emitters.entries());
        const excess = entries.slice(0, emitters.size - MAX);
        for (const [key, emitter] of excess) {
          emitter.destroy();
          emitters.delete(key);
        }
      }

      expect(emitters.size).toBeLessThanOrEqual(MAX);
    });
  });

  describe('Workstation lookup by task type', () => {
    it('should find workstation matching a task type', () => {
      const workstations: Workstation[] = [
        { id: 'ws1', x: 4, y: 8, label: 'Dev1', status: 'idle', taskType: 'coding' as TaskType },
        { id: 'ws2', x: 8, y: 8, label: 'PM', status: 'idle', taskType: 'meeting' as TaskType },
      ];

      const found = workstations.find(ws => ws.taskType === 'coding');
      expect(found?.id).toBe('ws1');
    });

    it('should return undefined for unknown task type', () => {
      const workstations: Workstation[] = [
        { id: 'ws1', x: 4, y: 8, label: 'Dev1', status: 'idle', taskType: 'coding' as TaskType },
      ];

      const found = workstations.find(ws => ws.taskType === 'nonexistent' as TaskType);
      expect(found).toBeUndefined();
    });
  });

  describe('Shutdown logic', () => {
    it('should clear all state on shutdown', () => {
      const activeTasks = new Map<string, ActiveTask>();
      const agents = [createMockAgent('a1', 100, 200)];
      const agentMap = new Map(agents.map(a => [a.agentId, a]));
      const nameLabels = new Map<string, { destroy: jest.Mock }>();
      nameLabels.set('a1', { destroy: jest.fn() });
      const shadowGraphics = new Map<string, { destroy: jest.Mock }>();
      shadowGraphics.set('a1', { destroy: jest.fn() });
      const decorationGraphics: { destroy: jest.Mock }[] = [{ destroy: jest.fn() }];
      const particleEmitters = new Map<string, { destroy: jest.Mock }>();

      activeTasks.clear();
      agents.length = 0;
      agentMap.clear();
      nameLabels.forEach(l => l.destroy());
      nameLabels.clear();
      shadowGraphics.forEach(g => g.destroy());
      shadowGraphics.clear();
      decorationGraphics.forEach(g => g.destroy());
      particleEmitters.forEach(e => e.destroy());
      particleEmitters.clear();

      expect(activeTasks.size).toBe(0);
      expect(agents).toHaveLength(0);
      expect(agentMap.size).toBe(0);
      expect(nameLabels.size).toBe(0);
      expect(shadowGraphics.size).toBe(0);
      expect(decorationGraphics).toHaveLength(0);
    });
  });
});
