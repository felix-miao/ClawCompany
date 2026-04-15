'use client';

import type { OpenClawSessionDetails } from '@/lib/gateway/openclaw-snapshot';
import type { HistoryMessage } from '@/lib/gateway/client';

interface SessionInspectorProps {
  session: OpenClawSessionDetails | null;
  onClose: () => void;
}

const ROLE_ICONS: Record<string, string> = {
  user: '👤',
  assistant: '🤖',
  toolResult: '🔧',
};

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-gray-500/10 border-gray-500/30 text-gray-300',
  assistant: 'bg-primary-500/10 border-primary-500/30 text-primary-200',
  toolResult: 'bg-green-500/10 border-green-500/30 text-green-300',
};

function formatTime(timestamp?: string): string {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function truncateContent(content: string, maxLength: number = 150): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength - 1) + '…';
}

function HistoryMessageItem({ message, isLast }: { message: HistoryMessage; isLast: boolean }) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${ROLE_COLORS[message.role]} ${
        isLast && message.role === 'assistant' ? 'ring-1 ring-primary-500/30' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wide flex items-center gap-1.5">
          <span>{ROLE_ICONS[message.role]}</span>
          <span>{message.role}</span>
        </span>
        <span className="text-[10px] text-gray-500">{formatTime(message.timestamp)}</span>
      </div>
      <div className="text-xs text-gray-300 whitespace-pre-wrap break-words line-clamp-4">
        {truncateContent(message.content, 200)}
      </div>
      {message.status && message.status !== 'completed' && (
        <div className="mt-1.5 text-[10px] text-gray-400">
          Status: {message.status}
        </div>
      )}
    </div>
  );
}

export function SessionInspector({ session, onClose }: SessionInspectorProps) {
  if (!session) return null;

  const recentHistory = session.history.slice(-6);

  return (
    <div className="glass rounded-xl border border-dark-100 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-dark-100 bg-dark-50/30">
        <div>
          <div className="text-xs text-gray-500">Session Inspector</div>
          <div className="text-sm font-medium text-white">{session.agentName}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-white text-lg leading-none p-1 rounded hover:bg-dark-50 transition-colors"
        >
          ×
        </button>
      </div>

      <div className="px-3 py-2 border-b border-dark-100/50 bg-dark-50/20">
        <div className="text-xs text-gray-500 mb-1">Label</div>
        <div className="text-sm text-gray-200 truncate">{session.label || '—'}</div>
      </div>

      {session.latestMessage && (
        <div className="px-3 py-2 border-b border-dark-100/50 bg-dark-50/20">
          <div className="text-xs text-gray-500 mb-1">Last Assistant Output</div>
          <div className="text-sm text-primary-200 whitespace-pre-wrap break-words line-clamp-3">
            {truncateContent(session.latestMessage, 250)}
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        <div className="text-xs text-gray-500 mb-2">Recent History ({recentHistory.length} messages)</div>
      </div>

      <div className="px-3 pb-3 space-y-2 max-h-64 overflow-y-auto">
        {recentHistory.map((message, idx) => (
          <HistoryMessageItem
            key={`${message.timestamp}-${idx}`}
            message={message}
            isLast={idx === recentHistory.length - 1 && message.role === 'assistant'}
          />
        ))}
        {recentHistory.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-3">No history available</div>
        )}
      </div>
    </div>
  );
}