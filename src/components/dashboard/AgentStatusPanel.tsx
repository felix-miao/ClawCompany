'use client';

import { AgentInfo } from '@/game/data/DashboardStore';

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-green-500/20 text-green-400',
  working: 'bg-yellow-500/20 text-yellow-400',
  busy: 'bg-orange-500/20 text-orange-400',
  offline: 'bg-gray-500/20 text-gray-400',
};

const AGENT_COLORS: Record<string, string> = {
  alice: 'from-blue-500 to-blue-600',
  bob: 'from-green-500 to-green-600',
  charlie: 'from-purple-500 to-purple-600',
  diana: 'from-pink-500 to-pink-600',
};

const ROLE_EMOJI: Record<string, string> = {
  Developer: '💻',
  PM: '📋',
  Reviewer: '🔍',
};

interface AgentStatusPanelProps {
  agents: AgentInfo[];
}

export function AgentStatusPanel({ agents }: AgentStatusPanelProps) {
  return (
    <div className="glass rounded-xl p-4">
      <h2 className="text-lg font-bold gradient-text mb-3">Agent Status</h2>
      <div className="space-y-2">
        {agents.map(agent => (
          <div
            key={agent.id}
            className="bg-dark-50/50 rounded-lg p-3 border border-dark-100/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${AGENT_COLORS[agent.id] ?? 'from-gray-500 to-gray-600'} flex items-center justify-center text-sm`}
                >
                  {ROLE_EMOJI[agent.role] ?? '🤖'}
                </div>
                <div>
                  <span className="text-white font-medium text-sm">
                    {agent.name}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    {agent.role}
                  </span>
                </div>
              </div>
              <span
                data-status={agent.status}
                className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[agent.status] ?? ''}`}
              >
                {agent.status}
              </span>
            </div>
            {agent.emotion !== 'neutral' && (
              <div className="mt-1 text-xs text-gray-400">
                Emotion: {agent.emotion}
              </div>
            )}
            {agent.currentTask && (
              <div className="mt-1 text-xs text-primary-400 truncate">
                {agent.currentTask}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
