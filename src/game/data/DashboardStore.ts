import {
  GameEvent,
  GameEventType,
  AgentStatusEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  EmotionChangeEvent,
  TaskVisualizationAssignedEvent,
  TaskVisualizationCompletedEvent,
  TaskVisualizationFailedEvent,
  TaskVisualizationHandoverEvent,
  TaskVisualizationProgressEvent,
} from '../types/GameEvents';

class RingBuffer {
  private buffer: (GameEvent | undefined)[];
  private head = 0;
  private count = 0;
  private readonly maxEvents: number;

  constructor(maxEvents: number) {
    this.maxEvents = maxEvents;
    this.buffer = new Array(maxEvents);
  }

  push(event: GameEvent): void {
    this.buffer[this.head] = event;
    this.head = (this.head + 1) % this.maxEvents;
    if (this.count < this.maxEvents) this.count++;
  }

  toArray(): GameEvent[] {
    if (this.count === 0) return [];
    const result: GameEvent[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.maxEvents) % this.maxEvents;
      const item = this.buffer[idx];
      if (item !== undefined) result.push(item);
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer = new Array(this.maxEvents);
  }

  length(): number {
    return this.count;
  }
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'working' | 'offline';
  emotion: string;
  currentTask: string | null;
}

export type TaskPhase =
  | 'submitted'
  | 'pm_analysis'
  | 'planning'
  | 'developer'
  | 'tester'
  | 'reviewer'
  | 'done';

export type TaskPhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type TaskExecutionStatus = 'in_progress' | 'completed' | 'failed';

export const TASK_PHASE_ORDER: readonly TaskPhase[] = [
  'submitted',
  'pm_analysis',
  'planning',
  'developer',
  'tester',
  'reviewer',
  'done',
] as const;

export const TASK_PHASE_LABELS: Record<TaskPhase, string> = {
  submitted: 'Submitted',
  pm_analysis: 'PM Analysis',
  planning: 'Planning',
  developer: 'Developer',
  tester: 'Tester',
  reviewer: 'Reviewer',
  done: 'Done',
};

export interface TaskPhaseRecord {
  phase: TaskPhase;
  label: string;
  agentId: string | null;
  agentName: string | null;
  startTime?: number;
  endTime?: number;
  status: TaskPhaseStatus;
}

export interface ActiveTask {
  taskId: string;
  agentId: string;
  taskType: string;
  description: string;
  assignedAt: number;
}

export interface TaskHistory {
  taskId: string;
  description: string;
  phases: TaskPhaseRecord[];
  currentPhase: TaskPhase;
  currentAgentId: string | null;
  currentAgentName: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  result?: 'success' | 'failure' | 'partial';
  status: TaskExecutionStatus;
  recentEvents: GameEvent[];
  failureSummary?: string;
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

const DEFAULT_PHASE_AGENT_NAMES: Partial<Record<TaskPhase, string>> = {
  submitted: 'User',
  pm_analysis: 'PM',
  planning: 'PM',
  developer: 'Developer',
  tester: 'Tester',
  reviewer: 'Reviewer',
};

type ChangeCallback = () => void;

function normalizeAgentKey(agentId?: string | null): string {
  return agentId?.trim().toLowerCase().replace(/_/g, '-') ?? '';
}

function inferPhaseFromAgent(agentId?: string | null): TaskPhase | null {
  const key = normalizeAgentKey(agentId);
  if (!key) return null;
  if (key.includes('sidekick')) return 'submitted';
  if (key.includes('pm')) return 'pm_analysis';
  if (key.includes('plan')) return 'planning';
  if (key.includes('dev')) return 'developer';
  if (key.includes('test')) return 'tester';
  if (key.includes('review')) return 'reviewer';
  return null;
}

function createPhaseRecords(createdAt: number): TaskPhaseRecord[] {
  return TASK_PHASE_ORDER.map((phase) => ({
    phase,
    label: TASK_PHASE_LABELS[phase],
    agentId: phase === 'submitted' ? 'user' : null,
    agentName: phase === 'submitted' ? 'User' : DEFAULT_PHASE_AGENT_NAMES[phase] ?? null,
    startTime: phase === 'submitted' ? createdAt : undefined,
    endTime: phase === 'submitted' ? createdAt : undefined,
    status: phase === 'submitted' ? 'completed' : 'pending',
  }));
}

export class DashboardStore {
  private agents: Map<string, AgentInfo> = new Map();
  private ring: RingBuffer;
  private activeTasks: Map<string, ActiveTask> = new Map();
  private taskHistoryMap: Map<string, TaskHistory> = new Map();
  private sessionCount = 0;
  private completedSessionCount = 0;
  private latestProgress: SessionProgress | null = null;
  private connected = false;
  private readonly maxEvents: number;
  private subscribers = new Set<ChangeCallback>();
  private version = 0;

