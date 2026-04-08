import { EventBus } from './EventBus';
import { GameEvent, parseGameEvent } from '../types/GameEvents';

export interface LiveSessionManagerConfig {
  url?: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

const DEFAULT_CONFIG: Required<LiveSessionManagerConfig> = {
  url: '/api/game-events',
  reconnectDelay: 3000,
  maxReconnectAttempts: 5,
};

export class LiveSessionManager {
  private eventSource: EventSource | null = null;
  private readonly eventBus: EventBus;
  private readonly config: Required<LiveSessionManagerConfig>;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(eventBus: EventBus, config?: LiveSessionManagerConfig) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  connect(url?: string): void {
    const endpoint = url ?? this.config.url;

    if (this.eventSource) return;

    this.eventSource = new EventSource(endpoint);

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this.eventBus.emit({
        type: 'connection:open',
        timestamp: Date.now(),
        url: endpoint,
      });
    };

    this.eventSource.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    this.eventSource.onerror = () => {
      this.eventBus.emit({
        type: 'connection:error',
        timestamp: Date.now(),
        url: endpoint,
      });

      this.eventSource?.close();
      this.eventSource = null;

      this.attemptReconnect(endpoint);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;

      this.eventBus.emit({
        type: 'connection:close',
        timestamp: Date.now(),
      });
    }
  }

  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  private handleMessage(rawData: string): void {
    const gameEvent = parseGameEvent(rawData);
    if (!gameEvent) return;

    this.eventBus.emit(gameEvent);
  }

  private attemptReconnect(url: string): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;

    this.reconnectAttempts++;

    const delay = this.config.reconnectDelay;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(url);
    }, delay);
  }
}
