import {
  PerformanceMonitor,
  MetricType,
  MetricEntry,
  TimerEntry,
  PerformanceSnapshot,
} from '../performance-monitor'

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  describe('counter metrics', () => {
    it('should increment a counter', () => {
      monitor.increment('requests')
      expect(monitor.getCounter('requests')).toBe(1)
    })

    it('should increment a counter by a custom value', () => {
      monitor.increment('bytes_sent', 1024)
      expect(monitor.getCounter('bytes_sent')).toBe(1024)
    })

    it('should accumulate counter increments', () => {
      monitor.increment('requests')
      monitor.increment('requests')
      monitor.increment('requests', 3)
      expect(monitor.getCounter('requests')).toBe(5)
    })

    it('should return 0 for non-existent counter', () => {
      expect(monitor.getCounter('unknown')).toBe(0)
    })
  })

  describe('gauge metrics', () => {
    it('should set a gauge value', () => {
      monitor.setGauge('active_connections', 42)
      expect(monitor.getGauge('active_connections')).toBe(42)
    })

    it('should overwrite gauge value', () => {
      monitor.setGauge('memory_mb', 100)
      monitor.setGauge('memory_mb', 200)
      expect(monitor.getGauge('memory_mb')).toBe(200)
    })

    it('should return undefined for non-existent gauge', () => {
      expect(monitor.getGauge('unknown')).toBeUndefined()
    })
  })

  describe('histogram metrics', () => {
    it('should record values in a histogram', () => {
      monitor.recordValue('response_time', 50)
      monitor.recordValue('response_time', 100)
      monitor.recordValue('response_time', 150)
      const stats = monitor.getHistogramStats('response_time')
      expect(stats).toBeDefined()
      expect(stats!.count).toBe(3)
      expect(stats!.min).toBe(50)
      expect(stats!.max).toBe(150)
      expect(stats!.avg).toBe(100)
    })

    it('should return undefined for non-existent histogram', () => {
      expect(monitor.getHistogramStats('unknown')).toBeUndefined()
    })

    it('should calculate percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        monitor.recordValue('latency', i)
      }
      const stats = monitor.getHistogramStats('latency')
      expect(stats!.p50).toBeGreaterThanOrEqual(45)
      expect(stats!.p50).toBeLessThanOrEqual(55)
      expect(stats!.p95).toBeGreaterThanOrEqual(90)
      expect(stats!.p99).toBeGreaterThanOrEqual(95)
    })
  })

  describe('timer metrics', () => {
    it('should measure elapsed time with start/stop', () => {
      const timerId = monitor.startTimer('db_query')
      const entry = monitor.stopTimer(timerId)
      expect(entry).toBeDefined()
      expect(entry!.name).toBe('db_query')
      expect(entry!.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should record completed timers as histogram entries', () => {
      const timerId = monitor.startTimer('api_call')
      monitor.stopTimer(timerId)
      const stats = monitor.getHistogramStats('api_call')
      expect(stats).toBeDefined()
      expect(stats!.count).toBe(1)
    })

    it('should return undefined for unknown timer ID', () => {
      const entry = monitor.stopTimer('nonexistent')
      expect(entry).toBeUndefined()
    })

    it('should track active timers', () => {
      const id1 = monitor.startTimer('task1')
      const id2 = monitor.startTimer('task2')
      expect(monitor.getActiveTimerCount()).toBe(2)
      monitor.stopTimer(id1)
      expect(monitor.getActiveTimerCount()).toBe(1)
      monitor.stopTimer(id2)
      expect(monitor.getActiveTimerCount()).toBe(0)
    })
  })

  describe('snapshot and reset', () => {
    it('should produce a full snapshot of all metrics', () => {
      monitor.increment('requests', 10)
      monitor.setGauge('cpu_percent', 75)
      monitor.recordValue('latency', 100)

      const snapshot = monitor.snapshot()
      expect(snapshot.counters).toEqual({ requests: 10 })
      expect(snapshot.gauges).toEqual({ cpu_percent: 75 })
      expect(snapshot.histograms.latency.count).toBe(1)
      expect(snapshot.activeTimers).toBe(0)
    })

    it('should reset all metrics', () => {
      monitor.increment('requests', 5)
      monitor.setGauge('memory', 100)
      monitor.recordValue('latency', 50)

      monitor.reset()

      expect(monitor.getCounter('requests')).toBe(0)
      expect(monitor.getGauge('memory')).toBeUndefined()
      expect(monitor.getHistogramStats('latency')).toBeUndefined()
    })

    it('should include timestamp in snapshot', () => {
      const snapshot = monitor.snapshot()
      expect(snapshot.timestamp).toBeDefined()
      expect(new Date(snapshot.timestamp).getTime()).not.toBeNaN()
    })
  })

  describe('metric entries with metadata', () => {
    it('should record metric entries with tags', () => {
      monitor.increment('requests', 1, { method: 'GET', path: '/api/users' })
      const entries = monitor.getMetricEntries('requests')
      expect(entries).toHaveLength(1)
      expect(entries[0].tags).toEqual({ method: 'GET', path: '/api/users' })
    })

    it('should record metric entries with timestamp', () => {
      monitor.recordValue('response_time', 42, { status: '200' })
      const entries = monitor.getMetricEntries('response_time')
      expect(entries[0].timestamp).toBeDefined()
      expect(entries[0].value).toBe(42)
    })
  })
})
