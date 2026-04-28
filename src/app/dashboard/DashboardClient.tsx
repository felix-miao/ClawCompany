"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { AgentStatusPanel } from "@/components/dashboard/AgentStatusPanel";
import { EventLog } from "@/components/dashboard/EventLog";
import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { PerformanceMetricsPanel } from "@/components/dashboard/PerformanceMetricsPanel";
import { TraditionalTaskView } from "@/components/dashboard/TraditionalTaskView";
import { SessionArtifactsPanel } from "@/components/dashboard/SessionArtifactsPanel";
import { SessionStatusPanel } from "@/components/dashboard/SessionStatusPanel";
import { SessionInspector } from "@/components/dashboard/SessionInspector";
import { useSnapshotStream } from "@/hooks/useSnapshotStream";
import type { AgentInfo, TaskHistory } from "@/game/data/DashboardStore";
import type { AgentStatus, GameEvent } from "@/game/types/GameEvents";
import { MetricsAggregator } from "@/lib/core/metrics-aggregator";
import { PerformanceMonitor } from "@/lib/core/performance-monitor";
import { ErrorTracker } from "@/lib/core/error-tracker";
import { Logger } from "@/lib/core/logger";

const DashboardGameBridge = dynamic(
  () => import("@/components/dashboard/DashboardGameBridge").then(mod => mod.DashboardGameBridge),
  {
    ssr: false,
    loading: () => (
      <div className="glass rounded-2xl p-2 border border-dark-100 flex-1 flex items-center justify-center overflow-hidden">
        <div className="text-gray-300 text-sm">Loading office...</div>
      </div>
    ),
  },
);

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

function getLatestTimelineEntry(taskHistory: TaskHistory[]) {
  const events = taskHistory.flatMap(task => task.recentEvents ?? []);
  const latestEvent = events.sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  const latestTask = taskHistory[0] ?? null;

  return { latestEvent, latestTask };
}

function formatTimelinePreview(event: GameEvent | null): string {
  if (!event) return "No timeline activity yet";

  switch (event.type) {
    case "task:progress":
      return event.currentAction;
    case "session:progress":
      return event.message;
    case "agent:status-change":
      return `${event.agentId} -> ${event.status}`;
    case "task:handover":
      return `${event.fromAgentId} -> ${event.toAgentId}`;
    case "task:completed":
      return `${event.agentId} completed ${event.taskId}`;
    case "task:failed":
      return `${event.agentId} failed ${event.taskId}`;
    default:
      return event.type;
  }
}

function getSnapshotGameEvents(agents: AgentInfo[], taskEvents: GameEvent[]): GameEvent[] {
  const agentEvents = agents.map((agent): GameEvent => ({
    type: 'agent:status-change',
    agentId: agent.id,
    status: agent.status as AgentStatus,
    timestamp: 0,
  }));

  return [...agentEvents, ...taskEvents].sort((a, b) => a.timestamp - b.timestamp);
}

