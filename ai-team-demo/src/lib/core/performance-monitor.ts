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
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
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
      entries.splice(0, entries.length - this.maxMetricEntries)
    }
    this.metricEntries.set(name, entries)
  }
}
