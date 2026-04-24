"use client";

import { useEffect, useState, useCallback } from "react";
import { PerformanceMonitor, FrameStats } from "@/game/systems/PerformanceMonitor";

interface EnhancedPerformancePanelProps {
  monitor: PerformanceMonitor | null;
  isVisible: boolean;
  onClose: () => void;
}

interface PerformanceHistory {
  timestamp: number;
  fps: number;
  frameTime: number;
  memory: number;
}

export function EnhancedPerformancePanel({ 
  monitor, 
  isVisible, 
  onClose 
}: EnhancedPerformancePanelProps) {
  const [stats, setStats] = useState<FrameStats | null>(null);
  const [history, setHistory] = useState<PerformanceHistory[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [maxHistoryLength] = useState(60);
  const [expandedSection, setExpandedSection] = useState<string | null>('fps');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true); // 显示最近60个数据点

  const updateStats = useCallback(() => {
    if (!monitor) return;

    const currentStats = monitor.getFrameStats();
    setStats(currentStats);

    // 更新历史数据
    const newEntry: PerformanceHistory = {
      timestamp: Date.now(),
      fps: currentStats.currentFPS,
      frameTime: currentStats.avgFrameTime,
      memory: monitor.getMemoryUsage(),
    };

    setHistory(prev => {
      const updated = [...prev, newEntry];
      return updated.slice(-maxHistoryLength);
    });

    // 检查预警
    const newAlerts: string[] = [];
    if (currentStats.currentFPS < 30) {
      newAlerts.push("⚠️ 性能警告: FPS低于30");
    }
    if (currentStats.avgFrameTime > 35) {
      newAlerts.push("⚠️ 延迟警告: 帧时间过高");
    }
    if (monitor.getMemoryUsage() > 100 * 1024 * 1024) {
      newAlerts.push("⚠️ 内存警告: 使用超过100MB");
    }
    
    setAlerts(newAlerts);
  }, [monitor, maxHistoryLength]);

  useEffect(() => {
    if (!isVisible || !monitor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'r' || e.key === 'R') {
        if (!isAutoRefresh) {
          updateStats();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsAutoRefresh(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, monitor, updateStats, onClose, isAutoRefresh]);

  useEffect(() => {
    if (!isVisible || !monitor) return;

    const interval = setInterval(() => {
      if (isAutoRefresh) {
        updateStats();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isVisible, monitor, updateStats, isAutoRefresh]);

  const handleManualRefresh = useCallback(() => {
    if (!isAutoRefresh) {
      updateStats();
    }
  }, [isAutoRefresh, updateStats]);

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return "text-green-400";
    if (fps >= 30) return "text-yellow-400";
    return "text-red-400";
  };

  const getFrameTimeColor = (time: number) => {
    if (time <= 16) return "text-green-400";
    if (time <= 33) return "text-yellow-400";
    return "text-red-400";
  };

  const getPerformanceGrade = () => {
    if (!stats) return "未知";
    const avgFPS = stats.averageFPS;
    if (avgFPS >= 55) return "优秀";
    if (avgFPS >= 45) return "良好";
    if (avgFPS >= 30) return "一般";
    return "较差";
  };

  const getPerformanceGradeColor = () => {
    const grade = getPerformanceGrade();
    switch (grade) {
      case "优秀": return "text-green-400";
      case "良好": return "text-yellow-400";
      case "一般": return "text-orange-400";
      case "较差": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  if (!isVisible || !stats) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">性能监控面板</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">性能等级:</span>
              <span className={`text-sm font-bold ${getPerformanceGradeColor()}`}>
                {getPerformanceGrade()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 实时指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div 
            className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750 transition-colors"
            onClick={() => setExpandedSection(expandedSection === 'currentFps' ? null : 'currentFps')}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-gray-400 text-sm">当前 FPS</div>
              <span className="text-gray-500 text-xs">{expandedSection === 'currentFps' ? '▲' : '▼'}</span>
            </div>
            <div className={`text-2xl font-bold ${getFPSColor(stats.currentFPS)}`}>
              {stats.currentFPS.toFixed(0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              目标: 60 FPS
            </div>
          </div>
          
          <div 
            className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750 transition-colors"
            onClick={() => setExpandedSection(expandedSection === 'avgFps' ? null : 'avgFps')}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-gray-400 text-sm">平均 FPS</div>
              <span className="text-gray-500 text-xs">{expandedSection === 'avgFps' ? '▲' : '▼'}</span>
            </div>
            <div className={`text-2xl font-bold ${getFPSColor(stats.averageFPS)}`}>
              {stats.averageFPS.toFixed(0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              样本: {stats.samples}
            </div>
          </div>
          
          <div 
            className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750 transition-colors"
            onClick={() => setExpandedSection(expandedSection === 'frameTime' ? null : 'frameTime')}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-gray-400 text-sm">帧时间</div>
              <span className="text-gray-500 text-xs">{expandedSection === 'frameTime' ? '▲' : '▼'}</span>
            </div>
            <div className={`text-2xl font-bold ${getFrameTimeColor(stats.avgFrameTime)}`}>
              {stats.avgFrameTime.toFixed(1)}ms
            </div>
            <div className="text-xs text-gray-500 mt-1">
              理想: &lt;16ms
            </div>
          </div>
          
          <div 
            className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750 transition-colors"
            onClick={() => setExpandedSection(expandedSection === 'memory' ? null : 'memory')}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-gray-400 text-sm">内存使用</div>
              <span className="text-gray-500 text-xs">{expandedSection === 'memory' ? '▲' : '▼'}</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">
              {((monitor?.getMemoryUsage?.() || 0) / 1024 / 1024 || 0).toFixed(1)}MB
            </div>
            <div className="text-xs text-gray-500 mt-1">
              峰值: {(Math.max(...history.map(h => h.memory), 0) / 1024 / 1024 || 0).toFixed(1)}MB
            </div>
          </div>
        </div>

        {/* 自动刷新开关 */}
        <div className="flex items-center justify-between mb-4 bg-gray-800 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">自动刷新</span>
            <button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isAutoRefresh ? 'bg-primary-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAutoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <button
            onClick={handleManualRefresh}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            立即刷新
          </button>
        </div>

        {/* 预警信息 */}
        {alerts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-red-400 mb-2">⚠️ 预警信息</h3>
            <div className="space-y-1">
              {alerts.map((alert, index) => (
                <div key={index} className="text-sm text-red-300 bg-red-900/20 rounded px-3 py-2">
                  {alert}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 性能趋势图表 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">FPS 趋势</h3>
          <div className="bg-gray-800 rounded-lg p-4 h-32">
            <PerformanceChart 
              data={history.map(h => h.fps)} 
              target={60}
              color="#10b981"
              width="100%"
              height="100px"
            />
          </div>
        </div>

        {/* 帧时间趋势图表 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">帧时间趋势</h3>
          <div className="bg-gray-800 rounded-lg p-4 h-32">
            <PerformanceChart 
              data={history.map(h => h.frameTime)} 
              target={16}
              color="#3b82f6"
              width="100%"
              height="100px"
            />
          </div>
        </div>

        {/* 性能统计 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">详细统计</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">最低 FPS:</span>
              <span className="font-mono text-blue-400">{stats.minFPS.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">最高 FPS:</span>
              <span className="font-mono text-green-400">{stats.maxFPS.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">FPS 变异:</span>
              <span className="font-mono text-yellow-400">
                {Math.abs(stats.maxFPS - stats.minFPS).toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">数据点:</span>
              <span className="font-mono text-gray-300">{history.length}</span>
            </div>
          </div>
        </div>

        {/* 优化建议 */}
        <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">💡 优化建议</h3>
          <div className="text-sm text-blue-300 space-y-1">
            {stats.averageFPS < 30 && (
              <div>• 考虑降低游戏复杂度或减少粒子效果数量</div>
            )}
            {stats.avgFrameTime > 20 && (
              <div>• 启用渲染优化，减少不必要的重绘</div>
            )}
            {(monitor?.getMemoryUsage?.() || 0) > 50 * 1024 * 1024 && (
              <div>• 注意内存泄漏，定期清理未使用的资源</div>
            )}
            {stats.averageFPS >= 45 && (
              <div>• 性能良好，可以适当增加视觉效果</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 简单的SVG性能图表组件
interface PerformanceChartProps {
  data: number[];
  target: number;
  color: string;
  width: string;
  height: string;
}

function PerformanceChart({ data, target, color, width, height }: PerformanceChartProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data, target);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = ((max - value) / range) * 100;
    return `${x}%,${y}%`;
  }).join(' ');

  const targetY = ((max - target) / range) * 100;

  return (
    <svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
      {/* 目标线 */}
      <line
        x1="0"
        y1={targetY}
        x2="100"
        y2={targetY}
        stroke="#ef4444"
        strokeDasharray="2,2"
        opacity="0.5"
      />
      <text
        x="2"
        y={targetY - 2}
        fill="#ef4444"
        fontSize="3"
        className="text-xs"
      >
        目标
      </text>
      
      {/* 性能曲线 */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
      
      {/* 填充区域 */}
      <polygon
        points={`0,100 ${points} 100,100`}
        fill={color}
        opacity="0.2"
      />
    </svg>
  );
}