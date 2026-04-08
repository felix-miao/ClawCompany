export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

export interface MetricEntry {
  name: string
  value: number
  type: MetricType
  timestamp: string
  tags?: Record<string, string>
}

export interface TimerEntry {
  name: string
  durationMs: number
  timestamp: string
}

export interface HistogramStats {
  count: number
  min: number
  max: number
  avg: number
  sum: number
  p50: number
  p95: number
  p99: number
}

export interface PerformanceSnapshot {
  timestamp: string
  counters: Record<string, number>
  gauges: Record<string, number | undefined>
  histograms: Record<string, HistogramStats>
  activeTimers: number
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  
  const pos = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  
  if (lower === upper) {
    return sorted[lower]
  }
  
  // 线性插值
  return sorted[lower] + (pos - lower) * (sorted[upper] - sorted[lower])
}

const DEFAULT_MAX_HISTOGRAM_VALUES = 10000
const DEFAULT_MAX_METRIC_ENTRIES = 1000
const DEFAULT_MAX_TIMER_AGE_MS = 30 * 60 * 1000

export class PerformanceMonitor {
  private counters: Map<string, number> = new Map()
  private gauges: Map<string, number> = new Map()
  private histograms: Map<string, number[]> = new Map()
  private activeTimers: Map<string, { name: string; start: number }> = new Map()
  private metricEntries: Map<string, MetricEntry[]> = new Map()
  private timerCounter = 0
  private maxHistogramValues: number
  private maxMetricEntries: number
  private maxTimerAgeMs: number
  
  // 新增：性能警告历史
  private alertHistory: Array<{
    timestamp: string
    type: string
    metric: string
    value: number
    threshold: number
  }> = []

  constructor(options?: {
    maxHistogramValues?: number
    maxMetricEntries?: number
    maxTimerAgeMs?: number
  }) {
    this.maxHistogramValues = options?.maxHistogramValues ?? DEFAULT_MAX_HISTOGRAM_VALUES
    this.maxMetricEntries = options?.maxMetricEntries ?? DEFAULT_MAX_METRIC_ENTRIES
    this.maxTimerAgeMs = options?.maxTimerAgeMs ?? DEFAULT_MAX_TIMER_AGE_MS
  }

