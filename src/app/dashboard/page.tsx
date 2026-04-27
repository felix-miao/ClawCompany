"use client";

import { useMemo, useCallback, useState } from "react";
import Link from "next/link";

import { AgentStatusPanel } from "@/components/dashboard/AgentStatusPanel";
import { EventLog } from "@/components/dashboard/EventLog";
import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { PerformanceMetricsPanel } from "@/components/dashboard/PerformanceMetricsPanel";
import { TraditionalTaskView } from "@/components/dashboard/TraditionalTaskView";
import { SessionArtifactsPanel } from "@/components/dashboard/SessionArtifactsPanel";
import { SessionStatusPanel } from "@/components/dashboard/SessionStatusPanel";
import { SessionInspector } from "@/components/dashboard/SessionInspector";
import { useOpenClawSnapshot } from "@/hooks/useOpenClawSnapshot";
import type { AgentInfo } from "@/game/data/DashboardStore";
import { MetricsAggregator } from "@/lib/core/metrics-aggregator";
import { PerformanceMonitor } from "@/lib/core/performance-monitor";
import { ErrorTracker } from "@/lib/core/error-tracker";
import { Logger } from "@/lib/core/logger";

const ROLE_EMOJI: Record<string, string> = {
  'Project Manager': '📋',
  'Developer': '💻',
  'Code Reviewer': '🔍',
  'QA Engineer': '🧪',
};

function getActiveAgentsSummary(agents: AgentInfo[]): { count: number; names: string[] } {
  const active = agents.filter(a => a.status === 'working' || a.status === 'busy');
  return {
    count: active.length,
    names: active.map(a => `${ROLE_EMOJI[a.role] ?? '🤖'} ${a.name}`),
  };
}

export default function DashboardPage() {
  const {
    agents,
    sessions,
    tasks: taskHistory,
    metrics: openClawMetrics,
    connected: snapshotConnected,
    refresh: refreshSnapshot,
  } = useOpenClawSnapshot();
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null);

  const selectedSession = useMemo(
    () => sessions.find(s => s.sessionKey === selectedSessionKey) ?? null,
    [sessions, selectedSessionKey]
  );

  const timelineEvents = useMemo(
    () => taskHistory.flatMap(task => task.recentEvents ?? []).sort((a, b) => a.timestamp - b.timestamp),
    [taskHistory]
  );

  const stats = useMemo(
    () => ({
      totalEvents: timelineEvents.length,
      activeTasks: taskHistory.filter(task => task.status === 'in_progress' || task.status === 'failed').length,
      sessionCount: sessions.length,
      completedSessionCount: sessions.filter(session => session.category === 'completed' || session.category === 'just-completed').length,
      connected: snapshotConnected,
    }),
    [snapshotConnected, sessions, taskHistory, timelineEvents.length]
  );

  const selectSessionByTaskId = useCallback(
    (taskId: string) => {
      setSelectedSessionKey(taskId);
    },
    []
  );

  const selectSessionByAgentId = useCallback(
    (agentId: string) => {
      const agentSession = sessions.find(s => s.agentId === agentId);
      if (agentSession) {
        setSelectedSessionKey(agentSession.sessionKey);
      }
    },
    [sessions]
  );

  const metricsAggregator = useMemo(() => {
    const perfMonitor = new PerformanceMonitor();
    const errorTracker = new ErrorTracker();
    const logger = new Logger();
    return new MetricsAggregator(perfMonitor, errorTracker, logger, undefined, {
      updateIntervalMs: 120000,
    });
  }, []);

  const handleTriggerTask = useCallback(() => {
    refreshSnapshot();
  }, [refreshSnapshot]);

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      {/* Header */}
      <header className="glass border-b border-dark-100 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Back
          </Link>
          <h1 className="text-xl font-bold gradient-text">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  snapshotConnected
                    ? "bg-green-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <span className="text-gray-400">
                {snapshotConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              OpenClaw: {snapshotConnected ? "Live" : "Fallback"}
            </div>
          <div className="text-sm text-gray-500">
             {stats.totalEvents} events | {stats.activeTasks} active tasks
            </div>
          {(() => {
            const activeSummary = getActiveAgentsSummary(agents);
            if (activeSummary.count === 0) return null;
            return (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-primary-300 font-medium">
                  {activeSummary.count} active agent
                  {activeSummary.count > 1 ? 's' : ''}
                </span>
                {activeSummary.names.slice(0, 1).map(name => (
                  <span key={name} className="text-gray-400">
                    ({name})
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: traditional task tracker */}
        <div className="flex-1 flex flex-col p-4 gap-3 min-w-0 overflow-hidden">
          <TraditionalTaskView tasks={taskHistory} onSelectTask={selectSessionByTaskId} />
        </div>

        {/* Right sidebar */}
        <aside className="w-80 border-l border-dark-100 flex flex-col overflow-hidden shrink-0">
          <div className="border-b border-dark-100 p-3 shrink-0">
            <ControlPanel onTriggerTask={handleTriggerTask} />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {selectedSession && (
              <SessionInspector
                session={selectedSession}
                onClose={() => setSelectedSessionKey(null)}
              />
            )}
            <AgentStatusPanel agents={agents} onSelectAgent={selectSessionByAgentId} />
            <SessionStatusPanel
              sessions={sessions}
              selectedSessionKey={selectedSessionKey}
              onSelectSession={setSelectedSessionKey}
            />
            <SessionArtifactsPanel sessions={sessions} />
            <EventLog events={timelineEvents} />
            <PerformanceMetricsPanel
              metricsAggregator={metricsAggregator}
              openClawMetrics={openClawMetrics}
              openClawSource={openClawMetrics?.source ?? null}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
