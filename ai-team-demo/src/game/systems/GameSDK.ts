import { ConfigValidator, GameConfig, ValidationResult, AgentConfigInput } from './ConfigValidator';
import { GameStateManager, GameState, AgentState } from './GameStateManager';
import { Task, TaskCreateInput, TaskType } from '../types/Task';

export type GameSDKState = 'idle' | 'configured' | 'running' | 'stopped' | 'error' | 'destroyed';

export interface SDKAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  emotion: string | null;
  currentTask: string | null;
}

export interface GameSDKConfig {
  containerId: string;
  width: number;
  height: number;
  agents: AgentConfigInput[];
  physics?: Record<string, number>;
  sse?: { url?: string; reconnectInterval?: number; maxReconnectAttempts?: number };
}

export interface SDKStats {
  state: GameSDKState;
  agentCount: number;
  snapshotCount: number;
  connected: boolean;
  uptime: number;
}

type SDKEventType = string;
type SDKEventHandler = (data: unknown) => void;

export class GameSDK {
  private state: GameSDKState = 'idle';
  private config: GameSDKConfig | null = null;
  private agents: Map<string, SDKAgent> = new Map();
  private agentOrder: string[] = [];
  private validators: ConfigValidator;
  private stateManager: GameStateManager;
  private handlers: Map<SDKEventType, Set<SDKEventHandler>> = new Map();
  private startTime: number | null = null;
  private connected: boolean = false;
  private warnings: ValidationResult['warnings'] = [];

  constructor(config?: GameSDKConfig) {
    this.validators = new ConfigValidator();
    this.stateManager = new GameStateManager();
    if (config) {
      this.configure(config);
    }
  }

  configure(config: GameSDKConfig): void {
    if (this.state === 'running') {
      throw new Error('Cannot configure while game is running. Stop or reset first.');
    }

    const result = this.validators.validate(config);
    if (!result.valid) {
      const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      throw new Error(`Invalid configuration: ${messages}`);
    }

    this.warnings = result.warnings;
    this.config = config;

    this.agents.clear();
    this.agentOrder = [];
    for (const agent of config.agents) {
      const sdkAgent: SDKAgent = {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: 'idle',
        emotion: null,
        currentTask: null,
      };
      this.agents.set(agent.id, sdkAgent);
      this.agentOrder.push(agent.id);
    }

    this.state = 'configured';
  }

  validate(config: GameSDKConfig): ValidationResult {
    return this.validators.validate(config);
  }

  getConfig(): GameSDKConfig {
    if (!this.config) {
      throw new Error('GameSDK not configured. Call configure() first.');
    }
    return this.config;
  }

  getWarnings(): ValidationResult['warnings'] {
    return [...this.warnings];
  }

  getState(): GameSDKState {
    return this.state;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAgents(): SDKAgent[] {
    return this.agentOrder
      .map(id => this.agents.get(id))
      .filter((a): a is SDKAgent => a != null)
      .map(a => ({ ...a }));
  }

  getAgent(id: string): SDKAgent | null {
    const agent = this.agents.get(id);
    return agent ? { ...agent } : null;
  }

  setAgentStatus(agentId: string, status: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const previousStatus = agent.status;
    agent.status = status;

    if (status === 'idle') {
      agent.currentTask = null;
    }

    this.emit('agent:status-change', {
      agentId,
      status,
      previousStatus,
      timestamp: Date.now(),
    });
  }

  setAgentEmotion(agentId: string, emotion: string | null): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const previousEmotion = agent.emotion;
    agent.emotion = emotion;

    this.emit('agent:emotion-change', {
      agentId,
      emotion,
      previousEmotion,
      timestamp: Date.now(),
    });
  }

  assignTask(agentId: string, task: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.currentTask = task;
    agent.status = 'working';

    this.emit('agent:task-assigned', {
      agentId,
      task,
      timestamp: Date.now(),
    });
  }

  createTask(agentId: string, input: TaskCreateInput): Task {
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      description: input.description,
      status: 'pending',
      progress: 0,
      currentAction: input.currentAction ?? input.description,
      taskType: input.taskType,
      assignedAt: Date.now(),
      completedAt: null,
      parentTaskId: input.parentTaskId ?? null,
      metadata: input.metadata,
    };

