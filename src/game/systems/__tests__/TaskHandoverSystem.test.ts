import { EventBus } from '../EventBus';
import { TaskHandoverSystem, HandoverableAgent } from '../TaskHandoverSystem';

import type { AgentConfig } from '@/types/agent-config';

function createMockAgent(id: string, x: number, y: number, role: string = 'worker'): HandoverableAgent & {
  config: AgentConfig;
  moveToCalls: Array<{ targetX: number; targetY: number }>;
} {
  let _x = x;
  let _y = y;
  let _isWorking = false;

  const agent: HandoverableAgent & {
    config: AgentConfig;
    moveToCalls: Array<{ targetX: number; targetY: number }>;
  } = {
    config: { id, name: id, role },
    agentId: id,
    get x() { return _x; },
    set x(v: number) { _x = v; },
    get y() { return _y; },
    set y(v: number) { _y = v; },
    moveToCalls: [],
    moveTo(targetX: number, targetY: number, onArrival?: () => void) {
      agent.moveToCalls.push({ targetX, targetY });
      _x = targetX;
      _y = targetY;
      if (onArrival) onArrival();
    },
    setWorking(working: boolean) { _isWorking = working; },
    isWorkingState() { return _isWorking; },
    setArrivalCallback(_callback: () => void) {},
  };

  return agent;
}

function createSystemWithAgents(
  agents: Array<{ id: string; x: number; y: number; role?: string }>
): { system: TaskHandoverSystem; eventBus: EventBus; agentMap: Map<string, HandoverableAgent>; agents: ReturnType<typeof createMockAgent>[] } {
  const eventBus = new EventBus();
  const agentMap = new Map<string, HandoverableAgent>();
  const mockAgents = agents.map(a => createMockAgent(a.id, a.x, a.y, a.role));
  mockAgents.forEach(a => agentMap.set(a.agentId, a));
  const system = new TaskHandoverSystem(agentMap, eventBus);
  return { system, eventBus, agentMap, agents: mockAgents };
}

