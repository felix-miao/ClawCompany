"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import Link from "next/link";

import { AgentStatusPanel } from "@/components/dashboard/AgentStatusPanel";
import { EventLog } from "@/components/dashboard/EventLog";
import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { PerformanceMetricsPanel } from "@/components/dashboard/PerformanceMetricsPanel";
import { TraditionalTaskView } from "@/components/dashboard/TraditionalTaskView";
import { useEventStream } from "@/hooks/useEventStream";
import { useDashboardStore } from "@/hooks/useDashboardStore";
import { useOpenClawSessions } from "@/hooks/useOpenClawSessions";
import { useOpenClawMetrics } from "@/hooks/useOpenClawMetrics";
import { Game, startGame } from "@/game";
import { DashboardStore } from "@/game/data/DashboardStore";
import { GameEvent } from "@/game/types/GameEvents";
import { MetricsAggregator } from "@/lib/core/metrics-aggregator";
import { PerformanceMonitor } from "@/lib/core/performance-monitor";
import { ErrorTracker } from "@/lib/core/error-tracker";
import { Logger } from "@/lib/core/logger";

export default function DashboardPage() {
  const store = useMemo(() => new DashboardStore(), []);
  const { isConnected, isReconnecting } = useEventStream(store);
  const { agents, events, stats, taskHistory } = useDashboardStore(store);
  useOpenClawSessions(store);
  const { metrics: openClawMetrics, source: openClawSource } = useOpenClawMetrics();
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [isGameLoading, setIsGameLoading] = useState(true);
  const [gameError, setGameError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"game" | "timeline">("game");

  const metricsAggregator = useMemo(() => {
    const perfMonitor = new PerformanceMonitor();
    const errorTracker = new ErrorTracker();
    const logger = new Logger();
    return new MetricsAggregator(perfMonitor, errorTracker, logger, undefined, {
      updateIntervalMs: 120000,
    });
  }, []);

  useEffect(() => {
    if (activeView !== "game") {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      setIsGameLoading(false);
      return;
    }

    if (containerRef.current && !gameRef.current) {
      setIsGameLoading(true);
      try {
        gameRef.current = startGame("dashboard-game-container");
        setGameError(null);
      } catch (err) {
        setGameError(err instanceof Error ? err.message : "游戏加载失败");
      } finally {
        setIsGameLoading(false);
      }
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [activeView]);

  const handleSendEvent = useCallback(
    async (event: GameEvent) => {
      try {
        await fetch("/api/game-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });
        store.processEvent(event);
      } catch {
        store.processEvent(event);
      }
    },
    [store]
  );

  const handleTriggerTask = useCallback((taskId: string) => {
    gameRef.current?.receiveGameEvent?.({
      type: 'agent:status-change',
      agentId: 'pm-agent',
      status: 'busy',
      timestamp: Date.now(),
    } as GameEvent);
  }, []);

  // Bridge: forward SSE GameEvents to Phaser OfficeScene
  useEffect(() => {
    const GAME_EVENTS_TO_FORWARD: GameEvent['type'][] = [
      'pm:analysis-complete',
      'dev:iteration-start',
      'review:rejected',
      'workflow:iteration-complete',
      'agent:status-change',
    ];

    const originalProcessEvent = store.processEvent.bind(store);
    store.processEvent = (event: GameEvent) => {
      originalProcessEvent(event);
      if (GAME_EVENTS_TO_FORWARD.includes(event.type)) {
        gameRef.current?.receiveGameEvent?.(event);
      }
    };
  }, [store]);

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
                isConnected
                  ? "bg-green-500 animate-pulse"
                  : isReconnecting
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <span className="text-gray-400">
              {isConnected ? "Connected" : isReconnecting ? "Reconnecting..." : "Disconnected"}
            </span>
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
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: canvas fills available space */}
        <div className="flex-1 flex flex-col p-4 gap-3 min-w-0 overflow-hidden">
          {activeView === "game" ? (
            <>
              <div className="glass rounded-2xl p-2 border border-dark-100 flex-1 flex items-center justify-center overflow-hidden">
                <div
                  className="relative rounded-xl overflow-hidden w-full h-full"
                  style={{ aspectRatio: "12/7" }}
                >
                  <div
                    id="dashboard-game-container"
                    ref={containerRef}
                    className="w-full h-full"
                  />

                  {isGameLoading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2" />
                        <p className="text-gray-300 text-sm">Loading office...</p>
                      </div>
                    </div>
                  )}

                  {gameError && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                      <div className="text-center p-4">
                        <div className="text-red-400 text-2xl mb-2">⚠️</div>
                        <p className="text-red-300 text-sm mb-1">加载失败</p>
                        <p className="text-gray-400 text-xs mb-3">{gameError}</p>
                        <button
                          onClick={() => window.location.reload()}
                          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded text-sm text-white transition-colors"
                        >
                          重新加载
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Hint bar */}
              <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-dark-50 border border-dark-100 rounded font-mono">Click</kbd>
                  {" "}角色 → 查看任务详情
                </span>
              </div>
            </>
          ) : (
            <TraditionalTaskView tasks={taskHistory} />
          )}
        </div>

        {/* Right sidebar */}
        <aside className="w-80 border-l border-dark-100 flex flex-col overflow-hidden shrink-0">
          <div className="border-b border-dark-100 p-3 shrink-0">
            <ControlPanel onSendEvent={handleSendEvent} onTriggerTask={handleTriggerTask} />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AgentStatusPanel agents={agents} />
            <EventLog events={events} />
            <PerformanceMetricsPanel
              metricsAggregator={metricsAggregator}
              openClawMetrics={openClawMetrics}
              openClawSource={openClawSource}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
