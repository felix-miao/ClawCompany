'use client';

import { AgentInfo } from '@/game/data/DashboardStore';

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-green-500/20 text-green-400',
  working: 'bg-yellow-500/20 text-yellow-400',
  busy: 'bg-orange-500/20 text-orange-400',
  offline: 'bg-gray-500/20 text-gray-400',
};

const AGENT_COLORS: Record<string, string> = {
  'pm-agent': 'from-blue-500 to-blue-600',
  'dev-agent': 'from-green-500 to-green-600',
  'review-agent': 'from-purple-500 to-purple-600',
  'test-agent': 'from-pink-500 to-pink-600',
};

const ROLE_EMOJI: Record<string, string> = {
  Developer: '💻',
  PM: '📋',
  'Project Manager': '📋',
  Reviewer: '🔍',
  'Code Reviewer': '🔍',
  'QA Engineer': '🧪',
  Tester: '🧪',
};

interface AgentStatusPanelProps {
  agents: AgentInfo[];
  onSelectAgent?: (agentId: string) => void;
}

export function AgentStatusPanel({ agents, onSelectAgent }: AgentStatusPanelProps) {
  const isClickable = onSelectAgent !== undefined;

  return (
    <div className="glass rounded-xl p-3">
      <h2 className="text-sm font-bold gradient-text mb-2">Agent Status</h2>
      <div className="space-y-1.5">
        {agents.map(agent => (
          <div
            key={agent.id}
            data-testid={`agent-card-${agent.id}`}
            onClick={() => onSelectAgent?.(agent.id)}
            className={`bg-dark-50/50 rounded-lg p-2.5 border border-dark-100/20 ${
              isClickable ? 'cursor-pointer hover:border-dark-50 hover:bg-dark-50/70 transition-colors' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg bg-gradient-to-br ${AGENT_COLORS[agent.id] ?? 'from-gray-500 to-gray-600'} flex items-center justify-center text-sm shrink-0`}
                >
                  {ROLE_EMOJI[agent.role] ?? '🤖'}
                </div>
                <div className="min-w-0">
                  <span className="text-white font-medium text-xs block truncate">
                    {agent.name}
                  </span>
                  <span className="text-gray-500 text-xs truncate block">
                    {agent.role}
                  </span>
                </div>
              </div>
              <span
                data-status={agent.status}
                className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[agent.status] ?? ''}`}
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
