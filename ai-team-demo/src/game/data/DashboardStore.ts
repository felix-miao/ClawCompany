import {
  GameEvent,
  GameEventType,
  AgentStatusEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  EmotionChangeEvent,
} from '../types/GameEvents';

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'working' | 'offline';
  emotion: string;
  currentTask: string | null;
}

export interface ActiveTask {
  taskId: string;
  agentId: string;
  taskType: string;
  description: string;
  assignedAt: number;
}

export interface SessionProgress {
  sessionKey: string;
  progress: number;
  message: string;
}

export interface DashboardStats {
  totalEvents: number;
  activeTasks: number;
  sessionCount: number;
  completedSessionCount: number;
  connected: boolean;
}

const DEFAULT_AGENTS: AgentInfo[] = [
  { id: 'alice', name: 'Alice', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'bob', name: 'Bob', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'charlie', name: 'Charlie', role: 'PM', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'diana', name: 'Diana', role: 'Reviewer', status: 'idle', emotion: 'neutral', currentTask: null },
];

type ChangeCallback = () => void;

export class DashboardStore {
  private agents: Map<string, AgentInfo> = new Map();
  private events: GameEvent[] = [];
  private activeTasks: Map<string, ActiveTask> = new Map();
  private sessionCount = 0;
  private completedSessionCount = 0;
  private latestProgress: SessionProgress | null = null;
  private connected = false;
  private readonly maxEvents: number;
  private subscribers = new Set<ChangeCallback>();

  constructor(maxEvents: number = 200) {
    this.maxEvents = maxEvents;
    for (const agent of DEFAULT_AGENTS) {
      this.agents.set(agent.id, { ...agent });
    }
  }

  processEvent(event: GameEvent): void {
    this.events.push(event);
    while (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    switch (event.type) {
      case 'agent:status-change':
        this.handleStatusChange(event);
        break;
      case 'agent:task-assigned':
        this.handleTaskAssigned(event);
        break;
      case 'agent:task-completed':
        this.handleTaskCompleted(event);
        break;
      case 'agent:emotion-change':
        this.handleEmotionChange(event);
        break;
      case 'session:started':
        this.sessionCount++;
        break;
      case 'session:completed':
        this.completedSessionCount++;
        break;
      case 'session:progress':
        this.latestProgress = {
          sessionKey: event.sessionKey,
          progress: event.progress,
          message: event.message,
        };
        break;
      case 'connection:open':
        this.connected = true;
        break;
      case 'connection:close':
      case 'connection:error':
        this.connected = false;
        break;
    }

    this.notify();
  }

  getAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  getAgentById(id: string): AgentInfo | undefined {
    return this.agents.get(id);
  }

  getEvents(): GameEvent[] {
    return [...this.events];
  }

  getEventsByType(type: GameEventType): GameEvent[] {
    return this.events.filter(e => e.type === type);
  }

  getEventsByAgent(agentId: string): GameEvent[] {
    return this.events.filter(e => e.agentId === agentId);
  }

  getActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values());
  }

  getSessionCount(): number {
    return this.sessionCount;
  }

  getCompletedSessionCount(): number {
    return this.completedSessionCount;
  }

  getLatestProgress(): SessionProgress | null {
    return this.latestProgress;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStats(): DashboardStats {
    return {
      totalEvents: this.events.length,
      activeTasks: this.activeTasks.size,
      sessionCount: this.sessionCount,
      completedSessionCount: this.completedSessionCount,
      connected: this.connected,
    };
  }

  subscribe(callback: ChangeCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  reset(): void {
    for (const agent of DEFAULT_AGENTS) {
      this.agents.set(agent.id, { ...agent });
    }
    this.events = [];
    this.activeTasks.clear();
    this.sessionCount = 0;
    this.completedSessionCount = 0;
    this.latestProgress = null;
    this.connected = false;
    this.notify();
  }

  private handleStatusChange(event: AgentStatusEvent): void {
    const agent = this.agents.get(event.agentId);
    if (!agent) return;
    agent.status = event.status;
  }

  private handleTaskAssigned(event: TaskAssignedEvent): void {
    const agent = this.agents.get(event.agentId);
    if (agent) {
      agent.status = 'working';
      agent.currentTask = event.description;
    }

    this.activeTasks.set(event.taskId, {
      taskId: event.taskId,
      agentId: event.agentId,
      taskType: event.taskType,
      description: event.description,
      assignedAt: event.timestamp,
    });
  }

  private handleTaskCompleted(event: TaskCompletedEvent): void {
    const agent = this.agents.get(event.agentId);
    if (agent) {
      agent.status = 'idle';
      agent.currentTask = null;
    }

    const task = this.activeTasks.get(event.taskId);
    if (task) {
      this.activeTasks.delete(event.taskId);
    }
  }

  private handleEmotionChange(event: EmotionChangeEvent): void {
    const agent = this.agents.get(event.agentId);
    if (agent) {
      agent.emotion = event.emotion;
    }
  }

  private notify(): void {
    this.subscribers.forEach(cb => {
      try {
        cb();
      } catch {
        // continue
      }
    });
  }
}