  constructor(maxEvents: number = 200) {
    this.maxEvents = maxEvents;
    this.ring = new RingBuffer(maxEvents);
    for (const agent of DEFAULT_AGENTS) {
      this.agents.set(agent.id, { ...agent });
    }
  }

  processEvent(event: GameEvent): void {
    this.ring.push(event);

    switch (event.type) {
      case 'agent:status-change':
        this.handleStatusChange(event);
        break;
      case 'agent:task-assigned':
        this.handleTaskAssigned(event);
        this.trackTaskEvent(event.taskId, event);
        break;
      case 'agent:task-completed':
        this.handleTaskCompleted(event);
        this.trackTaskEvent(event.taskId, event);
        break;
      case 'agent:emotion-change':
        this.handleEmotionChange(event);
        break;
      case 'task:assigned':
        this.handleVisualizationTaskAssigned(event);
        this.trackTaskEvent(event.task.id, event);
        break;
      case 'task:handover':
        this.handleVisualizationTaskHandover(event);
        this.trackTaskEvent(event.taskId, event);
        break;
      case 'task:completed':
        this.handleVisualizationTaskCompleted(event);
        this.trackTaskEvent(event.taskId, event);
        break;
      case 'task:failed':
        this.handleVisualizationTaskFailed(event);
        this.trackTaskEvent(event.taskId, event);
        break;
      case 'task:progress':
        this.handleVisualizationTaskProgress(event);
        this.trackTaskEvent(event.taskId, event);
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
    return this.ring.toArray();
  }

  getEventsByType(type: GameEventType): GameEvent[] {
    return this.ring.toArray().filter(e => e.type === type);
  }

  getEventsByAgent(agentId: string): GameEvent[] {
    return this.ring.toArray().filter(e => e.agentId === agentId);
  }

  getActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values());
  }

