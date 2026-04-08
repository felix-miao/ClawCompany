"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";

import { AgentStatusPanel } from "@/components/dashboard/AgentStatusPanel";
import { EventLog } from "@/components/dashboard/EventLog";
import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { PerformanceMetricsPanel } from "@/components/dashboard/PerformanceMetricsPanel";
import { useEventStream } from "@/hooks/useEventStream";
import { useDashboardStore } from "@/hooks/useDashboardStore";
import { Game } from "@/game";
import { DashboardStore } from "@/game/data/DashboardStore";
import { GameEvent } from "@/game/types/GameEvents";
import { MetricsAggregator } from "@/lib/core/metrics-aggregator";
import { PerformanceMonitor } from "@/lib/core/performance-monitor";
import { ErrorTracker } from "@/lib/core/error-tracker";
import { Logger } from "@/lib/core/logger";

export default function DashboardPage() {
  const store = useMemo(() => new DashboardStore(), []);
  const { isConnected, isReconnecting } = useEventStream(store);
  const { agents, events, stats } = useDashboardStore(store);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  
  // 初始化性能监控组件
  const metricsAggregator = useMemo(() => {
    const perfMonitor = new PerformanceMonitor();
    const errorTracker = new ErrorTracker();
    const logger = new Logger();
    return new MetricsAggregator(perfMonitor, errorTracker, logger);
  }, []);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      import("@/game").then(({ startGame }) => {
        gameRef.current = startGame("dashboard-game-container");
      });
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
      }
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      <header className="glass border-b border-dark-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            ← Back
          </Link>
          <h1 className="text-xl font-bold gradient-text">
            Dashboard
          </h1>
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
              {isConnected
                ? "Connected"
                : isReconnecting
                ? "Reconnecting..."
                : "Disconnected"}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {stats.totalEvents} events | {stats.activeTasks} active tasks
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-3 border border-dark-100">
            <div
              id="dashboard-game-container"
              ref={containerRef}
              className="rounded-xl overflow-hidden"
              style={{ width: 800, height: 600 }}
            />
          </div>
        </div>

        <aside className="w-80 border-l border-dark-100 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AgentStatusPanel agents={agents} />
            <PerformanceMetricsPanel metricsAggregator={metricsAggregator} />
            <EventLog events={events} />
          </div>
          <div className="border-t border-dark-100 p-3">
            <ControlPanel onSendEvent={handleSendEvent} />
          </div>
        </aside>
      </main>
    </div>
  );
}
