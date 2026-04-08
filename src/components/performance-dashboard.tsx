'use client';

import { useState, useEffect } from 'react';

import { PerformanceMonitor, PerformanceReport, ApiStats, MemoryStats } from '@/lib/monitoring/performance-monitor';
import { ApiPerformanceMonitor } from '@/lib/monitoring/api-performance-monitor';

interface PerformanceDashboardProps {
  performanceMonitor: PerformanceMonitor;
}

interface ApiCardData {
  name: string;
  stats: ApiStats;
  isExpanded: boolean;
}

export function PerformanceDashboard({ performanceMonitor }: PerformanceDashboardProps) {
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [apiCards, setApiCards] = useState<ApiCardData[]>([]);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);

  const apiPerformanceMonitor = new ApiPerformanceMonitor(performanceMonitor);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const report = performanceMonitor.generatePerformanceReport();
      const memoryStats = performanceMonitor.getMemoryStats();
      const monitoredApis = performanceMonitor.getMonitoredApis();
      
      setPerformanceReport(report);
      setMemoryStats(memoryStats);
      
      const cardsData = monitoredApis.map(api => ({
        name: api,
        stats: performanceMonitor.getApiStats(api),
        isExpanded: false
      }));
      
      setApiCards(cardsData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleApiCard = (apiName: string) => {
    setApiCards(prevCards => 
      prevCards.map(card => 
        card.name === apiName 
          ? { ...card, isExpanded: !card.isExpanded }
          : card
      )
    );
  };

  const getPerformanceStatus = () => {
    if (!performanceReport) return { status: 'loading', message: '加载中...' };
    
    const { successRate, averageResponseTime } = performanceReport;
    
    if (successRate < 0.9) {
      return {
        status: 'warning',
        message: `错误率过高: ${Math.round((1 - successRate) * 100)}%`
      };
    }
    
    if (averageResponseTime > 1000) {
      return {
        status: 'warning',
        message: `平均响应时间过长: ${averageResponseTime}ms`
      };
    }
    
    return {
      status: 'good',
      message: '性能正常',
      details: `成功率: ${Math.round(successRate * 100)}%, 响应时间: ${averageResponseTime}ms`
    };
  };

  const getMemoryStatus = () => {
    if (!memoryStats) return { status: 'loading', message: '加载中...' };
    
    const { currentPercentage } = memoryStats;
    
    if (currentPercentage > 80) {
      return {
        status: 'warning',
        message: `内存使用过高: ${currentPercentage}%`
      };
    }
    
    if (currentPercentage > 60) {
      return {
        status: 'caution',
        message: `内存使用较高: ${currentPercentage}%`
      };
    }
    
    return {
      status: 'good',
      message: `内存使用正常: ${currentPercentage}%`
    };
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatUptime = (durationMs: number) => {
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  useEffect(() => {
    fetchData();
    
    // 设置自动刷新
    const interval = setInterval(fetchData, 30000); // 每30秒刷新一次
    return () => clearInterval(interval);
  }, []);

  const performanceStatus = getPerformanceStatus();
  const memoryStatus = getMemoryStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">加载性能数据中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">性能监控仪表板</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            最后更新: {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            刷新数据
          </button>
        </div>
      </div>

      {/* 性能概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">总API调用</div>
          <div className="text-2xl font-bold text-white">
            {performanceReport?.totalApiCalls || 0}
          </div>
        </div>
        
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">平均响应时间</div>
          <div className="text-2xl font-bold text-white">
            {performanceReport ? formatDuration(performanceReport.averageResponseTime) : '0ms'}
          </div>
        </div>
        
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">成功率</div>
          <div className="text-2xl font-bold text-white">
            {performanceReport ? `${Math.round(performanceReport.successRate * 100)}%` : '0%'}
          </div>
        </div>
        
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">监控时长</div>
          <div className="text-2xl font-bold text-white">
            {performanceReport ? formatUptime(performanceReport.timeRange.duration) : '0分钟'}
          </div>
        </div>
      </div>

      {/* 状态指示器 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`glass rounded-xl p-4 ${performanceStatus.status === 'warning' ? 'border border-red-500' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            {performanceStatus.status === 'warning' ? (
              <span className="text-red-500">⚠️</span>
            ) : (
              <span className="text-green-500">✅</span>
            )}
            <span className="font-semibold text-white">
              {performanceStatus.status === 'warning' ? '性能警告' : '性能正常'}
            </span>
          </div>
          <div className="text-sm text-gray-300">
            {performanceStatus.message}
          </div>
          {performanceStatus.details && (
            <div className="text-sm text-green-400 mt-1">
              {performanceStatus.details}
            </div>
          )}
        </div>
        
        <div className={`glass rounded-xl p-4 ${memoryStatus.status === 'warning' ? 'border border-red-500' : memoryStatus.status === 'caution' ? 'border border-yellow-500' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            {memoryStatus.status === 'warning' ? (
              <span className="text-red-500">⚠️</span>
            ) : memoryStatus.status === 'caution' ? (
              <span className="text-yellow-500">⚡</span>
            ) : (
              <span className="text-green-500">✅</span>
            )}
            <span className="font-semibold text-white">
              {memoryStatus.status === 'warning' ? '内存警告' : memoryStatus.status === 'caution' ? '内存注意' : '内存正常'}
            </span>
          </div>
          <div className="text-sm text-gray-300">
            {memoryStatus.message}
          </div>
          {memoryStats && (
            <div className="text-sm text-gray-400 mt-1">
              当前: {memoryStats.currentUsage}MB | 平均: {memoryStats.averageUsage}MB | 峰值: {memoryStats.peakUsage}MB
            </div>
          )}
        </div>
      </div>

      {/* 内存使用图表 */}
      <div className="glass rounded-xl p-4">
        <h2 className="text-xl font-bold text-white mb-4">内存使用</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{memoryStats?.currentUsage || 0}MB</div>
              <div className="text-sm text-gray-400">当前使用</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{memoryStats?.averageUsage || 0}MB</div>
              <div className="text-sm text-gray-400">平均使用</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{memoryStats?.peakUsage || 0}MB</div>
              <div className="text-sm text-gray-400">峰值使用</div>
            </div>
          </div>
          
          {/* 简单的进度条 */}
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div 
              className={`h-full rounded-full ${memoryStats?.currentPercentage && memoryStats.currentPercentage > 80 ? 'bg-red-500' : memoryStats?.currentPercentage && memoryStats.currentPercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${memoryStats?.currentPercentage || 0}%` }}
            ></div>
          </div>
          <div className="text-sm text-gray-400 text-center">
            {memoryStats?.currentPercentage || 0}% 使用率
          </div>
        </div>
      </div>

      {/* API性能统计 */}
      <div className="glass rounded-xl p-4">
        <h2 className="text-xl font-bold text-white mb-4">API性能统计</h2>
        <div className="space-y-4">
          {apiCards.map((card) => (
            <div key={card.name} className="border border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleApiCard(card.name)}
                className="w-full p-4 bg-gray-800 hover:bg-gray-700 transition-colors flex justify-between items-center"
              >
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-white">{card.name}</span>
                  <span className="text-sm text-gray-400">
                    {formatDuration(card.stats.averageResponseTime)} 平均 | {Math.round(card.stats.successRate * 100)}% 成功率
                  </span>
                </div>
                <span className="text-gray-400">{card.isExpanded ? '▲' : '▼'}</span>
              </button>
              
              {card.isExpanded && (
                <div className="p-4 bg-gray-900 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{card.stats.totalCalls}</div>
                      <div className="text-sm text-gray-400">总调用</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-400">{card.stats.successfulCalls}</div>
                      <div className="text-sm text-gray-400">成功</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-400">{card.stats.failedCalls}</div>
                      <div className="text-sm text-gray-400">失败</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-400">{card.stats.slowCallCount}</div>
                      <div className="text-sm text-gray-400">慢调用</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-sm">
                      <span className="text-gray-400">最慢响应: </span>
                      <span className="text-white font-medium">{formatDuration(card.stats.maxResponseTime)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-400">最快响应: </span>
                      <span className="text-white font-medium">{formatDuration(card.stats.minResponseTime)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {apiCards.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              暂无API调用数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}