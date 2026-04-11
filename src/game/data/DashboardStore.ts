import {
  GameEvent,
  GameEventType,
  AgentStatusEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  EmotionChangeEvent,
  CostUpdateEvent,
  CostBudgetExceededEvent,
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

export interface SessionCostInfo {
  sessionId: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  model: string;
  budget: number;
  remainingBudget: number;
  budgetExceeded: boolean;
  overage: number;
  lastUpdated: number;
}

export interface CostSummary {
  sessions: Map<string, SessionCostInfo>;
  totalTokens: number;
  totalCostUsd: number;
  activeBudget: number;
  activeRemaining: number;
  budgetExceeded: boolean;
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
  { id: 'pm-agent', name: 'PM', role: 'PM', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'dev-agent', name: 'Dev', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'review-agent', name: 'Reviewer', role: 'Reviewer', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'test-agent', name: 'Tester', role: 'Tester', status: 'idle', emotion: 'neutral', currentTask: null },
];

type ChangeCallback = () => void;

export class DashboardStore {
  private agents: Map<string, AgentInfo> = new Map();
  private events: GameEvent[] = [];
  private activeTasks: Map<string, ActiveTask> = new Map();
  private costSessions: Map<string, SessionCostInfo> = new Map();
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
      case 'cost:update':
        this.handleCostUpdate(event);
        break;
      case 'cost:budget-exceeded':
        this.handleBudgetExceeded(event);
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

  getCostSummary(): CostSummary {
    let totalTokens = 0;
    let totalCostUsd = 0;
    let activeBudget = 0;
    let activeRemaining = 0;
    let budgetExceeded = false;

    for (const session of this.costSessions.values()) {
      totalTokens += session.totalTokens;
      totalCostUsd += session.estimatedCostUsd;
      if (session.budget > activeBudget) {
        activeBudget = session.budget;
        activeRemaining = session.remainingBudget;
      }
      if (session.budgetExceeded) budgetExceeded = true;
    }

    return {
      sessions: new Map(this.costSessions),
      totalTokens,
      totalCostUsd,
      activeBudget,
      activeRemaining,
      budgetExceeded,
    };
  }

  loadAgents(agents: AgentInfo[]): void {
    const newMap = new Map<string, AgentInfo>()
    for (const agent of agents) {
      const existing = this.agents.get(agent.id)
      if (existing) {
        existing.name = agent.name
        existing.role = agent.role
        existing.status = agent.status
      } else {
        newMap.set(agent.id, { ...agent })
      }
    }
    for (const [id, agent] of newMap) {
      this.agents.set(id, agent)
    }
    this.notify()
  }

  reset(): void {
    for (const agent of DEFAULT_AGENTS) {
      this.agents.set(agent.id, { ...agent });
    }
    this.events = [];
    this.activeTasks.clear();
    this.costSessions.clear();
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
      assignedAt: event.timestamp ?? Date.now(),
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

  private handleCostUpdate(event: CostUpdateEvent): void {
    const { sessionId, tokens, estimatedCostUsd, model, budget, remainingBudget } = event.payload;
    const existing = this.costSessions.get(sessionId);
    this.costSessions.set(sessionId, {
      sessionId,
      totalTokens: tokens.totalTokens,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      estimatedCostUsd,
      model,
      budget,
      remainingBudget,
      budgetExceeded: existing?.budgetExceeded ?? false,
      overage: existing?.overage ?? 0,
      lastUpdated: event.timestamp ?? Date.now(),
    });
  }

  private handleBudgetExceeded(event: CostBudgetExceededEvent): void {
    const { sessionId, tokens, estimatedCostUsd, model, budget, overage } = event.payload;
    this.costSessions.set(sessionId, {
      sessionId,
      totalTokens: tokens.totalTokens,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      estimatedCostUsd,
      model,
      budget,
      remainingBudget: 0,
      budgetExceeded: true,
      overage,
      lastUpdated: event.timestamp ?? Date.now(),
    });
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
