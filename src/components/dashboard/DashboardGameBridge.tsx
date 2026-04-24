'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEventStream } from '@/hooks/useEventStream';
import { DashboardStore } from '@/game/data/DashboardStore';
import type { GameEvent } from '@/game/types/GameEvents';

type DashboardGameInstance = {
  receiveGameEvent?: (event: GameEvent) => void;
  destroy: (destroyChildren?: boolean) => void;
};

interface DashboardGameBridgeProps {
  activeView: 'game' | 'timeline';
  onTriggerTaskHandlerChange?: (handler: (taskId: string) => void) => void;
}

const GAME_EVENTS_TO_FORWARD: GameEvent['type'][] = [
  'pm:analysis-complete',
  'dev:iteration-start',
  'review:rejected',
  'workflow:iteration-complete',
  'agent:status-change',
];

export function DashboardGameBridge({ activeView, onTriggerTaskHandlerChange = () => {} }: DashboardGameBridgeProps) {
  const store = useMemo(() => new DashboardStore(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<DashboardGameInstance | null>(null);
  const [isGameLoading, setIsGameLoading] = useState(true);
  const [gameError, setGameError] = useState<string | null>(null);

  useEventStream(store);

  const handleTriggerTask = useCallback(() => {
    gameRef.current?.receiveGameEvent?.({
      type: 'agent:status-change',
      agentId: 'pm-agent',
      status: 'busy',
      timestamp: Date.now(),
    } as GameEvent);
  }, []);

  useEffect(() => {
    const originalProcessEvent = store.processEvent.bind(store);

    store.processEvent = (event: GameEvent) => {
      originalProcessEvent(event);
      if (GAME_EVENTS_TO_FORWARD.includes(event.type)) {
        gameRef.current?.receiveGameEvent?.(event);
      }
    };

    return () => {
      store.processEvent = originalProcessEvent;
    };
  }, [store]);

  useEffect(() => {
    onTriggerTaskHandlerChange(handleTriggerTask);

    return () => onTriggerTaskHandlerChange(() => {});
  }, [handleTriggerTask, onTriggerTaskHandlerChange]);

  useEffect(() => {
    if (activeView !== 'game') {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      setIsGameLoading(false);
      return;
    }

    if (containerRef.current && !gameRef.current) {
      setIsGameLoading(true);
      let cancelled = false;

      (async () => {
        try {
          const { startGame } = await import('@/game');
          if (cancelled) return;
          gameRef.current = startGame('dashboard-game-container') as DashboardGameInstance;
          setGameError(null);
        } catch (err) {
          if (!cancelled) {
            setGameError(err instanceof Error ? err.message : '游戏加载失败');
            gameRef.current = null;
          }
        } finally {
          if (!cancelled) {
            setIsGameLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [activeView]);

  return (
    <div className="glass rounded-2xl p-2 border border-dark-100 flex-1 flex items-center justify-center overflow-hidden">
      <div className="relative rounded-xl overflow-hidden w-full h-full" style={{ aspectRatio: '12/7' }}>
        <div
          id="dashboard-game-container"
          ref={containerRef}
          className="w-full h-full"
        />
        {(isGameLoading || gameError) && (
          <div className={`absolute inset-0 ${gameError ? 'bg-black/80' : 'bg-black/60'} flex items-center justify-center`}>
            <div className="text-center p-4">
              {gameError ? (
                <>
                  <div className="text-red-400 text-2xl mb-2">⚠️</div>
                  <p className="text-red-300 text-sm mb-1">加载失败</p>
                  <p className="text-gray-400 text-xs mb-3">{gameError}</p>
                </>
              ) : (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2" />
                  <p className="text-gray-300 text-sm">Loading office...</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