describe('TaskHandoverSystem', () => {
  describe('getHandoverPosition', () => {
    it('should return position to the left of target agent', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'alice', x: 300, y: 200 },
        { id: 'bob', x: 500, y: 200 },
      ]);

      const pos = system.getHandoverPosition(agents[1]);
      expect(pos.x).toBe(500 - 50);
      expect(pos.y).toBe(200);
    });

    it('should work for any target position', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'a', x: 100, y: 400 },
      ]);

      const pos = system.getHandoverPosition(agents[0]);
      expect(pos.x).toBe(100 - 50);
      expect(pos.y).toBe(400);
    });
  });

  describe('handoverTask - 2 agents', () => {
    it('should move fromAgent to toAgent position', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'alice', x: 100, y: 200, role: 'dev' },
        { id: 'bob', x: 300, y: 200, role: 'reviewer' },
      ]);

      system.handoverTask('alice', 'bob', 'task_1');

      expect(agents[0].moveToCalls).toHaveLength(1);
      expect(agents[0].moveToCalls[0].targetX).toBe(300 - 50);
      expect(agents[0].moveToCalls[0].targetY).toBe(200);
    });

    it('should set toAgent to working after arrival', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'alice', x: 100, y: 200, role: 'dev' },
        { id: 'bob', x: 300, y: 200, role: 'reviewer' },
      ]);

      system.handoverTask('alice', 'bob', 'task_1');

      expect(agents[1].isWorkingState()).toBe(true);
    });

    it('should emit task:handover event', () => {
      const { system, eventBus } = createSystemWithAgents([
        { id: 'alice', x: 100, y: 200 },
        { id: 'bob', x: 300, y: 200 },
      ]);

      const handler = jest.fn();
      eventBus.on('task:handover', handler);

      system.handoverTask('alice', 'bob', 'task_1');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task:handover',
          fromAgentId: 'alice',
          toAgentId: 'bob',
          taskId: 'task_1',
        })
      );
    });

    it('should do nothing if fromAgent does not exist', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'bob', x: 300, y: 200 },
      ]);

      system.handoverTask('unknown', 'bob', 'task_1');

      expect(agents[0].moveToCalls).toHaveLength(0);
      expect(agents[0].isWorkingState()).toBe(false);
    });

    it('should do nothing if toAgent does not exist', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'alice', x: 100, y: 200 },
      ]);

      system.handoverTask('alice', 'unknown', 'task_1');

      expect(agents[0].moveToCalls).toHaveLength(0);
    });
  });

  describe('handoverTask - 4 agents', () => {
    it('should support handover between any two of 4 agents', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'pm', x: 100, y: 200, role: 'pm' },
        { id: 'dev', x: 250, y: 200, role: 'dev' },
        { id: 'tester', x: 400, y: 200, role: 'tester' },
        { id: 'review', x: 550, y: 200, role: 'review' },
      ]);

      system.handoverTask('pm', 'dev', 'task_1');
      expect(agents[1].isWorkingState()).toBe(true);

      system.handoverTask('dev', 'tester', 'task_2');
      expect(agents[2].isWorkingState()).toBe(true);

      system.handoverTask('tester', 'review', 'task_3');
      expect(agents[3].isWorkingState()).toBe(true);
    });

    it('should support reverse direction handover', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'pm', x: 100, y: 200, role: 'pm' },
        { id: 'dev', x: 300, y: 200, role: 'dev' },
        { id: 'review', x: 500, y: 200, role: 'review' },
        { id: 'tester', x: 700, y: 200, role: 'tester' },
      ]);

      system.handoverTask('tester', 'pm', 'task_1');
      expect(agents[0].isWorkingState()).toBe(true);
      expect(agents[3].moveToCalls).toHaveLength(1);
    });

    it('should track active handovers', () => {
      const { system } = createSystemWithAgents([
        { id: 'a', x: 100, y: 200 },
        { id: 'b', x: 300, y: 200 },
        { id: 'c', x: 500, y: 200 },
        { id: 'd', x: 700, y: 200 },
      ]);

      expect(system.getActiveHandoverCount()).toBe(0);

      system.handoverTask('a', 'b', 'task_1');

      expect(system.getActiveHandoverCount()).toBe(0);
    });
  });

  describe('handoverTask - 10 agents chain', () => {
    it('should support chain handover across 10 agents', () => {
      const agentDefs = Array.from({ length: 10 }, (_, i) => ({
        id: `agent_${i}`,
        x: 100 + i * 80,
        y: 200,
        role: 'worker',
      }));

      const { system, agents } = createSystemWithAgents(agentDefs);

      for (let i = 0; i < 9; i++) {
        system.handoverTask(`agent_${i}`, `agent_${i + 1}`, `task_${i}`);
        expect(agents[i + 1].isWorkingState()).toBe(true);
      }

      expect(agents[9].isWorkingState()).toBe(true);
    });

    it('should support non-sequential handover among 10 agents', () => {
      const agentDefs = Array.from({ length: 10 }, (_, i) => ({
        id: `agent_${i}`,
        x: 100 + i * 80,
        y: 200,
        role: 'worker',
      }));

      const { system, agents } = createSystemWithAgents(agentDefs);

      system.handoverTask('agent_0', 'agent_9', 'task_jump');
      expect(agents[9].isWorkingState()).toBe(true);
      expect(agents[0].moveToCalls[0].targetX).toBeCloseTo(agents[9].x - 50, 1);
    });

    it('should support multiple concurrent handovers among 10 agents', () => {
      const agentDefs = Array.from({ length: 10 }, (_, i) => ({
        id: `agent_${i}`,
        x: 100 + i * 80,
        y: 200,
        role: 'worker',
      }));

      const { system, agents } = createSystemWithAgents(agentDefs);

      system.handoverTask('agent_0', 'agent_5', 'task_a');
      system.handoverTask('agent_1', 'agent_6', 'task_b');
      system.handoverTask('agent_2', 'agent_7', 'task_c');

      expect(agents[5].isWorkingState()).toBe(true);
      expect(agents[6].isWorkingState()).toBe(true);
      expect(agents[7].isWorkingState()).toBe(true);
    });
  });

  describe('handover between different roles', () => {
    it('should allow PM to hand over to Dev', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'pm', x: 100, y: 200, role: 'pm' },
        { id: 'dev', x: 300, y: 200, role: 'dev' },
      ]);

      system.handoverTask('pm', 'dev', 'task_1');
      expect(agents[1].isWorkingState()).toBe(true);
      expect(agents[0].moveToCalls).toHaveLength(1);
    });

    it('should allow Dev to hand over to Reviewer', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'dev', x: 100, y: 200, role: 'dev' },
        { id: 'reviewer', x: 400, y: 200, role: 'reviewer' },
      ]);

      system.handoverTask('dev', 'reviewer', 'task_1');
      expect(agents[1].isWorkingState()).toBe(true);
    });

    it('should allow Reviewer to hand over to PM', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'reviewer', x: 100, y: 200, role: 'reviewer' },
        { id: 'pm', x: 400, y: 200, role: 'pm' },
      ]);

      system.handoverTask('reviewer', 'pm', 'task_1');
      expect(agents[1].isWorkingState()).toBe(true);
    });

    it('should allow any role to hand over to any other role', () => {
      const roles = ['pm', 'dev', 'reviewer', 'tester', 'designer'];
      const agentDefs = roles.map((role, i) => ({
        id: role,
        x: 100 + i * 120,
        y: 200,
        role,
      }));

      const { system, agents } = createSystemWithAgents(agentDefs);

      for (let i = 0; i < roles.length - 1; i++) {
        system.handoverTask(roles[i], roles[i + 1], `task_${i}`);
        expect(agents[i + 1].isWorkingState()).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle handover to self gracefully', () => {
      const { system, agents } = createSystemWithAgents([
        { id: 'alice', x: 100, y: 200 },
      ]);

      system.handoverTask('alice', 'alice', 'task_1');

      expect(agents[0].moveToCalls).toHaveLength(1);
    });

    it('should handle empty agent map', () => {
      const eventBus = new EventBus();
      const agentMap = new Map<string, HandoverableAgent>();
      const system = new TaskHandoverSystem(agentMap, eventBus);

      expect(() => system.handoverTask('a', 'b', 'task_1')).not.toThrow();
    });

    it('should track handover history', () => {
      const { system } = createSystemWithAgents([
        { id: 'alice', x: 100, y: 200 },
        { id: 'bob', x: 300, y: 200 },
      ]);

      system.handoverTask('alice', 'bob', 'task_1');
      system.handoverTask('bob', 'alice', 'task_2');

      const history = system.getHandoverHistory();
      expect(history).toHaveLength(2);
      expect(history[0].fromAgentId).toBe('alice');
      expect(history[0].toAgentId).toBe('bob');
      expect(history[1].fromAgentId).toBe('bob');
      expect(history[1].toAgentId).toBe('alice');
    });
  });

  describe('configurable agent count stress test', () => {
    it.each([2, 4, 6, 10, 20] as const)('should handle %i agents', (count: number) => {
      const agentDefs = Array.from({ length: count }, (_, i) => ({
        id: `agent_${i}`,
        x: 50 + i * 60,
        y: 200,
        role: `role_${i % 5}`,
      }));

      const { system, agents } = createSystemWithAgents(agentDefs);

      for (let i = 0; i < count - 1; i++) {
        system.handoverTask(`agent_${i}`, `agent_${i + 1}`, `task_${i}`);
      }

      for (let i = 1; i < count; i++) {
        expect(agents[i].isWorkingState()).toBe(true);
      }

      expect(system.getHandoverHistory()).toHaveLength(count - 1);
    });
  });
});
