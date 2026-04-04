import { GameEvent, GameEventType } from '../types/GameEvents';

type EventCallback = (event: GameEvent) => void;

export class GameEventStore {
  private events: GameEvent[] = [];
  private subscribers = new Set<EventCallback>();
  private readonly maxEvents: number;

  constructor(maxEvents: number = 200) {
    this.maxEvents = maxEvents;
  }

  push(event: GameEvent): void {
    this.events.push(event);
    while (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    this.notify(event);
  }

  subscribe(callback: EventCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getEvents(since?: number): GameEvent[] {
    if (!since) return [...this.events];
    return this.events.filter(e => e.timestamp > since);
  }

  getEventsByType(type: GameEventType): GameEvent[] {
    return this.events.filter(e => e.type === type);
  }

  getEventsByAgent(agentId: string): GameEvent[] {
    return this.events.filter(e => e.agentId === agentId);
  }

  getLatestEvent(): GameEvent | undefined {
    return this.events[this.events.length - 1];
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  clear(): void {
    this.events = [];
  }

  private notify(event: GameEvent): void {
    this.subscribers.forEach(cb => {
      try {
        cb(event);
      } catch {
        // continue
      }
    });
  }
}

let store: GameEventStore | null = null;

export function getGameEventStore(): GameEventStore {
  if (!store) {
    store = new GameEventStore();
  }
  return store;
}

export function resetGameEventStore(): void {
  store = null;
}
