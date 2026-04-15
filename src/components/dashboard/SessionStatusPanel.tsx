'use client';

import type { OpenClawSessionDetails, SessionCategory } from '@/lib/gateway/openclaw-snapshot';

const CATEGORY_COLORS: Record<SessionCategory, string> = {
  running: 'bg-blue-500/20 text-blue-400',
  'just-completed': 'bg-green-500/20 text-green-400',
  completed: 'bg-green-500/10 text-green-500',
  stuck: 'bg-red-500/20 text-red-400',
  failed: 'bg-red-500/30 text-red-300',
};

const CATEGORY_ICONS: Record<SessionCategory, string> = {
  running: '⚡',
  'just-completed': '✅',
  completed: '✓',
  stuck: '⏸️',
  failed: '❌',
};

interface SessionStatusPanelProps {
  sessions: OpenClawSessionDetails[];
  selectedSessionKey?: string | null;
  onSelectSession?: (sessionKey: string) => void;
}

export function SessionStatusPanel({ sessions, selectedSessionKey, onSelectSession }: SessionStatusPanelProps) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-xl p-3">
      <h2 className="text-sm font-bold gradient-text mb-2">Session Status</h2>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {sessions.map(session => (
          <div
            key={session.sessionKey}
            role={onSelectSession ? 'button' : undefined}
            tabIndex={onSelectSession ? 0 : undefined}
            onClick={() => onSelectSession?.(session.sessionKey)}
            onKeyDown={(e) => {
              if (onSelectSession && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelectSession(session.sessionKey);
              }
            }}
            className={`bg-dark-50/50 rounded-lg p-2 border border-dark-100/20 cursor-pointer transition-colors ${
              onSelectSession && selectedSessionKey === session.sessionKey
                ? 'ring-1 ring-primary-500/40 bg-primary-500/10'
                : onSelectSession
                  ? 'hover:border-dark-50'
                  : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <span className="text-white text-xs font-medium block truncate">
                  {session.agentName}
                </span>
                <span className="text-gray-500 text-xs truncate block">
                  {session.label}
                </span>
              </div>
              <span
                data-category={session.category}
                className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[session.category]}`}
              >
                {CATEGORY_ICONS[session.category]} {session.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}