import { EventBus } from './EventBus';

export interface HandoverableAgent {
  agentId: string;
  x: number;
  y: number;
  moveTo(targetX: number, targetY: number, onArrival?: () => void): void;
  setWorking(working: boolean): void;
  isWorkingState(): boolean;
  setArrivalCallback(callback: () => void): void;
}

export interface HandoverRecord {
  fromAgentId: string;
  toAgentId: string;
  taskId: string;
  timestamp: number;
}

const HANDOVER_OFFSET_X = -50;

export class TaskHandoverSystem {
  private agentMap: Map<string, HandoverableAgent>;
  private eventBus: EventBus;
  private activeHandovers: Map<string, HandoverRecord> = new Map();
  private handoverHistory: HandoverRecord[] = [];

  constructor(agentMap: Map<string, HandoverableAgent>, eventBus: EventBus) {
    this.agentMap = agentMap;
    this.eventBus = eventBus;
  }

  getHandoverPosition(targetAgent: HandoverableAgent): { x: number; y: number } {
    return {
      x: targetAgent.x + HANDOVER_OFFSET_X,
      y: targetAgent.y,
    };
  }

  handoverTask(fromAgentId: string, toAgentId: string, taskId: string): void {
    const fromAgent = this.agentMap.get(fromAgentId);
    const toAgent = this.agentMap.get(toAgentId);

    if (!fromAgent || !toAgent) return;

    const targetPosition = this.getHandoverPosition(toAgent);

    const record: HandoverRecord = {
      fromAgentId,
      toAgentId,
      taskId,
      timestamp: Date.now(),
    };

    this.activeHandovers.set(fromAgentId, record);

    fromAgent.moveTo(targetPosition.x, targetPosition.y, () => {
      this.activeHandovers.delete(fromAgentId);
      toAgent.setWorking(true);

      this.handoverHistory.push(record);

      this.eventBus.emit({
        type: 'task:handover',
        timestamp: Date.now(),
        fromAgentId,
        toAgentId,
        taskId,
        description: `Handover from ${fromAgentId} to ${toAgentId}`,
      });
    });
  }

  getActiveHandoverCount(): number {
    return this.activeHandovers.size;
  }

  hasActiveHandover(agentId: string): boolean {
    return this.activeHandovers.has(agentId);
  }

  getHandoverHistory(): HandoverRecord[] {
    return this.handoverHistory;
  }

  destroy(): void {
    this.activeHandovers.clear();
    this.handoverHistory = [];
  }
}
