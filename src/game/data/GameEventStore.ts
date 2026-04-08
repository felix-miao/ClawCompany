import { GameEvent, GameEventType } from '../types/GameEvents';

type EventCallback = (event: GameEvent) => void;

export class GameEventStore {
  private buffer: (GameEvent | undefined)[];
  private head = 0;
  private count = 0;
  private readonly maxEvents: number;
  private subscribers = new Set<EventCallback>();

  constructor(maxEvents: number = 200) {
    this.maxEvents = maxEvents;
    this.buffer = new Array(maxEvents);
  }

  push(event: GameEvent): void {
    this.buffer[this.head] = event;
    this.head = (this.head + 1) % this.maxEvents;
    if (this.count < this.maxEvents) {
      this.count++;
    }
    this.notify(event);
  }

  subscribe(callback: EventCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private getEventsArray(): GameEvent[] {
    if (this.count === 0) return [];
    const result: GameEvent[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.maxEvents) % this.maxEvents;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  getEvents(since?: number): GameEvent[] {
    if (!since) return this.getEventsArray();
    return this.getEventsArray().filter(e => e.timestamp > since);
  }

  getEventsByType(type: GameEventType): GameEvent[] {
    return this.getEventsArray().filter(e => e.type === type);
  }

  getEventsByAgent(agentId: string): GameEvent[] {
    return this.getEventsArray().filter(e => e.agentId === agentId);
  }

  getLatestEvent(): GameEvent | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.head - 1 + this.maxEvents) % this.maxEvents;
    return this.buffer[idx];
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer = new Array(this.maxEvents);
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

export function setGameEventStore(s: GameEventStore | null): void {
  store = s;
}

export function resetGameEventStore(): void {
  store = null;
}

export function createGameEventStore(maxEvents?: number): GameEventStore {
  return new GameEventStore(maxEvents);
}
