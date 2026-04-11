'use client';

import { useState } from 'react';

import { CostSummary } from '@/game/data/DashboardStore';

interface CostPanelProps {
  cost: CostSummary;
  onBudgetChange?: (newBudget: number) => void;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(4)}`;
}

function getBudgetPercent(budget: number, remaining: number): number {
  if (budget <= 0) return 0;
  const used = budget - remaining;
  return Math.min(100, Math.round((used / budget) * 100));
}

export function CostPanel({ cost, onBudgetChange }: CostPanelProps) {
  const [budgetInput, setBudgetInput] = useState('');
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);

  const budgetPercent = getBudgetPercent(cost.activeBudget, cost.activeRemaining);
  const hasBudget = cost.activeBudget > 0;

  const budgetBarColor = cost.budgetExceeded
    ? 'bg-red-500'
    : budgetPercent >= 90
    ? 'bg-yellow-500'
    : 'bg-green-500';

  const budgetLabelColor = cost.budgetExceeded
    ? 'text-red-400'
    : budgetPercent >= 90
    ? 'text-yellow-400'
    : 'text-green-400';

  const handleBudgetSubmit = () => {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val > 0 && onBudgetChange) {
      onBudgetChange(val);
    }
    setShowBudgetEdit(false);
    setBudgetInput('');
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold gradient-text">⚡ Cost Tracker</h2>
        <button
          onClick={() => setShowBudgetEdit(v => !v)}
          className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded border border-dark-100/40 hover:border-dark-100"
        >
          {showBudgetEdit ? 'Cancel' : 'Set Budget'}
        </button>
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm">
          <span className="text-white font-mono font-semibold">
            {formatTokens(cost.totalTokens)}
          </span>
          <span className="text-gray-400 ml-1 text-xs">tokens</span>
        </div>
        <div className="text-sm">
          <span className="text-primary-400 font-mono font-semibold">
            {formatCost(cost.totalCostUsd)}
          </span>
          <span className="text-gray-400 ml-1 text-xs">est. cost</span>
        </div>
      </div>

      {/* Budget bar */}
      {hasBudget && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">
              Budget: {formatCost(cost.activeBudget)}
            </span>
            <span className={`text-xs font-semibold ${budgetLabelColor}`}>
              {cost.budgetExceeded
                ? `⚠ Exceeded by ${formatCost(Math.max(0, cost.totalCostUsd - cost.activeBudget))}`
                : budgetPercent >= 90
                ? `⚠ ${budgetPercent}% used`
                : `${budgetPercent}% used`}
            </span>
          </div>
          <div className="w-full bg-dark-50 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${budgetBarColor}`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
          {cost.budgetExceeded && (
            <div className="mt-1 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1 border border-red-500/20">
              🛑 Token budget exceeded — agents may be paused
            </div>
          )}
          {!cost.budgetExceeded && budgetPercent >= 90 && (
            <div className="mt-1 text-xs text-yellow-400 bg-yellow-500/10 rounded px-2 py-1 border border-yellow-500/20">
              ⚠ Approaching budget limit
            </div>
          )}
        </div>
      )}

      {/* Budget input */}
      {showBudgetEdit && (
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Budget in USD (e.g. 0.50)"
            value={budgetInput}
            onChange={e => setBudgetInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBudgetSubmit()}
            className="flex-1 bg-dark-50 border border-dark-100 rounded-lg px-3 py-2 text-white text-xs"
          />
          <button
            onClick={handleBudgetSubmit}
            className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Set
          </button>
        </div>
      )}

      {/* Per-session breakdown */}
      {cost.sessions.size > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-gray-500 mb-1">Sessions</div>
          {Array.from(cost.sessions.values())
            .sort((a, b) => b.lastUpdated - a.lastUpdated)
            .slice(0, 5)
            .map(session => {
              const sessBudgetPct = getBudgetPercent(session.budget, session.remainingBudget);
              const sessColor = session.budgetExceeded
                ? 'text-red-400'
                : sessBudgetPct >= 90
                ? 'text-yellow-400'
                : 'text-gray-300';
              return (
                <div
                  key={session.sessionId}
                  className="bg-dark-50/50 rounded-lg px-2.5 py-1.5 border border-dark-100/20 flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-mono ${sessColor} truncate`}>
                      ⚡ {formatTokens(session.totalTokens)} tokens
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {session.model} · {formatCost(session.estimatedCostUsd)}
                      {session.budgetExceeded && <span className="ml-1 text-red-400">OVER BUDGET</span>}
                      {!session.budgetExceeded && sessBudgetPct >= 90 && (
                        <span className="ml-1 text-yellow-400">{sessBudgetPct}%</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 ml-2 font-mono shrink-0">
                    {session.sessionId.slice(0, 8)}…
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {cost.sessions.size === 0 && (
        <div className="text-xs text-gray-500 text-center py-2">
          No cost data yet — waiting for agent activity
        </div>
      )}
    </div>
  );
}
