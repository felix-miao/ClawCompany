export type GameEventType =
  | 'agent:status-change'
  | 'agent:task-assigned'
  | 'agent:task-completed'
  | 'agent:navigation-request'
  | 'agent:emotion-change'
  | 'session:started'
  | 'session:completed'
  | 'session:progress'
  | 'connection:open'
  | 'connection:close'
  | 'connection:error'
  | 'task:assigned'
  | 'task:progress'
  | 'task:completed'
  | 'task:failed'
  | 'task:handover';

export type AgentStatus = 'idle' | 'busy' | 'working' | 'offline';

export interface BaseGameEvent {
  type: GameEventType;
  timestamp: number;
  agentId?: string;
}

export interface AgentStatusEvent extends BaseGameEvent {
  type: 'agent:status-change';
  agentId: string;
  status: AgentStatus;
  previousStatus?: AgentStatus;
}

export interface TaskAssignedEvent extends BaseGameEvent {
  type: 'agent:task-assigned';
  agentId: string;
  taskId: string;
  taskType: string;
  description: string;
  targetRoom?: string;
}

export interface TaskCompletedEvent extends BaseGameEvent {
  type: 'agent:task-completed';
  agentId: string;
  taskId: string;
  result: 'success' | 'failure' | 'partial';
  duration: number;
}

export interface NavigationRequestEvent extends BaseGameEvent {
  type: 'agent:navigation-request';
  agentId: string;
  targetX: number;
  targetY: number;
  targetRoom?: string;
}

export interface EmotionChangeEvent extends BaseGameEvent {
  type: 'agent:emotion-change';
  agentId: string;
  emotion: string;
  duration?: number;
  source: 'task' | 'status' | 'manual' | 'system';
}

export interface SessionStartedEvent extends BaseGameEvent {
  type: 'session:started';
  sessionKey: string;
  role: string;
  task: string;
}

export interface SessionCompletedEvent extends BaseGameEvent {
  type: 'session:completed';
  sessionKey: string;
  role: string;
  status: 'completed' | 'failed';
  duration: number;
}

export interface SessionProgressEvent extends BaseGameEvent {
  type: 'session:progress';
  sessionKey: string;
  progress: number;
  message: string;
}

export interface ConnectionEvent extends BaseGameEvent {
  type: 'connection:open' | 'connection:close' | 'connection:error';
  url?: string;
  error?: string;
}

export interface TaskVisualizationAssignedEvent extends BaseGameEvent {
  type: 'task:assigned';
  agentId: string;
  task: {
    id: string;
    description: string;
    taskType: string;
    metadata?: Record<string, unknown>;
  };
}

export interface TaskVisualizationProgressEvent extends BaseGameEvent {
  type: 'task:progress';
  agentId: string;
  taskId: string;
  progress: number;
  currentAction: string;
}

export interface TaskVisualizationCompletedEvent extends BaseGameEvent {
  type: 'task:completed';
  agentId: string;
  taskId: string;
  result: 'success' | 'failure' | 'partial';
  duration: number;
}

export interface TaskVisualizationFailedEvent extends BaseGameEvent {
  type: 'task:failed';
  agentId: string;
  taskId: string;
  error: string;
}

export interface TaskVisualizationHandoverEvent extends BaseGameEvent {
  type: 'task:handover';
  fromAgentId: string;
  toAgentId: string;
  taskId: string;
  description: string;
}

export type GameEvent =
  | AgentStatusEvent
  | TaskAssignedEvent
  | TaskCompletedEvent
  | NavigationRequestEvent
  | EmotionChangeEvent
  | SessionStartedEvent
  | SessionCompletedEvent
  | SessionProgressEvent
  | ConnectionEvent
  | TaskVisualizationAssignedEvent
  | TaskVisualizationProgressEvent
  | TaskVisualizationCompletedEvent
  | TaskVisualizationFailedEvent
  | TaskVisualizationHandoverEvent;

export type GameEventHandler<T extends GameEvent = GameEvent> = (event: T) => void;

export interface EventTypeMap {
  'agent:status-change': AgentStatusEvent;
  'agent:task-assigned': TaskAssignedEvent;
  'agent:task-completed': TaskCompletedEvent;
  'agent:navigation-request': NavigationRequestEvent;
  'agent:emotion-change': EmotionChangeEvent;
  'session:started': SessionStartedEvent;
  'session:completed': SessionCompletedEvent;
  'session:progress': SessionProgressEvent;
  'connection:open': ConnectionEvent;
  'connection:close': ConnectionEvent;
  'connection:error': ConnectionEvent;
  'task:assigned': TaskVisualizationAssignedEvent;
  'task:progress': TaskVisualizationProgressEvent;
  'task:completed': TaskVisualizationCompletedEvent;
  'task:failed': TaskVisualizationFailedEvent;
  'task:handover': TaskVisualizationHandoverEvent;
}

export interface SSEMessage {
  event: string;
  data: string;
  id?: string;
}

export function parseSSEMessage(raw: string): SSEMessage | null {
  const lines = raw.split('\n');
  let event = 'message';
  let data = '';
  let id: string | undefined;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data += (data ? '\n' : '') + line.slice(5).trim();
    } else if (line.startsWith('id:')) {
      id = line.slice(3).trim();
    }
  }

  if (!data) return null;
  return { event, data, id };
}

export function parseGameEvent(data: string): GameEvent | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || !parsed.type) return null;
    return {
      ...parsed,
      timestamp: parsed.timestamp ?? Date.now(),
    } as GameEvent;
  } catch {
    return null;
  }
}

export const AGENT_ROLE_MAP: Record<string, string> = {
  pm: 'pm',
  developer: 'dev1',
  tester: 'dev2',
  reviewer: 'reviewer',
};

export const ROLE_TO_ROOM: Record<string, string> = {
  pm: 'pm-office',
  dev1: 'dev-studio',
  dev2: 'test-lab',
  reviewer: 'review-center',
  developer: 'dev-studio',
  tester: 'test-lab',
};
