import { PerformanceMonitor, MetricEntry, MetricType, PerformanceSnapshot } from './performance-monitor'
import { ErrorTracker, ErrorSummary } from './error-tracker'
import { Logger } from './logger'

export interface PerformanceMetrics {
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }

  tasks: {
    total: number
    completed: number
    failed: number
    averageExecutionTime: number
    pending: number
    inProgress: number
  }

  errors: {
    total: number
    rate: number
    byCategory: Record<string, number>
  }

  performance: {
    averageResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
    throughput: number
  }

  health: {
    overall: 'healthy' | 'warning' | 'critical'
    uptime: number
    lastUpdated: Date
  }
}

export interface MetricsDataSource {
  getMetricEntries(): MetricEntry[]
}

export class MetricsAggregator {
  private perfMonitor: PerformanceMonitor
  private errorTracker: ErrorTracker
  private logger: Logger
  private metricsDataSource?: MetricsDataSource
  private lastMetrics: PerformanceMetrics | null = null
  private updateIntervalMs: number = 5000

  constructor(
    perfMonitor: PerformanceMonitor,
    errorTracker: ErrorTracker,
    logger: Logger,
    metricsDataSource?: MetricsDataSource
  ) {
    this.perfMonitor = perfMonitor
    this.errorTracker = errorTracker
    this.logger = logger
    this.metricsDataSource = metricsDataSource
  }

  private getAllMetricEntries(): MetricEntry[] {
    if (this.metricsDataSource) {
      return this.metricsDataSource.getMetricEntries()
    }
    const snapshot = this.perfMonitor.snapshot()
    const entries: MetricEntry[] = []
    for (const [name, value] of Object.entries(snapshot.counters)) {
      entries.push({ name, value, type: MetricType.COUNTER, timestamp: snapshot.timestamp })
    }
    return entries
  }

  getCurrentMetrics(): PerformanceMetrics {
    const performance = this.perfMonitor.snapshot()
    const errorSummary = this.errorTracker.getSummary()

    const memoryUsage = this.getMemoryUsage()
    const tasks = this.calculateTaskMetrics()
    const errors = this.calculateErrorMetrics(errorSummary)
    const perf = this.calculatePerformanceMetrics(performance)
    const health = this.assessHealth(tasks, errors, perf, memoryUsage)

    const metrics: PerformanceMetrics = {
      memoryUsage,
      tasks,
      errors,
      performance: perf,
      health
    }

    this.lastMetrics = metrics
    this.logger.info('Performance metrics updated', { metrics })

    return metrics
  }

  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    const mem = process.memoryUsage()
    const used = Math.round(mem.heapUsed / 1024 / 1024)
    const total = Math.round(mem.heapTotal / 1024 / 1024)
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0

    return { used, total, percentage }
  }

  private calculateTaskMetrics(): PerformanceMetrics['tasks'] {
    const metricEntries = this.getAllMetricEntries()

    const taskMetrics = {
      total: metricEntries.filter((e: MetricEntry) => e.name.startsWith('task')).length,
      completed: metricEntries.filter((e: MetricEntry) => e.name === 'task.completed').length,
      failed: metricEntries.filter((e: MetricEntry) => e.name === 'task.failed').length,
      pending: metricEntries.filter((e: MetricEntry) => e.name === 'task.pending').length,
      inProgress: metricEntries.filter((e: MetricEntry) => e.name === 'task.in_progress').length,
    }

    const executionTimes = metricEntries
      .filter((e: MetricEntry) => e.name === 'task.duration')
      .map((e: MetricEntry) => e.value)

    const averageExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((sum: number, time: number) => sum + time, 0) / executionTimes.length
      : 0

    return {
      ...taskMetrics,
      averageExecutionTime: Math.round(averageExecutionTime)
    }
  }

  private calculateErrorMetrics(errorSummary: ErrorSummary): PerformanceMetrics['errors'] {
    const errorsByCategory: Record<string, number> = {}

    if (errorSummary.byCategory) {
      Object.entries(errorSummary.byCategory).forEach(([category, count]) => {
        if (count !== undefined) {
          errorsByCategory[category] = count
        }
      })
    }

    const totalErrors = errorSummary.total || 0
    const metricEntries = this.getAllMetricEntries()
    const totalTasks = metricEntries.filter((e: MetricEntry) => e.name.startsWith('task')).length
    const errorRate = totalTasks > 0 ? (totalErrors / totalTasks) * 100 : 0

    return {
      total: totalErrors,
      rate: Math.round(errorRate * 100) / 100,
      byCategory: errorsByCategory
    }
  }

  private calculatePerformanceMetrics(_performance: PerformanceSnapshot): PerformanceMetrics['performance'] {
    const metricEntries = this.getAllMetricEntries()
    const responseTimes = metricEntries
      .filter((e: MetricEntry) => e.name.startsWith('response.time'))
      .map((e: MetricEntry) => e.value)
      .sort((a: number, b: number) => a - b)

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum: number, time: number) => sum + time, 0) / responseTimes.length
      : 0

    const p95 = this.calculatePercentile(responseTimes, 95)
    const p99 = this.calculatePercentile(responseTimes, 99)

    const completedTasks = metricEntries
      .filter((e: MetricEntry) => e.name === 'task.completed')
      .length
    const throughput = completedTasks > 0 ? (completedTasks / 10) : 0

    return {
      averageResponseTime: Math.round(averageResponseTime),
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      throughput: Math.round(throughput * 100) / 100
    }
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0
    
    const index = Math.ceil((percentile / 100) * values.length) - 1
    return values[Math.max(0, Math.min(index, values.length - 1))]
  }
  
  private assessHealth(
    tasks: PerformanceMetrics['tasks'],
    errors: PerformanceMetrics['errors'],
    performance: PerformanceMetrics['performance'],
    memoryUsage?: PerformanceMetrics['memoryUsage']
  ): PerformanceMetrics['health'] {
    let criticalIssues = 0
    let warningIssues = 0

    if (errors.rate > 10) criticalIssues++
    else if (errors.rate > 5) warningIssues++

    if (performance.averageResponseTime > 5000) criticalIssues++
    else if (performance.averageResponseTime > 2000) warningIssues++

    if (tasks.total > 0 && (tasks.failed / tasks.total) > 0.2) criticalIssues++
    else if (tasks.total > 0 && (tasks.failed / tasks.total) > 0.1) warningIssues++

    if (memoryUsage) {
      if (memoryUsage.percentage > 90) criticalIssues++
      else if (memoryUsage.percentage > 75) warningIssues++
    }
    
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (criticalIssues > 0) overall = 'critical'
    else if (warningIssues > 0) overall = 'warning'
    
    return {
      overall,
      uptime: process.uptime(), // 进程运行时间
      lastUpdated: new Date()
    }
  }
  
  startPeriodicUpdate(callback: (metrics: PerformanceMetrics) => void): (() => void) | void {
    const update = () => {
      const metrics = this.getCurrentMetrics()
      callback(metrics)
    }
    
    // 立即更新一次
    update()
    
    // 设置定时更新
    const intervalId = setInterval(update, this.updateIntervalMs)
    
    this.logger.info('Periodic metrics update started', { intervalMs: this.updateIntervalMs })
    
    // 返回清理函数
    return () => {
      clearInterval(intervalId)
      this.logger.info('Periodic metrics update stopped')
    }
  }
}