  getTaskHistory(): TaskHistory[] {
    return Array.from(this.taskHistoryMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getTaskHistoryById(taskId: string): TaskHistory | undefined {
    return this.taskHistoryMap.get(taskId);
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

  getVersion(): number {
    return this.version;
  }

  getStats(): DashboardStats {
    return {
      totalEvents: this.ring.length(),
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

  loadAgents(agents: AgentInfo[]): void {
    const newMap = new Map<string, AgentInfo>();
    for (const agent of agents) {
      const existing = this.agents.get(agent.id);
      if (existing) {
        existing.name = agent.name;
        existing.role = agent.role;
        existing.status = agent.status;
      } else {
        newMap.set(agent.id, { ...agent });
      }
    }
    for (const [id, agent] of newMap) {
      this.agents.set(id, agent);
    }
    this.notify();
  }

  reset(): void {
    for (const agent of DEFAULT_AGENTS) {
      this.agents.set(agent.id, { ...agent });
    }
    this.ring.clear();
    this.activeTasks.clear();
    this.taskHistoryMap.clear();
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

    const phase = inferPhaseFromAgent(event.agentId) ?? 'developer';
    const task = this.ensureTaskHistory(event.taskId, event.description, event.timestamp);
    this.startPhase(task, phase, event.timestamp, event.agentId, event.description);
  }

  private handleTaskCompleted(event: TaskCompletedEvent): void {
    const agent = this.agents.get(event.agentId);
    if (agent) {
      agent.status = 'idle';
      agent.currentTask = null;
    }

    this.activeTasks.delete(event.taskId);

    const description = this.activeTasks.get(event.taskId)?.description ?? this.taskHistoryMap.get(event.taskId)?.description ?? event.taskId;
    const phase = inferPhaseFromAgent(event.agentId);
    const task = this.ensureTaskHistory(event.taskId, description, event.timestamp);
    if (phase) {
      this.startPhase(task, phase, event.timestamp, event.agentId, description);
      this.finishPhase(task, phase, event.timestamp, event.result === 'failure' ? 'failed' : 'completed');
    }
    this.finishTask(task, event.timestamp, event.result);
  }

  private handleEmotionChange(event: EmotionChangeEvent): void {
    const agent = this.agents.get(event.agentId);
    if (agent) {
      agent.emotion = event.emotion;
    }
  }

  private handleVisualizationTaskAssigned(event: TaskVisualizationAssignedEvent): void {
    const description = event.task.description;
    const task = this.ensureTaskHistory(event.task.id, description, event.timestamp);
    const phase = inferPhaseFromAgent(event.agentId) ?? 'developer';

    this.activeTasks.set(event.task.id, {
      taskId: event.task.id,
      agentId: event.agentId,
      taskType: event.task.taskType,
      description,
      assignedAt: event.timestamp,
    });

    this.startPhase(task, phase, event.timestamp, event.agentId, description);
  }

  private handleVisualizationTaskHandover(event: TaskVisualizationHandoverEvent): void {
    const task = this.ensureTaskHistory(event.taskId, event.description, event.timestamp);
    const fromPhase = inferPhaseFromAgent(event.fromAgentId);
    const toPhase = inferPhaseFromAgent(event.toAgentId) ?? 'developer';

    if (fromPhase) {
      this.finishPhase(task, fromPhase, event.timestamp, 'completed');
    }
    if (toPhase !== 'pm_analysis') {
      this.finishPhase(task, 'planning', event.timestamp, 'completed');
    }

    this.activeTasks.set(event.taskId, {
      taskId: event.taskId,
      agentId: event.toAgentId,
      taskType: toPhase,
      description: event.description,
      assignedAt: event.timestamp,
    });

    this.startPhase(task, toPhase, event.timestamp, event.toAgentId, event.description);
  }

  private handleVisualizationTaskCompleted(event: TaskVisualizationCompletedEvent): void {
    const description = this.activeTasks.get(event.taskId)?.description
      ?? this.taskHistoryMap.get(event.taskId)?.description
      ?? event.taskId;
    const task = this.ensureTaskHistory(event.taskId, description, event.timestamp);
    const phase = inferPhaseFromAgent(event.agentId);

    if (phase) {
      this.startPhase(task, phase, event.timestamp, event.agentId, description);
      this.finishPhase(task, phase, event.timestamp, event.result === 'failure' ? 'failed' : 'completed');
    }

    this.activeTasks.delete(event.taskId);
    this.finishTask(task, event.timestamp, event.result);
  }

  private handleVisualizationTaskFailed(event: TaskVisualizationFailedEvent): void {
    const description = this.activeTasks.get(event.taskId)?.description
      ?? this.taskHistoryMap.get(event.taskId)?.description
      ?? event.error
      ?? event.taskId;
    const task = this.ensureTaskHistory(event.taskId, description, event.timestamp);
    const phase = inferPhaseFromAgent(event.agentId);

    if (phase) {
      this.startPhase(task, phase, event.timestamp, event.agentId, description);
      this.finishPhase(task, phase, event.timestamp, 'failed');
    }

    this.activeTasks.delete(event.taskId);
    this.finishTask(task, event.timestamp, 'failure');
  }

  private ensureTaskHistory(taskId: string, description: string, timestamp: number): TaskHistory {
    const existing = this.taskHistoryMap.get(taskId);
    if (existing) {
      if (description && description !== existing.description) {
        existing.description = description;
      }
      return existing;
    }

    const task: TaskHistory = {
      taskId,
      description,
      phases: createPhaseRecords(timestamp),
      currentPhase: 'submitted',
      currentAgentId: null,
      currentAgentName: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'in_progress',
      recentEvents: [],
    };

    this.taskHistoryMap.set(taskId, task);
    return task;
  }

  private startPhase(
    task: TaskHistory,
    phase: TaskPhase,
    timestamp: number,
    agentId?: string | null,
    description?: string,
  ): void {
    if (description && description !== task.description) {
      task.description = description;
    }

    this.completePriorPhases(task, phase, timestamp);

    const previous = this.getPhaseRecord(task, task.currentPhase);
    if (previous && previous.phase !== phase && previous.status === 'in_progress') {
      previous.status = 'completed';
      previous.endTime ??= timestamp;
    }

    const record = this.getPhaseRecord(task, phase);
    if (!record) return;

    record.agentId = agentId ?? record.agentId;
    record.agentName = this.resolveAgentName(agentId, phase) ?? record.agentName;
    record.startTime ??= timestamp;
    if (record.status === 'pending') {
      record.status = 'in_progress';
    }

    task.currentPhase = phase;
    task.currentAgentId = agentId ?? record.agentId;
    task.currentAgentName = record.agentName;
    task.updatedAt = timestamp;
    task.status = 'in_progress';
  }

  private finishPhase(
    task: TaskHistory,
    phase: TaskPhase,
    timestamp: number,
    status: Extract<TaskPhaseStatus, 'completed' | 'failed'>,
  ): void {
    const record = this.getPhaseRecord(task, phase);
    if (!record) return;

    this.completePriorPhases(task, phase, timestamp);
    record.startTime ??= timestamp;
    record.endTime = timestamp;
    record.status = status;
    record.agentName = record.agentName ?? this.resolveAgentName(record.agentId, phase) ?? null;
    task.updatedAt = timestamp;
  }

  private finishTask(
    task: TaskHistory,
    timestamp: number,
    result: 'success' | 'failure' | 'partial',
  ): void {
    const doneRecord = this.getPhaseRecord(task, 'done');
    if (!doneRecord) return;

    doneRecord.agentId = task.currentAgentId;
    doneRecord.agentName = task.currentAgentName;
    doneRecord.startTime ??= timestamp;
    doneRecord.endTime = timestamp;
    doneRecord.status = result === 'failure' ? 'failed' : 'completed';

    task.currentPhase = 'done';
    task.completedAt = timestamp;
    task.updatedAt = timestamp;
    task.result = result;
    task.status = result === 'failure' ? 'failed' : 'completed';
  }

  private trackTaskEvent(taskId: string, event: GameEvent): void {
    const task = this.taskHistoryMap.get(taskId);
    if (!task) return;

    task.recentEvents.push(event);
    if (task.recentEvents.length > 5) {
      task.recentEvents = task.recentEvents.slice(-5);
    }

    if (event.type === 'task:failed') {
      task.failureSummary = event.error;
    }
  }

  private completePriorPhases(task: TaskHistory, phase: TaskPhase, timestamp: number): void {
    const targetIndex = TASK_PHASE_ORDER.indexOf(phase);
    if (targetIndex === -1) return;

    for (let i = 0; i < targetIndex; i++) {
      const record = task.phases[i];
      if (record.status === 'pending') {
        record.startTime ??= timestamp;
        record.endTime = timestamp;
        record.status = 'completed';
        record.agentName = record.agentName ?? DEFAULT_PHASE_AGENT_NAMES[record.phase] ?? null;
      } else if (record.status === 'in_progress' && !record.endTime) {
        record.endTime = timestamp;
        record.status = 'completed';
      }
    }
  }

  private getPhaseRecord(task: TaskHistory, phase: TaskPhase): TaskPhaseRecord | undefined {
    return task.phases.find(record => record.phase === phase);
  }

  private resolveAgentName(agentId?: string | null, phase?: TaskPhase): string | null {
    if (!agentId) {
      return phase ? DEFAULT_PHASE_AGENT_NAMES[phase] ?? null : null;
    }

    const directMatch = this.agents.get(agentId);
    if (directMatch) return directMatch.name;

    const normalized = normalizeAgentKey(agentId);
    for (const [id, agent] of this.agents) {
      if (normalizeAgentKey(id) === normalized) {
        return agent.name;
      }
    }

    if (phase) {
      return DEFAULT_PHASE_AGENT_NAMES[phase] ?? agentId;
    }

    return agentId;
  }

  private notify(): void {
    this.version += 1;
    this.subscribers.forEach(cb => {
      try {
        cb();
      } catch {
        // continue
      }
    });
  }
}
