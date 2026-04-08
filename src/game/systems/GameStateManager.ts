export interface AgentState {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  status: string;
  emotion: string | null;
  isWorking: boolean;
  currentTask: string | null;
}

export interface SnapshotMetadata {
  agentCount: number;
  activeTasks: number;
  label?: string;
  [key: string]: unknown;
}

export interface GameState {
  version: string;
  timestamp: number;
  agents: AgentState[];
  metadata: SnapshotMetadata;
}

export interface AgentDiff {
  id: string;
  changes: string[];
}

export interface StateDiff {
  addedAgents: string[];
  removedAgents: string[];
  changedAgents: AgentDiff[];
  totalChanges: number;
}

export interface GameStateManagerConfig {
  maxSnapshots?: number;
}

const VERSION = '1.0.0';
const DEFAULT_MAX_SNAPSHOTS = 50;

export class GameStateManager {
  private snapshots: GameState[] = [];
  private maxSnapshots: number;

  constructor(config?: GameStateManagerConfig) {
    this.maxSnapshots = config?.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS;
  }

  capture(agents: AgentState[], extraMeta?: Record<string, unknown>): GameState {
    const state: GameState = {
      version: VERSION,
      timestamp: Date.now(),
      agents: agents.map(a => ({ ...a })),
      metadata: {
        agentCount: agents.length,
        activeTasks: agents.filter(a => a.currentTask !== null).length,
        ...extraMeta,
      },
    };

    this.snapshots.push(state);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return state;
  }

  serialize(state: GameState): string {
    return JSON.stringify(state);
  }

  deserialize(json: string): GameState | null {
    try {
      const parsed = JSON.parse(json);
      if (!this.isValidState(parsed)) return null;
      return parsed as GameState;
    } catch {
      return null;
    }
  }

  private isValidState(obj: unknown): obj is GameState {
    if (!obj || typeof obj !== 'object') return false;
    const record = obj as Record<string, unknown>;
    return (
      typeof record.version === 'string' &&
      typeof record.timestamp === 'number' &&
      Array.isArray(record.agents) &&
      record.metadata !== undefined
    );
  }

  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  getSnapshots(): GameState[] {
    return [...this.snapshots];
  }

  getLatestSnapshot(): GameState | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  getSnapshot(index: number): GameState | null {
    return index >= 0 && index < this.snapshots.length ? this.snapshots[index] : null;
  }

  findSnapshotByLabel(label: string): GameState | null {
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].metadata.label === label) {
        return this.snapshots[i];
      }
    }
    return null;
  }

  clearSnapshots(): void {
    this.snapshots = [];
  }

  diff(state1: GameState, state2: GameState): StateDiff {
    const map1 = new Map(state1.agents.map(a => [a.id, a]));
    const map2 = new Map(state2.agents.map(a => [a.id, a]));

    const addedAgents: string[] = [];
    const removedAgents: string[] = [];
    const changedAgents: AgentDiff[] = [];

    for (const [id] of map2) {
      if (!map1.has(id)) addedAgents.push(id);
    }

    for (const [id] of map1) {
      if (!map2.has(id)) removedAgents.push(id);
    }

    for (const [id, agent2] of map2) {
      const agent1 = map1.get(id);
      if (!agent1) continue;

      const changes: string[] = [];

      if (agent1.x !== agent2.x || agent1.y !== agent2.y) {
        changes.push('position');
      }
      if (agent1.status !== agent2.status) {
        changes.push('status');
      }
      if (agent1.emotion !== agent2.emotion) {
        changes.push('emotion');
      }
      if (agent1.isWorking !== agent2.isWorking) {
        changes.push('working');
      }
      if (agent1.currentTask !== agent2.currentTask) {
        changes.push('task');
      }

      if (changes.length > 0) {
        changedAgents.push({ id, changes });
      }
    }

    const totalChanges = addedAgents.length + removedAgents.length + changedAgents.length;

    return { addedAgents, removedAgents, changedAgents, totalChanges };
  }

  exportToStorage(state: GameState): string {
    return btoa(encodeURIComponent(this.serialize(state)));
  }

  importFromStorage(data: string): GameState | null {
    try {
      const json = decodeURIComponent(atob(data));
      return this.deserialize(json);
    } catch {
      return null;
    }
  }
}
