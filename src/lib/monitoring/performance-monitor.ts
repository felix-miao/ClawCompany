export interface ApiCallRecord {
  api: string;
  duration: number;
  timestamp: number;
  success: boolean;
}

export interface ApiStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  slowCallCount: number;
  fastCallCount: number;
}

export interface MemoryStats {
  currentUsage: number;
  averageUsage: number;
  peakUsage: number;
  currentPercentage: number;
  averagePercentage: number;
}

export interface PerformanceReport {
  totalApiCalls: number;
  averageResponseTime: number;
  successRate: number;
  memoryStats: MemoryStats;
  apiPerformance: Record<string, ApiStats>;
  timeRange: {
    start: number;
    end: number;
    duration: number;
  };
  timestamp: number;
}

export interface PerformanceMonitorOptions {
  maxRecordsPerApi?: number;
  maxMemoryRecords?: number;
}

export class PerformanceMonitor {
  private apiCalls: Map<string, ApiCallRecord[]> = new Map();
  private memoryRecords: Array<{ usage: number; percentage: number; timestamp: number }> = [];
  private slowThreshold: number = 1000;
  private maxMemoryRecords: number;
  private maxRecordsPerApi: number;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.maxRecordsPerApi = options.maxRecordsPerApi ?? 1000;
    this.maxMemoryRecords = options.maxMemoryRecords ?? 100;
  }

  /**
   * 记录API调用
   */
  recordApiCall(api: string, startTime: number, endTime: number, success: boolean = true): ApiCallRecord {
    const duration = endTime - startTime;
    const record: ApiCallRecord = {
      api,
      duration,
      timestamp: endTime,
      success
    };

    if (!this.apiCalls.has(api)) {
      this.apiCalls.set(api, []);
    }
    
    this.apiCalls.get(api)!.push(record);

    if (this.maxRecordsPerApi > 0) {
      const records = this.apiCalls.get(api)!;
      if (records.length > this.maxRecordsPerApi) {
        this.apiCalls.set(api, records.slice(-this.maxRecordsPerApi));
      }
    }
    
    return record;
  }

  /**
   * 设置慢速调用阈值
   */
  setSlowThreshold(thresholdMs: number): void {
    this.slowThreshold = thresholdMs;
  }

  getSlowThreshold(): number {
    return this.slowThreshold;
  }

  /**
   * 获取特定API的统计信息
   */
  getApiStats(api: string): ApiStats {
    const records = this.apiCalls.get(api) || [];
    
    if (records.length === 0) {
      return {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        successRate: 0,
        slowCallCount: 0,
        fastCallCount: 0
      };
    }

    const durations = records.map(r => r.duration);
    const successfulCalls = records.filter(r => r.success).length;
    const failedCalls = records.length - successfulCalls;
    const slowCallCount = records.filter(r => r.duration > this.slowThreshold).length;
    const fastCallCount = records.filter(r => r.duration <= this.slowThreshold).length;

    return {
      totalCalls: records.length,
      successfulCalls,
      failedCalls,
      averageResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minResponseTime: durations.reduce((a, b) => Math.min(a, b), Infinity),
      maxResponseTime: durations.reduce((a, b) => Math.max(a, b), -Infinity),
      successRate: Math.round((successfulCalls / records.length) * 100) / 100,
      slowCallCount,
      fastCallCount
    };
  }

  /**
   * 记录内存使用情况
   */
  recordMemoryUsage(usage: { used: number; total: number; percentage: number }): void {
    const memoryRecord = {
      usage: usage.used,
      percentage: usage.percentage,
      timestamp: Date.now()
    };

    this.memoryRecords.push(memoryRecord);

    // 保持记录数量在限制内
    if (this.memoryRecords.length > this.maxMemoryRecords) {
      this.memoryRecords = this.memoryRecords.slice(-this.maxMemoryRecords);
    }
  }

  /**
   * 获取内存统计信息
   */
  getMemoryStats(): MemoryStats {
    if (this.memoryRecords.length === 0) {
      return {
        currentUsage: 0,
        averageUsage: 0,
        peakUsage: 0,
        currentPercentage: 0,
        averagePercentage: 0
      };
    }

    const usages = this.memoryRecords.map(r => r.usage);
    const percentages = this.memoryRecords.map(r => r.percentage);
    const currentUsage = this.memoryRecords[this.memoryRecords.length - 1].usage;
    const currentPercentage = this.memoryRecords[this.memoryRecords.length - 1].percentage;

    return {
      currentUsage,
      averageUsage: Math.round(usages.reduce((a, b) => a + b, 0) / usages.length),
      peakUsage: usages.reduce((a, b) => Math.max(a, b), -Infinity),
      currentPercentage,
      averagePercentage: Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
    };
  }

  /**
   * 清理旧数据
   */
  cleanupOldData(maxAgeMs: number = 3600000): void {
    const cutoffTime = Date.now() - maxAgeMs;
    
    // 清理API调用记录
    for (const [api, records] of this.apiCalls) {
      const filteredRecords = records.filter(r => r.timestamp > cutoffTime);
      this.apiCalls.set(api, filteredRecords);
    }

    // 清理内存记录
    this.memoryRecords = this.memoryRecords.filter(r => r.timestamp > cutoffTime);
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): PerformanceReport {
    const allRecords = Array.from(this.apiCalls.values()).flat();
    const totalApiCalls = allRecords.length;
    
    // 计算总体平均响应时间
    const allDurations = allRecords.map(r => r.duration);
    const averageResponseTime = allRecords.length > 0 
      ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length) 
      : 0;

    // 计算总体成功率
    const successfulCalls = allRecords.filter(r => r.success).length;
    const successRate = totalApiCalls > 0 
      ? Math.round((successfulCalls / totalApiCalls) * 100) / 100 
      : 0;

    // 获取时间范围
    const timestamps = allRecords.map(r => r.timestamp);
    const startTime = timestamps.length > 0 ? timestamps.reduce((a, b) => Math.min(a, b), Infinity) : Date.now();
    const endTime = timestamps.length > 0 ? timestamps.reduce((a, b) => Math.max(a, b), -Infinity) : Date.now();

    // 生成API性能统计
    const apiPerformance: Record<string, ApiStats> = {};
    for (const api of this.apiCalls.keys()) {
      apiPerformance[api] = this.getApiStats(api);
    }

    return {
      totalApiCalls,
      averageResponseTime,
      successRate,
      memoryStats: this.getMemoryStats(),
      apiPerformance,
      timeRange: {
        start: startTime,
        end: endTime,
        duration: endTime - startTime
      },
      timestamp: Date.now()
    };
  }

  /**
   * 获取所有被监控的API列表
   */
  getMonitoredApis(): string[] {
    return Array.from(this.apiCalls.keys());
  }

  /**
   * 重置监控数据
   */
  reset(): void {
    this.apiCalls.clear();
    this.memoryRecords = [];
  }
}