    this.emit('task:created', { agentId, task, timestamp: Date.now() });
    return task;
  }

  updateTaskProgress(agentId: string, progress: number, currentAction?: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.emit('task:progress-update', {
      agentId,
      progress,
      currentAction,
      timestamp: Date.now(),
    });
  }

  completeTask(agentId: string, result: 'success' | 'failure'): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    if (result === 'success') {
      agent.currentTask = null;
      agent.status = 'idle';
    }

    this.emit('task:completed', {
      agentId,
      result,
      timestamp: Date.now(),
    });
  }

  on(event: SDKEventType, handler: SDKEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)?.add(handler);
  }

  off(event: SDKEventType, handler: SDKEventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  once(event: SDKEventType, handler: SDKEventHandler): void {
    const wrapper: SDKEventHandler = (data) => {
      this.off(event, wrapper);
      handler(data);
    };
    this.on(event, wrapper);
  }

  emit(event: SDKEventType, data: unknown): void {
    const specificHandlers = this.handlers.get(event);
    if (specificHandlers) {
      for (const h of specificHandlers) {
        try {
          h(data);
        } catch (error) {
          // Log error but continue execution - improved error handling
          console.error('[GameSDK] Handler error for event', event, error instanceof Error ? error.message : String(error));
        }
      }
    }

    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers && event !== '*') {
      for (const h of wildcardHandlers) {
        try {
          h({ event, data });
        } catch (error) {
          // Log error but continue execution - improved error handling
          console.error('[GameSDK] Wildcard handler error for event', event, error instanceof Error ? error.message : String(error));
        }
      }
    }
  }

  private getAgentOrFail(id: string): SDKAgent {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent not found: ${id}`);
    }
    return agent;
  }

  saveState(extraMeta?: Record<string, unknown>): GameState {
    const agentStates: AgentState[] = this.agentOrder.map(id => {
      const a = this.getAgentOrFail(id);
      return {
        id: a.id,
        name: a.name,
        role: a.role,
        x: 0,
        y: 0,
        status: a.status,
        emotion: a.emotion,
        isWorking: a.status === 'working',
        currentTask: a.currentTask,
      };
    });

    return this.stateManager.capture(agentStates, extraMeta);
  }

  restoreState(state: GameState): void {
    this.agents.clear();
    this.agentOrder = [];

    for (const agentState of state.agents) {
      const sdkAgent: SDKAgent = {
        id: agentState.id,
        name: agentState.name,
        role: agentState.role,
        status: agentState.status,
        emotion: agentState.emotion,
        currentTask: agentState.currentTask,
      };
      this.agents.set(agentState.id, sdkAgent);
      this.agentOrder.push(agentState.id);
    }
  }

  listSnapshots(): GameState[] {
    return this.stateManager.getSnapshots();
  }

  exportState(state: GameState): string {
    return this.stateManager.exportToStorage(state);
  }

  importState(data: string): GameState | null {
    return this.stateManager.importFromStorage(data);
  }

  simulateStart(): void {
    if (this.state !== 'configured' && this.state !== 'stopped') {
      throw new Error(`Cannot start from state: ${this.state}`);
    }
    this.state = 'running';
    this.startTime = Date.now();
    this.connected = true;
    this.emit('game:start', { timestamp: Date.now() });
  }

  simulateStop(): void {
    if (this.state !== 'running') return;
    this.state = 'stopped';
    this.connected = false;
    this.emit('game:stop', { timestamp: Date.now() });
  }

  simulateError(message: string): void {
    this.state = 'error';
    this.connected = false;
    this.emit('game:error', { message, timestamp: Date.now() });
  }

  getStats(): SDKStats {
    return {
      state: this.state,
      agentCount: this.agents.size,
      snapshotCount: this.stateManager.getSnapshotCount(),
      connected: this.connected,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  private clearInternalState(): void {
    this.handlers.clear();
    this.agents.clear();
    this.agentOrder = [];
    this.config = null;
    this.startTime = null;
    this.connected = false;
  }

  reset(): void {
    this.clearInternalState();
    this.warnings = [];
    this.state = 'idle';
    this.stateManager = new GameStateManager();
  }

  destroy(): void {
    if (this.state === 'destroyed') return;
    this.clearInternalState();
    this.state = 'destroyed';
  }
}
