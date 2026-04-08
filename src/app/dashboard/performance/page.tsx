'use client';

import { PerformanceMonitor } from '@/lib/monitoring/performance-monitor';
import { PerformanceDashboard } from '@/components/performance-dashboard';

// 创建性能监控实例
const performanceMonitor = new PerformanceMonitor();

// 设置一些初始数据用于演示
const initDemoData = () => {
  // 记录一些示例API调用
  const now = Date.now();
  
  // 模拟API调用记录
  for (let i = 0; i < 50; i++) {
    const startTime = now - Math.random() * 3600000; // 过去1小时内
    const duration = 100 + Math.random() * 1000; // 100-1100ms
    const success = Math.random() > 0.1; // 90%成功率
    
    performanceMonitor.recordApiCall('api1', startTime, startTime + duration, success);
  }
  
  for (let i = 0; i < 30; i++) {
    const startTime = now - Math.random() * 3600000;
    const duration = 200 + Math.random() * 800; // 200-1000ms
    const success = Math.random() > 0.15; // 85%成功率
    
    performanceMonitor.recordApiCall('api2', startTime, startTime + duration, success);
  }
  
  for (let i = 0; i < 20; i++) {
    const startTime = now - Math.random() * 3600000;
    const duration = 300 + Math.random() * 500; // 300-800ms
    const success = Math.random() > 0.05; // 95%成功率
    
    performanceMonitor.recordApiCall('llm-glm-5', startTime, startTime + duration, success);
  }
  
  // 记录内存使用数据
  for (let i = 0; i < 20; i++) {
    const usage = 400 + Math.random() * 200; // 400-600MB
    const total = 1000;
    const percentage = (usage / total) * 100;
    
    performanceMonitor.recordMemoryUsage({ used: usage, total, percentage });
  }
};

// 初始化演示数据
initDemoData();

export default function PerformancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-50 to-dark p-4 md:p-8">
      <PerformanceDashboard performanceMonitor={performanceMonitor} />
    </div>
  );
}