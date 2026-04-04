"use client";

import { useEffect, useState } from 'react';

import { MetricsAggregator, PerformanceMetrics } from '@/lib/core/metrics-aggregator';

interface PerformanceMetricsPanelProps {
  metricsAggregator: MetricsAggregator;
}

export function PerformanceMetricsPanel({ metricsAggregator }: PerformanceMetricsPanelProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  useEffect(() => {
    const cleanup = metricsAggregator.startPeriodicUpdate((newMetrics) => {
      setMetrics(newMetrics);
      setLastUpdate(new Date());
    });
    
    return cleanup;
  }, [metricsAggregator]);
  
  const getHealthColor = (health: 'healthy' | 'warning' | 'critical') => {
    switch (health) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };
  
  const getHealthBadge = (health: 'healthy' | 'warning' | 'critical') => {
    const colors = {
      healthy: 'bg-green-500/20 border-green-500/50',
      warning: 'bg-yellow-500/20 border-yellow-500/50',
      critical: 'bg-red-500/20 border-red-500/50'
    };
    
    const labels = {
      healthy: '健康',
      warning: '警告',
      critical: '严重'
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${colors[health]}`}>
        {labels[health]}
      </span>
    );
  };
  
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} MB`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} GB`;
  };
  
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };
  
  if (!metrics) {
    return (
      <div className="glass rounded-lg p-4 border border-dark-100">
        <h3 className="text-lg font-semibold mb-4 text-white">性能指标</h3>
        <div className="flex items-center justify-center h-32 text-gray-500">
          加载性能数据...
        </div>
      </div>
    );
  }
  
  return (
    <div className="glass rounded-lg p-4 border border-dark-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">性能指标</h3>
        <div className="text-xs text-gray-400">
          {lastUpdate && lastUpdate.toLocaleTimeString()}
        </div>
      </div>
      
      {/* 系统健康度 */}
      <div className="mb-6 p-3 rounded-lg bg-dark/50 border border-dark-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">系统健康度</span>
          {getHealthBadge(metrics.health.overall)}
        </div>
        <div className="text-xs text-gray-500">
          运行时间: {Math.floor(metrics.health.uptime / 3600)}h {Math.floor((metrics.health.uptime % 3600) / 60)}m
        </div>
      </div>
      
      {/* 内存使用 */}
      <div className="mb-6 p-3 rounded-lg bg-dark/50 border border-dark-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">内存使用</span>
          <span className="text-xs text-gray-400">
            {formatBytes(metrics.memoryUsage.used)} / {formatBytes(metrics.memoryUsage.total)}
          </span>
        </div>
        <div className="w-full bg-dark-700 rounded-full h-2 mb-1">
          <div 
            className={`h-2 rounded-full ${
              metrics.memoryUsage.percentage > 90 ? 'bg-red-500' :
              metrics.memoryUsage.percentage > 75 ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{ width: `${metrics.memoryUsage.percentage}%` }}
          />
        </div>
        <div className="text-xs text-gray-500">
          {metrics.memoryUsage.percentage.toFixed(1)}% 已使用
        </div>
      </div>
      
      {/* 任务统计 */}
      <div className="mb-6 p-3 rounded-lg bg-dark/50 border border-dark-100">
        <h4 className="text-sm font-medium text-gray-300 mb-3">任务统计</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{metrics.tasks.total}</div>
            <div className="text-xs text-gray-500">总计</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{metrics.tasks.completed}</div>
            <div className="text-xs text-gray-500">已完成</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{metrics.tasks.inProgress}</div>
            <div className="text-xs text-gray-500">进行中</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{metrics.tasks.failed}</div>
            <div className="text-xs text-gray-500">失败</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          平均执行时间: {formatTime(metrics.tasks.averageExecutionTime)}
        </div>
      </div>
      
      {/* 错误统计 */}
      <div className="mb-6 p-3 rounded-lg bg-dark/50 border border-dark-100">
        <h4 className="text-sm font-medium text-gray-300 mb-3">错误统计</h4>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">错误率</span>
          <span className={`text-sm font-medium ${
            metrics.errors.rate > 10 ? 'text-red-400' :
            metrics.errors.rate > 5 ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            {metrics.errors.rate.toFixed(2)}%
          </span>
        </div>
        <div className="text-xs text-gray-500 mb-2">
          总计错误: {metrics.errors.total}
        </div>
        
        {Object.keys(metrics.errors.byCategory).length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-gray-400 mb-1">按类别分布:</div>
            {Object.entries(metrics.errors.byCategory).map(([category, count]) => (
              <div key={category} className="flex justify-between text-xs">
                <span className="text-gray-400">{category}</span>
                <span className="text-gray-300">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 性能指标 */}
      <div className="p-3 rounded-lg bg-dark/50 border border-dark-100">
        <h4 className="text-sm font-medium text-gray-300 mb-3">响应时间</h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">平均响应时间</span>
            <span className="text-gray-300">{formatTime(metrics.performance.averageResponseTime)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">95分位响应时间</span>
            <span className="text-gray-300">{formatTime(metrics.performance.p95ResponseTime)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">99分位响应时间</span>
            <span className="text-gray-300">{formatTime(metrics.performance.p99ResponseTime)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">吞吐量</span>
            <span className="text-gray-300">{metrics.performance.throughput} 任务/分钟</span>
          </div>
        </div>
      </div>
    </div>
  );
}