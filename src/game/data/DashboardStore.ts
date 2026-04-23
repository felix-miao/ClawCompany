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
  DevIterationStartEvent,
  ReviewRejectedEvent,
  WorkflowIterationCompleteEvent,
} from '../types/GameEvents';
import { createDefaultAgents } from '@/lib/gateway/default-agents';

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
  latestResultSummary: string | null;
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
  agentSnapshots?: Record<string, AgentInfo>;
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
  latestResultSummary?: string;
  finalResultSummary?: {
    toolType: string;
    operation: string;
    paths: string[];
    urls: string[];
    status: string;
    error?: string;
    summaryText: string;
  };
  iterationCount?: number;
  rejectionCount?: number;
  isInRework?: boolean;
  lastReviewFeedback?: string;
  lastApproved?: boolean;
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

const DEFAULT_AGENTS: AgentInfo[] = createDefaultAgents();

const AGENT_ID_ALIAS_MAP: Record<string, string> = {
  'sidekick-claw': 'sidekick-claw',
  'pm-agent': 'sidekick-claw',
  'dev-claw': 'dev-claw',
  'dev-agent': 'dev-claw',
  'reviewer-claw': 'reviewer-claw',
  'review-agent': 'reviewer-claw',
  'tester-claw': 'tester-claw',
  'test-agent': 'tester-claw',
};

function getCanonicalAgentId(agentId: string): string {
  return AGENT_ID_ALIAS_MAP[agentId] ?? agentId;
}

const DEFAULT_PHASE_AGENT_NAMES: Partial<Record<TaskPhase, string>> = {
  submitted: 'User',
  pm_analysis: 'PM',
  planning: 'PM',
  developer: 'Developer',
  tester: 'Tester',
  reviewer: 'Reviewer',
};

type ChangeCallback = () => void;

type IterationLikeEvent = DevIterationStartEvent | ReviewRejectedEvent | WorkflowIterationCompleteEvent;

function getEventPayload<T extends Record<string, unknown>>(event: IterationLikeEvent): T | undefined {
  return ((event as { payload?: T }).payload);
}

function getTaskIdFromIterationEvent(event: IterationLikeEvent): string | undefined {
  const payload = getEventPayload<{ taskId?: string }>(event);
  return payload?.taskId ?? (event as { taskId?: string }).taskId;
}

function getIterationFromEvent(event: DevIterationStartEvent | ReviewRejectedEvent): number | undefined {
  const payload = getEventPayload<{ iteration?: number }>(event);
  return payload?.iteration ?? (event as { iteration?: number }).iteration;
}

function getFeedbackFromEvent(event: ReviewRejectedEvent): string | undefined {
  const payload = getEventPayload<{ feedback?: string }>(event);
  return payload?.feedback ?? (event as { feedback?: string }).feedback;
}

function getHasFeedbackFromEvent(event: DevIterationStartEvent): boolean {
  const payload = getEventPayload<{ hasFeedback?: boolean }>(event);
  return payload?.hasFeedback ?? (event as { hasFeedback?: boolean }).hasFeedback ?? false;
}

function getTotalIterationsFromEvent(event: WorkflowIterationCompleteEvent): number | undefined {
  const payload = getEventPayload<{ totalIterations?: number }>(event);
  return payload?.totalIterations ?? (event as { totalIterations?: number }).totalIterations;
}

