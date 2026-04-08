'use client';

import { GameEvent } from '@/game/types/GameEvents';

const EVENT_COLORS: Record<string, string> = {
  'agent:status-change': 'text-blue-400',
  'agent:task-assigned': 'text-yellow-400',
  'agent:task-completed': 'text-green-400',
  'agent:navigation-request': 'text-purple-400',
  'agent:emotion-change': 'text-pink-400',
  'session:started': 'text-cyan-400',
  'session:completed': 'text-emerald-400',
  'session:progress': 'text-teal-400',
  'connection:open': 'text-green-400',
  'connection:close': 'text-red-400',
  'connection:error': 'text-red-500',
};

function formatEventDescription(event: GameEvent): string {
  switch (event.type) {
    case 'agent:status-change':
      return `${event.agentId} → ${event.status}`;
    case 'agent:task-assigned':
      return event.description;
    case 'agent:task-completed':
      return `${event.agentId} completed (${event.result})`;
    case 'agent:emotion-change':
      return `${event.agentId} feels ${event.emotion}`;
    case 'session:started':
      return `${event.role}: ${event.task}`;
    case 'session:completed':
      return `${event.role} session ${event.status}`;
    case 'session:progress':
      return `${event.progress}% - ${event.message}`;
    case 'agent:navigation-request':
      return `${event.agentId} → (${event.targetX}, ${event.targetY})`;
    default:
      return '';
  }
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

interface EventLogProps {
  events: GameEvent[];
  maxDisplay?: number;
}

export function EventLog({ events, maxDisplay = 100 }: EventLogProps) {
  const displayed = events.slice(-maxDisplay);

  return (
    <div className="glass rounded-xl p-4">
      <h2 className="text-lg font-bold gradient-text mb-3">Event Log</h2>
      <div className="space-y-1 max-h-64 overflow-y-auto hide-scrollbar">
        {displayed.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No events yet. Waiting for activity...
          </p>
        ) : (
          displayed.map((event, i) => (
            <div
              key={`${event.timestamp}-${i}`}
              data-testid="event-log-item"
              className="flex items-start gap-2 py-1 px-2 rounded hover:bg-dark-50/30 text-xs"
            >
              <span className="text-gray-500 font-mono shrink-0">
                {formatTime(event.timestamp)}
              </span>
              <span className={`font-mono shrink-0 ${EVENT_COLORS[event.type] ?? 'text-gray-400'}`}>
                {event.type}
              </span>
              <span className="text-gray-300 truncate">
                {formatEventDescription(event)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