export function DashboardClient() {
  const {
    agents,
    sessions,
    tasks: taskHistory,
    metrics: openClawMetrics,
    connected: snapshotConnected,
    refresh: refreshSnapshot,
  } = useSnapshotStream();
  const [activeView, setActiveView] = useState<"game" | "timeline">("game");
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null);
  const [taskSubmittedHandler, setTaskSubmittedHandler] = useState<(taskId: string) => void>(() => () => {});

  const selectedSession = useMemo(
    () => sessions.find(s => s.sessionKey === selectedSessionKey) ?? null,
    [sessions, selectedSessionKey]
  );

  const timelineEvents = useMemo(
    () => taskHistory.flatMap(task => task.recentEvents ?? []).sort((a, b) => a.timestamp - b.timestamp),
    [taskHistory]
  );

  const gameEvents = useMemo(
    () => getSnapshotGameEvents(agents, timelineEvents),
    [agents, timelineEvents],
  );

  const activeAgentsSummary = useMemo(
    () => getActiveAgentsSummary(agents),
    [agents],
  );

  const timelinePreview = useMemo(
    () => getLatestTimelineEntry(taskHistory),
    [taskHistory],
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

  const selectSessionByTaskId = useCallback((taskId: string) => {
    setSelectedSessionKey(taskId);
  }, []);

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

  const handleTaskSubmitted = useCallback(
    (taskId: string) => {
      taskSubmittedHandler(taskId);
      refreshSnapshot();
    },
    [refreshSnapshot, taskSubmittedHandler]
  );

  const handleTaskSubmittedHandlerChange = useCallback((handler: (taskId: string) => void) => {
    setTaskSubmittedHandler(() => handler);
  }, []);

  return (
    <div className="min-h-screen bg-dark flex flex-col">
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
          <div className="flex items-center gap-2 rounded-full border border-dark-100 bg-dark-50/40 p-1">
            <button
              type="button"
              onClick={() => setActiveView("game")}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                activeView === "game" ? "bg-primary-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Game View
            </button>
            <button
              type="button"
              onClick={() => setActiveView("timeline")}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                activeView === "timeline" ? "bg-primary-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Timeline View
            </button>
          </div>
          <div className="text-sm text-gray-500">
            {stats.totalEvents} events | {stats.activeTasks} active tasks
          </div>
          {(() => {
            const activeSummary = activeAgentsSummary;
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

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-3 min-w-0 overflow-hidden">
          <section className="glass rounded-2xl border border-dark-100 p-4 shrink-0">
            <div className="flex flex-wrap items-stretch gap-3">
              <div className="min-w-[180px] flex-1 rounded-xl border border-dark-100 bg-dark-50/30 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Current Agents</div>
                <div className="mt-2 text-2xl font-semibold text-white">{agents.length}</div>
                <div className="mt-1 text-xs text-gray-400">
                  {activeAgentsSummary.count > 0
                    ? `${activeAgentsSummary.count} active agent${activeAgentsSummary.count > 1 ? "s" : ""}`
                    : "No active sessions"}
                </div>
                {activeAgentsSummary.count > 0 && (
                  <div className="mt-2 text-xs font-medium text-primary-300 truncate">
                    {activeAgentsSummary.names.slice(0, 2).join(" · ")}
                  </div>
                )}
              </div>

              <div className="min-w-[220px] flex-[1.4] rounded-xl border border-primary-500/30 bg-primary-500/10 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.18em] text-primary-300">Timeline Entry</div>
                    <div className="mt-2 text-sm font-medium text-white truncate">
                      {timelinePreview.latestTask?.description ?? "No active sessions"}
                    </div>
                    <div className="mt-1 text-xs text-gray-400 truncate">
                      {formatTimelinePreview(timelinePreview.latestEvent)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView("timeline")}
                    className="shrink-0 rounded-full border border-primary-500/40 bg-primary-600/30 px-3 py-1 text-xs font-medium text-primary-100 hover:bg-primary-600/50 transition-colors"
                  >
                    Open Timeline
                  </button>
                </div>
                {sessions.length === 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    Waiting for OpenClaw sessions from the snapshot stream.
                  </div>
                )}
              </div>
            </div>
          </section>

          {activeView === "game" ? (
            <>
              <DashboardGameBridge
                activeView={activeView}
                gameEvents={gameEvents}
                onTriggerTaskHandlerChange={handleTaskSubmittedHandlerChange}
              />

              <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-dark-50 border border-dark-100 rounded font-mono">Click</kbd>
                  {" "}角色 → 查看任务详情
                </span>
              </div>
            </>
          ) : (
            <TraditionalTaskView tasks={taskHistory} onSelectTask={selectSessionByTaskId} />
          )}
        </div>

        <aside className="w-80 border-l border-dark-100 flex flex-col overflow-hidden shrink-0">
          <div className="border-b border-dark-100 p-3 shrink-0">
            <ControlPanel onTaskSubmitted={handleTaskSubmitted} />
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
