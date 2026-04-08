import { PerformanceMonitor } from './performance-monitor';

export class ApiPerformanceMonitor {
  private performanceMonitor: PerformanceMonitor;
  private categoryThresholds: Map<string, number> = new Map();

  constructor(performanceMonitor: PerformanceMonitor) {
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * 监控API调用 - 返回包装函数
   */
  monitorApiCall<T>(
    apiName: string,
    apiCall: () => Promise<T>
  ): () => Promise<T> {
    return async () => {
      const startTime = Date.now();
      let result: T;
      let success = false;

      try {
        result = await apiCall();
        success = true;
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const endTime = Date.now();
        this.performanceMonitor.recordApiCall(apiName, startTime, endTime, success);
      }
    };
  }

  /**
   * 监控API调用 - 同步版本，返回包装函数
   */
  monitorApiCallSync<T>(
    apiName: string,
    apiCall: () => T
  ): () => T {
    return () => {
      const startTime = Date.now();
      let result: T;
      let success = false;

      try {
        result = apiCall();
        success = true;
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const endTime = Date.now();
        this.performanceMonitor.recordApiCall(apiName, startTime, endTime, success);
      }
    };
  }

  /**
   * 监控LLM调用 - 返回包装函数
   */
  monitorLlmCall(
    model: string,
    llmCall: (prompt: string) => Promise<string>
  ): (prompt: string) => Promise<string> {
    return async (prompt: string) => {
      const startTime = Date.now();
      let result: string;
      let success = false;

      try {
        result = await llmCall(prompt);
        success = true;
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const endTime = Date.now();
        this.performanceMonitor.recordApiCall(`llm-${model}`, startTime, endTime, success);
      }
    };
  }

  /**
   * 监控Agent调用 - 返回包装函数
   */
  monitorAgentCall<T>(
    agentType: string,
    agentCall: (task: string) => Promise<T>
  ): (task: string) => Promise<T> {
    return async (task: string) => {
      const startTime = Date.now();
      let result: T;
      let success = false;

      try {
        result = await agentCall(task);
        success = true;
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const endTime = Date.now();
        this.performanceMonitor.recordApiCall(`agent-${agentType}`, startTime, endTime, success);
      }
    };
  }

  /**
   * 监控Dev Agent调用
   */
  monitorDevAgent(
    devCall: (task: string) => Promise<string>
  ): (task: string) => Promise<string> {
    return this.monitorAgentCall('dev', devCall);
  }

  /**
   * 监控Reviewer Agent调用
   */
  monitorReviewerAgent(
    reviewCall: (code: string) => Promise<{ review: string; suggestions: string[] }>
  ): (code: string) => Promise<{ review: string; suggestions: string[] }> {
    return this.monitorAgentCall('reviewer', reviewCall);
  }

  /**
   * 监控PM Agent调用
   */
  monitorPmAgent(
    pmCall: (request: string) => Promise<{ tasks: string[]; timeline: string[] }>
  ): (request: string) => Promise<{ tasks: string[]; timeline: string[] }> {
    return this.monitorAgentCall('pm', pmCall);
  }

  /**
   * 批量监控API调用
   */
  async monitorBatchCalls<T>(
    batchName: string,
    calls: Array<() => Promise<T>>
  ): Promise<(T | undefined)[]> {
    const results: (T | undefined)[] = [];
    
    for (let i = 0; i < calls.length; i++) {
      try {
        const wrappedCall = this.monitorApiCall(`${batchName}-${i}`, calls[i]);
        const result = await wrappedCall();
        results.push(result);
      } catch (_error) {
        results.push(undefined);
      }
    }
    
    return results;
  }

  /**
   * 监控数据库查询
   */
  monitorDbQuery<T>(
    queryType: string,
    dbCall: () => Promise<T>
  ): () => Promise<T> {
    return this.monitorApiCall(`db-${queryType}`, dbCall);
  }

  /**
   * 监控文件系统操作
   */
  monitorFsOperation<T>(
    operation: string,
    fsCall: () => Promise<T>
  ): () => Promise<T> {
    return this.monitorApiCall(`fs-${operation}`, fsCall);
  }

  /**
   * 设置慢速调用阈值
   */
  setApiSlowThreshold(thresholdMs: number): void {
    this.categoryThresholds.set('api', thresholdMs);
  }

  setLlmSlowThreshold(thresholdMs: number): void {
    this.categoryThresholds.set('llm', thresholdMs);
  }

  setAgentSlowThreshold(thresholdMs: number): void {
    this.categoryThresholds.set('agent', thresholdMs);
  }

  setDbSlowThreshold(thresholdMs: number): void {
    this.categoryThresholds.set('db', thresholdMs);
  }

  setFsSlowThreshold(thresholdMs: number): void {
    this.categoryThresholds.set('fs', thresholdMs);
  }

  getCategoryThreshold(category: string): number | undefined {
    return this.categoryThresholds.get(category);
  }

  private detectCategory(apiName: string): string | undefined {
    if (apiName.startsWith('llm-')) return 'llm';
    if (apiName.startsWith('agent-')) return 'agent';
    if (apiName.startsWith('db-')) return 'db';
    if (apiName.startsWith('fs-')) return 'fs';
    return 'api';
  }

  getApiStats(apiName: string) {
    const category = this.detectCategory(apiName);
    const categoryThreshold = category ? this.categoryThresholds.get(category) : undefined;

    if (categoryThreshold !== undefined) {
      const saved = this.performanceMonitor.getSlowThreshold();
      this.performanceMonitor.setSlowThreshold(categoryThreshold);
      const stats = this.performanceMonitor.getApiStats(apiName);
      this.performanceMonitor.setSlowThreshold(saved);
      return stats;
    }
    return this.performanceMonitor.getApiStats(apiName);
  }

  getAllApiStats() {
    const stats: Record<string, unknown> = {};
    for (const api of this.performanceMonitor.getMonitoredApis()) {
      stats[api] = this.getApiStats(api);
    }
    return stats;
  }

  getPerformanceReport() {
    return this.performanceMonitor.generatePerformanceReport();
  }

  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }
}