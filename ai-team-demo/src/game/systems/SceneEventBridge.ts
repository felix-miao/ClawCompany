import { EventBus } from './EventBus';
import { LiveSessionManager, LiveSessionManagerConfig } from './LiveSessionManager';
import {
  AgentStatusEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  EmotionChangeEvent,
  NavigationRequestEvent,
  SessionStartedEvent,
  SessionCompletedEvent,
  GameEventType,
  ROLE_TO_ROOM,
} from '../types/GameEvents';

export interface SceneActions {
  setAgentWorking(agentId: string, working: boolean): void;
  moveAgentToRoom(agentId: string, room: string): void;
  moveAgentToPosition(agentId: string, x: number, y: number): void;
  setAgentEmotion(agentId: string, emotion: string, duration?: number): void;
  getAgentStatus(agentId: string): 'idle' | 'busy' | 'offline';
}

interface BridgeStats {
  eventsProcessed: number;
  lastEventAt: number | null;
  connected: boolean;
}

export class SceneEventBridge {
  private readonly eventBus: EventBus;
  private readonly sessionManager: LiveSessionManager;
  private readonly actions: SceneActions;
  private stats: BridgeStats = {
    eventsProcessed: 0,
    lastEventAt: null,
    connected: false,
  };

  constructor(actions: SceneActions, config?: LiveSessionManagerConfig) {
    this.actions = actions;
    this.eventBus = new EventBus();
    this.sessionManager = new LiveSessionManager(this.eventBus, config);
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.eventBus.on('agent:status-change', (event) => this.handleStatusChange(event));
    this.eventBus.on('agent:task-assigned', (event) => this.handleTaskAssigned(event));
    this.eventBus.on('agent:task-completed', (event) => this.handleTaskCompleted(event));
    this.eventBus.on('agent:navigation-request', (event) => this.handleNavigationRequest(event));
    this.eventBus.on('agent:emotion-change', (event) => this.handleEmotionChange(event));
    this.eventBus.on('session:started', (event) => this.handleSessionStarted(event));
    this.eventBus.on('session:completed', (event) => this.handleSessionCompleted(event));
    this.eventBus.on('connection:open', () => {
      this.stats.connected = true;
    });
    this.eventBus.on('connection:close', () => {
      this.stats.connected = false;
    });
  }

  connect(url?: string): void {
    this.sessionManager.connect(url);
  }

  disconnect(): void {
    this.sessionManager.disconnect();
  }

  isConnected(): boolean {
    return this.sessionManager.isConnected();
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getStats(): BridgeStats {
    return { ...this.stats };
  }

  private updateStats(): void {
    this.stats.eventsProcessed++;
    this.stats.lastEventAt = Date.now();
  }

  private handleStatusChange(event: AgentStatusEvent): void {
    this.updateStats();
    const isWorking = event.status === 'busy' || event.status === 'working';
    this.actions.setAgentWorking(event.agentId, isWorking);
  }

  private handleTaskAssigned(event: TaskAssignedEvent): void {
    this.updateStats();
    if (event.targetRoom) {
      const room = ROLE_TO_ROOM[event.targetRoom] ?? event.targetRoom;
      this.actions.moveAgentToRoom(event.agentId, room);
    }

    this.actions.setAgentWorking(event.agentId, true);

    if (event.description) {
      this.actions.setAgentEmotion(event.agentId, 'focused');
    }
  }

  private handleTaskCompleted(event: TaskCompletedEvent): void {
    this.updateStats();
    this.actions.setAgentWorking(event.agentId, false);

    const emotion = event.result === 'success' ? 'celebrating' : 'stressed';
    this.actions.setAgentEmotion(event.agentId, emotion);
  }

  private handleNavigationRequest(event: NavigationRequestEvent): void {
    this.updateStats();
    if (event.targetRoom) {
      const room = ROLE_TO_ROOM[event.targetRoom] ?? event.targetRoom;
      this.actions.moveAgentToRoom(event.agentId, room);
    } else {
      this.actions.moveAgentToPosition(event.agentId, event.targetX, event.targetY);
    }
  }

  private handleEmotionChange(event: EmotionChangeEvent): void {
    this.updateStats();
    this.actions.setAgentEmotion(event.agentId, event.emotion, event.duration);
  }

  private handleSessionStarted(event: SessionStartedEvent): void {
    this.updateStats();
    this.actions.setAgentWorking(event.role, true);
    this.actions.setAgentEmotion(event.role, 'thinking');

    const room = ROLE_TO_ROOM[event.role];
    if (room) {
      this.actions.moveAgentToRoom(event.role, room);
    }
  }

  private handleSessionCompleted(event: SessionCompletedEvent): void {
    this.updateStats();
    this.actions.setAgentWorking(event.role, false);

    const emotion = event.status === 'completed' ? 'celebrating' : 'stressed';
    this.actions.setAgentEmotion(event.role, emotion);
  }
}