function getApprovedFromEvent(event: WorkflowIterationCompleteEvent): boolean {
  const payload = getEventPayload<{ approved?: boolean }>(event);
  return payload?.approved ?? (event as { approved?: boolean }).approved ?? false;
}

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
  private taskAgentSnapshots: Map<string, Map<string, AgentInfo>> = new Map();
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
        {
          const taskId = event.task?.id ?? (event as unknown as { taskId?: string }).taskId;
          if (taskId) this.trackTaskEvent(taskId, event);
        }
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
      case 'dev:iteration-start': {
        this.handleDevIterationStart(event);
        const taskId = getTaskIdFromIterationEvent(event);
        if (taskId) this.trackTaskEvent(taskId, event);
        break;
      }
      case 'review:rejected': {
        this.handleReviewRejected(event);
        const taskId = getTaskIdFromIterationEvent(event);
        if (taskId) this.trackTaskEvent(taskId, event);
        break;
      }
      case 'workflow:iteration-complete': {
        this.handleWorkflowIterationComplete(event);
        const taskId = getTaskIdFromIterationEvent(event);
        if (taskId) this.trackTaskEvent(taskId, event);
        break;
      }
    }

    this.notify();
  }

  getAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  getAgentById(id: string): AgentInfo | undefined {
    return this.agents.get(id) ?? this.agents.get(getCanonicalAgentId(id));
  }

  getEvents(): GameEvent[] {
    return this.ring.toArray();
  }

  getEventsByType(type: GameEventType): GameEvent[] {
    return this.ring.toArray().filter(e => e.type === type);
  }

  getEventsByAgent(agentId: string): GameEvent[] {
    const canonicalId = getCanonicalAgentId(agentId);
    return this.ring.toArray().filter(e => e.agentId === agentId || e.agentId === canonicalId);
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

  getTaskAgentById(taskId: string, agentId: string): AgentInfo | undefined {
    const canonicalAgentId = getCanonicalAgentId(agentId);
    const taskSnapshots = this.taskAgentSnapshots.get(taskId);
    const snapshot = taskSnapshots?.get(canonicalAgentId);
    if (snapshot) {
      return { ...snapshot };
    }

    return { ...this.createFallbackAgentSnapshot(agentId, taskId) };
  }

  getTaskAgents(taskId: string): AgentInfo[] {
    return DEFAULT_AGENTS.map((agent) => this.getTaskAgentById(taskId, agent.id) ?? { ...agent });
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
      const canonicalId = getCanonicalAgentId(agent.id);
      const existing = this.agents.get(canonicalId);
      if (existing) {
        existing.name = agent.name;
        existing.role = agent.role;
        existing.status = agent.status;
      } else {
        newMap.set(canonicalId, { ...agent, id: canonicalId });
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
    this.taskAgentSnapshots.clear();
    this.sessionCount = 0;
    this.completedSessionCount = 0;
    this.latestProgress = null;
    this.connected = false;
    this.notify();
  }

  private handleStatusChange(event: AgentStatusEvent): void {
    const agent = this.agents.get(getCanonicalAgentId(event.agentId));
    if (!agent) return;
    agent.status = event.status;
  }

  private handleTaskAssigned(event: TaskAssignedEvent): void {
    const canonicalAgentId = getCanonicalAgentId(event.agentId);
    const agent = this.agents.get(canonicalAgentId);
    if (agent) {
      agent.status = 'working';
      agent.currentTask = event.description;
    }

    this.activeTasks.set(event.taskId, {
      taskId: event.taskId,
      agentId: canonicalAgentId,
      taskType: event.taskType,
      description: event.description,
      assignedAt: event.timestamp,
    });

    const phase = inferPhaseFromAgent(canonicalAgentId) ?? 'developer';
    const task = this.ensureTaskHistory(event.taskId, event.description, event.timestamp);
    this.startPhase(task, phase, event.timestamp, canonicalAgentId, event.description);
    this.updateTaskAgentSnapshot(event.taskId, canonicalAgentId, {
      status: 'working',
      currentTask: event.description,
    });
  }

  private handleTaskCompleted(event: TaskCompletedEvent): void {
    const canonicalAgentId = getCanonicalAgentId(event.agentId);
    const agent = this.agents.get(canonicalAgentId);
    if (agent) {
      agent.status = 'idle';
      agent.currentTask = null;
    }

    this.activeTasks.delete(event.taskId);

    const description = this.activeTasks.get(event.taskId)?.description ?? this.taskHistoryMap.get(event.taskId)?.description ?? event.taskId;
    const phase = inferPhaseFromAgent(canonicalAgentId);
    const task = this.ensureTaskHistory(event.taskId, description, event.timestamp);
    if (phase) {
      this.startPhase(task, phase, event.timestamp, canonicalAgentId, description);
      this.finishPhase(task, phase, event.timestamp, event.result === 'failure' ? 'failed' : 'completed');
    }
    this.finishTask(task, event.timestamp, event.result);
    this.updateTaskAgentSnapshot(event.taskId, canonicalAgentId, {
      status: 'idle',
      currentTask: null,
      latestResultSummary: event.result === 'success' ? 'Task completed' : `Task ${event.result}`,
    });
  }

  private handleEmotionChange(event: EmotionChangeEvent): void {
    const agent = this.agents.get(getCanonicalAgentId(event.agentId));
    if (agent) {
      agent.emotion = event.emotion;
    }
  }

  private handleVisualizationTaskAssigned(event: TaskVisualizationAssignedEvent): void {
    const rawTask = event.task;
    const fallbackEvent = event as unknown as {
      taskId?: string;
      description?: string;
      taskType?: string;
    };
    const taskId = rawTask?.id ?? fallbackEvent.taskId;
    if (!taskId) return;

    const description = rawTask?.description ?? fallbackEvent.description ?? taskId;
    const taskType = rawTask?.taskType ?? fallbackEvent.taskType ?? 'unknown';
    const task = this.ensureTaskHistory(taskId, description, event.timestamp);
    const phase = inferPhaseFromAgent(event.agentId) ?? 'developer';

    this.activeTasks.set(taskId, {
      taskId,
      agentId: event.agentId,
      taskType,
      description,
      assignedAt: event.timestamp,
    });

    this.startPhase(task, phase, event.timestamp, event.agentId, description);
    this.updateTaskAgentSnapshot(taskId, event.agentId, {
      status: 'working',
      currentTask: description,
    });
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
    this.updateTaskAgentSnapshot(event.taskId, event.toAgentId, {
      status: 'working',
      currentTask: event.description,
    });
  }

  private handleVisualizationTaskProgress(event: TaskVisualizationProgressEvent): void {
    const description = this.activeTasks.get(event.taskId)?.description
      ?? this.taskHistoryMap.get(event.taskId)?.description
      ?? event.taskId;
    const task = this.ensureTaskHistory(event.taskId, description, event.timestamp);
    const phase = inferPhaseFromAgent(event.agentId) ?? task.currentPhase;

    this.startPhase(task, phase, event.timestamp, event.agentId, description);
    task.updatedAt = event.timestamp;
    this.updateTaskAgentSnapshot(event.taskId, event.agentId, {
      status: 'working',
      currentTask: description,
    });
  }

  private handleDevIterationStart(event: DevIterationStartEvent): void {
    const taskId = getTaskIdFromIterationEvent(event);
    if (!taskId) return;

    const iteration = getIterationFromEvent(event) ?? 1;
    const description = this.taskHistoryMap.get(taskId)?.description ?? taskId;
    const task = this.ensureTaskHistory(taskId, description, event.timestamp);

    task.iterationCount = Math.max(task.iterationCount ?? 0, iteration);
    task.isInRework = iteration > 1 || getHasFeedbackFromEvent(event) || (task.rejectionCount ?? 0) > 0;
    task.lastApproved = false;

    this.startPhase(task, 'developer', event.timestamp, event.agentId ?? 'dev-claw', description);
    this.updateTaskAgentSnapshot(taskId, event.agentId ?? 'dev-claw', {
      status: 'working',
      currentTask: description,
    });
  }

  private handleReviewRejected(event: ReviewRejectedEvent): void {
    const taskId = getTaskIdFromIterationEvent(event);
    if (!taskId) return;

    const description = this.taskHistoryMap.get(taskId)?.description ?? taskId;
    const task = this.ensureTaskHistory(taskId, description, event.timestamp);
    const iteration = getIterationFromEvent(event) ?? task.iterationCount ?? 1;
    const feedback = getFeedbackFromEvent(event);

    task.iterationCount = Math.max(task.iterationCount ?? 0, iteration);
    task.rejectionCount = (task.rejectionCount ?? 0) + 1;
    task.isInRework = true;
    task.lastReviewFeedback = feedback;
    task.lastApproved = false;

    this.startPhase(task, 'reviewer', event.timestamp, event.agentId ?? 'reviewer-claw', description);
    this.finishPhase(task, 'reviewer', event.timestamp, 'failed');
    this.updateTaskAgentSnapshot(taskId, event.agentId ?? 'reviewer-claw', {
      status: 'working',
      currentTask: description,
    });
  }

  private handleWorkflowIterationComplete(event: WorkflowIterationCompleteEvent): void {
    const taskId = getTaskIdFromIterationEvent(event);
    if (!taskId) return;

    const totalIterations = getTotalIterationsFromEvent(event) ?? this.taskHistoryMap.get(taskId)?.iterationCount ?? 1;
    const approved = getApprovedFromEvent(event);
    const description = this.taskHistoryMap.get(taskId)?.description ?? taskId;
    const task = this.ensureTaskHistory(taskId, description, event.timestamp);

    task.iterationCount = Math.max(task.iterationCount ?? 0, totalIterations);
    task.lastApproved = approved;
    task.isInRework = totalIterations > 1 ? true : task.isInRework ?? false;
    task.updatedAt = event.timestamp;
    if (task.currentAgentId) {
      this.updateTaskAgentSnapshot(taskId, task.currentAgentId, {
        currentTask: task.description,
      });
    }
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
    this.updateTaskAgentSnapshot(event.taskId, event.agentId, {
      status: 'idle',
      currentTask: null,
      latestResultSummary: event.result === 'success' ? 'Task completed' : `Task ${event.result}`,
    });
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
    this.updateTaskAgentSnapshot(event.taskId, event.agentId, {
      status: 'idle',
      currentTask: null,
      latestResultSummary: event.error,
    });
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
      agentSnapshots: {},
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

  private createFallbackAgentSnapshot(agentId: string, taskId: string): AgentInfo {
    const canonicalAgentId = getCanonicalAgentId(agentId);
    const defaultAgent = DEFAULT_AGENTS.find((agent) => agent.id === canonicalAgentId);
    const base = defaultAgent ?? this.agents.get(canonicalAgentId) ?? {
      id: canonicalAgentId,
      name: agentId,
      role: 'dev',
      status: 'idle',
      emotion: 'neutral',
      currentTask: null,
      latestResultSummary: null,
    };

    return {
      ...base,
      id: canonicalAgentId,
      currentTask: null,
      latestResultSummary: null,
    };
  }

  private updateTaskAgentSnapshot(taskId: string, agentId: string, patch: Partial<AgentInfo>): AgentInfo {
    const canonicalAgentId = getCanonicalAgentId(agentId);
    const taskSnapshots = this.taskAgentSnapshots.get(taskId) ?? new Map<string, AgentInfo>();
    const existing = taskSnapshots.get(canonicalAgentId) ?? this.createFallbackAgentSnapshot(canonicalAgentId, taskId);
    const next: AgentInfo = {
      ...existing,
      ...patch,
      id: canonicalAgentId,
    };

    taskSnapshots.set(canonicalAgentId, next);
    this.taskAgentSnapshots.set(taskId, taskSnapshots);

    const task = this.taskHistoryMap.get(taskId);
    if (task) {
      task.agentSnapshots ??= {};
      task.agentSnapshots[canonicalAgentId] = { ...next };
    }

    return next;
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
