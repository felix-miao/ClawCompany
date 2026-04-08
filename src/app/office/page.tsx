"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PerformanceMonitor } from "@/game/systems/PerformanceMonitor";
import { EnhancedPerformancePanel } from "@/components/EnhancedPerformancePanel";

import { Game } from "@/game";

export default function OfficePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceStats, setPerformanceStats] = useState<{
    fps: number;
    frameTime: number;
    memory: string;
    agents: number;
  } | null>(null);
  const [showPerformanceDetail, setShowPerformanceDetail] = useState(false);
  const [showEnhancedPanel, setShowEnhancedPanel] = useState(false);

  const updatePerformanceStats = useCallback(() => {
    if (gameRef.current && gameRef.current.getPerformanceMonitor) {
      const monitor = gameRef.current.getPerformanceMonitor();
      if (monitor) {
        const fps = monitor.getCurrentFPS();
        const frameTime = monitor.getAverageFrameTime();
        const memory = `${Math.round(monitor.getMemoryUsage() / 1024 / 1024)}MB`;
        const agents = gameRef.current.getAgents?.().length || 0;
        
        setPerformanceStats({
          fps: Math.round(fps),
          frameTime: Math.round(frameTime),
          memory,
          agents,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      setIsLoading(true);
      import("@/game").then(({ startGame }) => {
        try {
          gameRef.current = startGame("game-container");
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : '游戏加载失败');
        } finally {
          setIsLoading(false);
        }
      }).catch((err) => {
        setError('游戏模块加载失败');
        setIsLoading(false);
      });
    }

    const performanceInterval = setInterval(updatePerformanceStats, 2000);

    // 添加键盘快捷键监听
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === 'P') {
        event.preventDefault();
        setShowEnhancedPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      clearInterval(performanceInterval);
      window.removeEventListener('keydown', handleKeyPress);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [updatePerformanceStats]);

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      <header className="glass border-b border-dark-100 px-6 py-4">
        <h1 className="text-xl font-bold gradient-text">虚拟办公室 - Phaser 3</h1>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-2 sm:p-4 border border-dark-100 w-full max-w-4xl">
            <div className="relative rounded-xl overflow-hidden w-full"
            style={{ 
              aspectRatio: '4/3',
              maxWidth: '800px',
              margin: '0 auto'
            }}
          >
            <div
              id="game-container"
              ref={containerRef}
              className="w-full h-full"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
                  <p className="text-gray-300 text-sm">正在加载虚拟办公室...</p>
                </div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div className="text-center p-4">
                  <div className="text-red-400 text-2xl mb-2">⚠️</div>
                  <p className="text-red-300 text-sm mb-2">加载失败</p>
                  <p className="text-gray-400 text-xs">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-3 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded text-sm text-white transition-colors"
                  >
                    重新加载
                  </button>
                </div>
              </div>
            )}
            
            {/* 简化的性能监控面板 */}
            {performanceStats && (
              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg p-2 text-xs text-gray-300 transition-all duration-200 hover:bg-black/80">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-400">性能:</span>
                  <button 
                    onClick={() => setShowPerformanceDetail(!showPerformanceDetail)}
                    className="text-xs text-primary-400 hover:text-primary-300"
                  >
                    {showPerformanceDetail ? '简化' : '详细'}
                  </button>
                </div>
                
                {/* 关键指标 */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">FPS:</span>
                  <span className={`font-mono ${performanceStats.fps >= 55 ? 'text-green-400' : performanceStats.fps >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {performanceStats.fps}
                  </span>
                </div>
                
                {/* 详细信息（可展开） */}
                {showPerformanceDetail && (
                  <div className="mt-2 pt-2 border-t border-gray-600 space-y-1">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-gray-400">帧时间:</span>
                      <span className="font-mono text-blue-400">{performanceStats.frameTime}ms</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-gray-400">内存:</span>
                      <span className="font-mono text-purple-400">{performanceStats.memory}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-gray-400">角色:</span>
                      <span className="font-mono text-orange-400">{performanceStats.agents}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 增强性能监控面板 */}
          {gameRef.current && showEnhancedPanel && (
            <EnhancedPerformancePanel
              monitor={gameRef.current.getPerformanceMonitor()}
              isVisible={showEnhancedPanel}
              onClose={() => setShowEnhancedPanel(false)}
            />
          )}
          
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-gray-300 text-sm font-medium">
                🎮 操作指南
              </p>
              <details className="group">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                  更多快捷键 ↓
                </summary>
                <div className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-300 space-y-1">
                  <div className="flex justify-between">
                    <span>Tab</span>
                    <span>切换角色</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Space</span>
                    <span>开始/停止工作</span>
                  </div>
                  <div className="flex justify-between">
                    <span>H</span>
                    <span>显示历史记录</span>
                  </div>
                  <div className="flex justify-between">
                    <span>S</span>
                    <span>显示统计面板</span>
                  </div>
                  <div className="flex justify-between">
                    <span>R</span>
                    <span>重置场景</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P</span>
                    <span>性能监控</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shift+P</span>
                    <span>详细性能</span>
                  </div>
                </div>
              </details>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-400">
              <div className="flex items-center justify-center gap-1">
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">WASD</kbd>
                <span>移动</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">D</kbd>
                <span>调试</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">点击</kbd>
                <span>任务</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">双击</kbd>
                <span>快速移动</span>
              </div>
            </div>
            <p className="text-gray-500 text-xs text-center">
              💡 提示：点击空白处移动角色，点击角色查看任务状态，双击快速移动
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}