  increment(name: string, value = 1, tags?: Record<string, string>): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value)
    this.addMetricEntry(name, value, MetricType.COUNTER, tags)
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value)
  }

  getGauge(name: string): number | undefined {
    return this.gauges.get(name)
  }

  recordValue(name: string, value: number, tags?: Record<string, string>): void {
    const values = this.histograms.get(name) ?? []
    values.push(value)
    if (values.length > this.maxHistogramValues) {
      values.splice(0, values.length - this.maxHistogramValues)
    }
    this.histograms.set(name, values)
    this.addMetricEntry(name, value, MetricType.HISTOGRAM, tags)
  }

  getHistogramStats(name: string): HistogramStats | undefined {
    const values = this.histograms.get(name)
    if (!values || values.length === 0) return undefined

    const sorted = [...values].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      sum,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    }
  }

  startTimer(name: string): string {
    const id = `timer_${this.timerCounter++}`
    this.activeTimers.set(id, { name, start: performance.now() })
    return id
  }

  stopTimer(timerId: string): TimerEntry | undefined {
    const timer = this.activeTimers.get(timerId)
    if (!timer) return undefined

    this.activeTimers.delete(timerId)
    const durationMs = performance.now() - timer.start
    const entry: TimerEntry = {
      name: timer.name,
      durationMs,
      timestamp: new Date().toISOString(),
    }

    this.recordValue(timer.name, durationMs)
    return entry
  }

  getActiveTimerCount(): number {
    return this.activeTimers.size
  }

  cleanupStaleTimers(): number {
    const now = performance.now()
    let removed = 0
    for (const [id, timer] of this.activeTimers) {
      if (now - timer.start > this.maxTimerAgeMs) {
        this.activeTimers.delete(id)
        removed++
      }
    }
    return removed
  }

  getMetricEntries(name: string): MetricEntry[] {
    return this.metricEntries.get(name) ?? []
  }

  snapshot(): PerformanceSnapshot {
    const histograms: Record<string, HistogramStats> = {}
    for (const name of this.histograms.keys()) {
      const stats = this.getHistogramStats(name)
      if (stats) histograms[name] = stats
    }

    const counters: Record<string, number> = {}
    for (const [k, v] of this.counters) {
      counters[k] = v
    }

    const gauges: Record<string, number | undefined> = {}
    for (const [k, v] of this.gauges) {
      gauges[k] = v
    }

    return {
      timestamp: new Date().toISOString(),
      counters,
      gauges,
      histograms,
      activeTimers: this.activeTimers.size,
    }
  }

  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
    this.activeTimers.clear()
    this.metricEntries.clear()
  }

  /**
   * 批量清理过期的指标数据，优化内存使用
   * @returns 清理的指标数量
   */
  cleanupExpiredMetrics(): number {
    let cleanedCount = 0
    
    // 清理histograms中的旧数据
    for (const [name, values] of this.histograms) {
      if (values.length > this.maxHistogramValues) {
        const oldSize = values.length
        values.splice(0, oldSize - this.maxHistogramValues)
        cleanedCount += oldSize - values.length
      }
    }
    
    // 清理metric entries中的旧数据
    for (const [name, entries] of this.metricEntries) {
      if (entries.length > this.maxMetricEntries) {
        const oldSize = entries.length
        entries.splice(0, oldSize - this.maxMetricEntries)
        cleanedCount += oldSize - entries.length
      }
    }
    
    return cleanedCount
  }

  private addMetricEntry(name: string, value: number, type: MetricType, tags?: Record<string, string>): void {
    const entries = this.metricEntries.get(name) ?? []
    entries.push({
      name,
      value,
      type,
      timestamp: new Date().toISOString(),
      tags,
    })
    if (entries.length > this.maxMetricEntries) {
      // 更高效的清理：直接截取数组尾部，避免重新分配
      entries.splice(0, entries.length - this.maxMetricEntries)
    }
    this.metricEntries.set(name, entries)
  }

  /**
   * 批量记录指标，提高效率
   */
  recordBatch(batchData: Array<{
    name: string
    value: number
    type: MetricType
    tags?: Record<string, string>
  }>): void {
    batchData.forEach(item => {
      switch (item.type) {
        case MetricType.COUNTER:
          this.increment(item.name, item.value, item.tags)
          break
        case MetricType.GAUGE:
          this.setGauge(item.name, item.value)
          break
        case MetricType.HISTOGRAM:
          this.recordValue(item.name, item.value, item.tags)
          break
        default:
          // 对于未知的类型，默认作为histogram记录
          this.recordValue(item.name, item.value, item.tags)
      }
    })
  }

  /**
   * 导出指标数据到指定格式
   * @param format 导出格式: 'json', 'csv', 'prometheus'
   */
  exportMetrics(format: 'json' | 'csv' | 'prometheus'): string {
    const snapshot = this.snapshot()
    
    switch (format) {
      case 'json':
        return JSON.stringify(snapshot, null, 2)
      
      case 'csv':
        return this.exportToCSV(snapshot)
      
      case 'prometheus':
        return this.exportToPrometheus(snapshot)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * 检查性能警告
   * @param thresholds 性能阈值配置
   */
  checkPerformanceAlerts(thresholds: {
    cpuThreshold?: number
    memoryThreshold?: number
    responseTimeThreshold?: number
    errorRateThreshold?: number
  }): Array<{
    type: string
    metric: string
    value: number
    threshold: number
    timestamp: string
  }> {
    const alerts: Array<{
      type: string
      metric: string
      value: number
      threshold: number
      timestamp: string
    }> = []

    const snapshot = this.snapshot()
    const now = new Date().toISOString()

    // 检查CPU使用率
    if (thresholds.cpuThreshold && snapshot.gauges.cpu_usage) {
      const cpuValue = snapshot.gauges.cpu_usage
      if (cpuValue > thresholds.cpuThreshold) {
        alerts.push({
          type: 'high_cpu',
          metric: 'cpu_usage',
          value: cpuValue,
          threshold: thresholds.cpuThreshold,
          timestamp: now,
        })
      }
    }

    // 检查内存使用率
    if (thresholds.memoryThreshold && snapshot.gauges.memory_usage) {
      const memoryValue = snapshot.gauges.memory_usage
      if (memoryValue > thresholds.memoryThreshold) {
        alerts.push({
          type: 'high_memory',
          metric: 'memory_usage',
          value: memoryValue,
          threshold: thresholds.memoryThreshold,
          timestamp: now,
        })
      }
    }

    // 检查响应时间
    if (thresholds.responseTimeThreshold && snapshot.histograms.response_times) {
      const respTimeStats = snapshot.histograms.response_times
      if (respTimeStats.p95 > thresholds.responseTimeThreshold) {
        alerts.push({
          type: 'high_response_time',
          metric: 'response_times',
          value: respTimeStats.p95,
          threshold: thresholds.responseTimeThreshold,
          timestamp: now,
        })
      }
    }

    // 检查错误率
    if (thresholds.errorRateThreshold) {
      const totalRequests = snapshot.counters.total_requests || 0
      const errorRequests = snapshot.counters.error_requests || 0
      if (totalRequests > 0) {
        const errorRate = errorRequests / totalRequests
        if (errorRate > thresholds.errorRateThreshold) {
          alerts.push({
            type: 'high_error_rate',
            metric: 'error_rate',
            value: errorRate,
            threshold: thresholds.errorRateThreshold,
            timestamp: now,
          })
        }
      }
    }

    // 保存警告历史
    alerts.forEach(alert => {
      this.alertHistory.push(alert)
    })

    return alerts
  }

  /**
   * 获取警告历史
   */
  getAlertHistory(): Array<{
    timestamp: string
    type: string
    metric: string
    value: number
    threshold: number
  }> {
    return [...this.alertHistory]
  }

  /**
   * 清理过期的警告历史
   * @param maxAgeDays 最大保留天数
   */
  cleanupAlertHistory(maxAgeDays: number = 7): number {
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000)
    let removed = 0

    this.alertHistory = this.alertHistory.filter(alert => {
      const alertTime = new Date(alert.timestamp).getTime()
      if (alertTime < cutoffTime) {
        removed++
        return false
      }
      return true
    })

    return removed
  }

  /**
   * CSV格式导出
   */
  private exportToCSV(snapshot: PerformanceSnapshot): string {
    const lines: string[] = ['name,value,type,timestamp']
    
    // Counters
    Object.entries(snapshot.counters).forEach(([name, value]) => {
      lines.push(`${name},${value},counter,${snapshot.timestamp}`)
    })
    
    // Gauges
    Object.entries(snapshot.gauges).forEach(([name, value]) => {
      if (value !== undefined) {
        lines.push(`${name},${value},gauge,${snapshot.timestamp}`)
      }
    })
    
    // Histograms (只导出统计数据)
    Object.entries(snapshot.histograms).forEach(([name, stats]) => {
      lines.push(`${name},${stats.count},histogram_count,${snapshot.timestamp}`)
      lines.push(`${name},${stats.avg},histogram_avg,${snapshot.timestamp}`)
      lines.push(`${name},${stats.p95},histogram_p95,${snapshot.timestamp}`)
    })
    
    return lines.join('\n')
  }

  /**
   * Prometheus格式导出
   */
  private exportToPrometheus(snapshot: PerformanceSnapshot): string {
    let output = ''
    
    // Counters
    Object.entries(snapshot.counters).forEach(([name, value]) => {
      output += `# HELP ${name} Total count\n`
      output += `# TYPE ${name} counter\n`
      output += `${name} ${value}\n`
    })
    
    // Gauges
    Object.entries(snapshot.gauges).forEach(([name, value]) => {
      if (value !== undefined) {
        output += `# HELP ${name} Current value\n`
        output += `# TYPE ${name} gauge\n`
        output += `${name} ${value}\n`
      }
    })
    
    // Histograms
    Object.entries(snapshot.histograms).forEach(([name, stats]) => {
      output += `# HELP ${name} Request duration histogram\n`
      output += `# TYPE ${name} histogram\n`
      output += `${name}_count ${stats.count}\n`
      output += `${name}_sum ${stats.sum}\n`
      output += `${name}_bucket{le="0.1"} 0\n`
      output += `${name}_bucket{le="0.5"} ${stats.p50}\n`
      output += `${name}_bucket{le="1.0"} ${stats.p95}\n`
      output += `${name}_bucket{le="+Inf"} ${stats.count}\n`
    })
    
    return output
  }
}
