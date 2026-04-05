import {
  GameEvent,
  GameEventType,
  GameEventHandler,
  EventTypeMap,
} from '../types/GameEvents';

import { TypedEventBus } from '@/lib/core/typed-event-bus';

export interface EventBusConfig {
  maxHistorySize?: number;
}

export class EventBus extends TypedEventBus<GameEvent> {
  constructor(config?: EventBusConfig) {
    super(config);
  }

  on<K extends GameEventType>(
    eventType: K,
    handler: GameEventHandler<EventTypeMap[K]>
  ): void;
  on(eventType: '*', handler: GameEventHandler<GameEvent>): void;
  on(eventType: GameEventType | '*', handler: GameEventHandler<GameEvent>): void {
    super.on(eventType, handler);
  }

  off<K extends GameEventType>(
    eventType: K,
    handler: GameEventHandler<EventTypeMap[K]>
  ): void;
  off(eventType: '*', handler: GameEventHandler<GameEvent>): void;
  off(eventType: GameEventType | '*', handler: GameEventHandler<GameEvent>): void {
    super.off(eventType, handler);
  }

  once<K extends GameEventType>(
    eventType: K,
    handler: GameEventHandler<EventTypeMap[K]>
  ): void {
    const wrapper: GameEventHandler<GameEvent> = (event) => {
      this.off(eventType, wrapper as GameEventHandler<EventTypeMap[K]>);
      handler(event as EventTypeMap[K]);
    };
    this.on(eventType, wrapper as GameEventHandler<EventTypeMap[K]>);
  }

  emit(eventTypeOrEvent: string | GameEvent, event?: GameEvent): Error[] {
    if (typeof eventTypeOrEvent === 'string') {
      return super.emit(eventTypeOrEvent, event as GameEvent);
    }
    const e = eventTypeOrEvent as GameEvent;
    return super.emit(e.type, e);
  }
}
