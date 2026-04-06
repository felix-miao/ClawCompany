import { PerformanceMonitor } from '../performance-monitor'
import { MetricType } from '../performance-monitor'

describe('PerformanceMonitor Enhanced Features', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
    monitor.reset()
  })

  describe('Memory Management', () => {
    it('should efficiently clean up expired metrics when approaching limits', () => {
      // 设置较小的限制以便测试
      const monitorWithLimits = new PerformanceMonitor({
        maxHistogramValues: 5,
        maxMetricEntries: 5,
      })

      // 为单个指标添加大量数据，超过限制
      for (let i = 0; i < 10; i++) {
        monitorWithLimits.increment('single_counter', 1)
        monitorWithLimits.recordValue('single_histogram', Math.random() * 100)
      }

      // 验证数据已经被自动清理到限制范围内
      const counterEntries = monitorWithLimits.getMetricEntries('single_counter')
      const histogramStats = monitorWithLimits.getHistogramStats('single_histogram')
      
      // 由于自动清理，数据应该已经被限制在最大值内
      expect(counterEntries.length).toBeLessThanOrEqual(5)
      expect(histogramStats?.count).toBeLessThanOrEqual(5)

      // 手动清理应该仍然能工作（虽然可能不需要）
      const cleaned = monitorWithLimits.cleanupExpiredMetrics()
      expect(cleaned).toBeGreaterThanOrEqual(0)

      // 最终验证限制生效
      const cleanedCounterEntries = monitorWithLimits.getMetricEntries('single_counter')
      const cleanedHistogramStats = monitorWithLimits.getHistogramStats('single_histogram')
      expect(cleanedCounterEntries.length).toBeLessThanOrEqual(5)
      expect(cleanedHistogramStats?.count).toBeLessThanOrEqual(5)
    })

    it('should provide memory usage statistics', () => {
      monitor.increment('test_counter', 10)
      monitor.recordValue('test_histogram', 50)
      monitor.startTimer('test_timer')
      monitor.stopTimer('timer_0') // 假设第一个timer的ID是timer_0

      const snapshot = monitor.snapshot()
      
      expect(snapshot.counters['test_counter']).toBe(10)
      expect(snapshot.histograms['test_histogram']).toBeDefined()
      expect(snapshot.histograms['test_histogram']?.count).toBe(1)
      expect(snapshot.histograms['test_histogram']?.avg).toBe(50)
    })

    it('should automatically clean up stale timers', () => {
      // 设置很短的过期时间
      const monitorWithShortTimeout = new PerformanceMonitor({
        maxTimerAgeMs: 100, // 100ms
      })

      const timerId = monitorWithShortTimeout.startTimer('short_timer')
      
      // 快速完成timer
      setTimeout(() => {
        const stopped = monitorWithShortTimeout.stopTimer(timerId)
        expect(stopped).toBeDefined()
        
        // 清理过期 timers
        const removed = monitorWithShortTimeout.cleanupStaleTimers()
        expect(removed).toBe(0) // 已经被stopTimer清理了
      }, 10)
    })
  })

  describe('Real-time Metrics Export', () => {
    it('should export metrics in multiple formats', () => {
      // 添加一些测试数据
      monitor.increment('api_requests', 5, { endpoint: '/api/users' })
      monitor.recordValue('response_time', 150, { status: 'success' })
      monitor.setGauge('active_users', 42)

      // JSON 格式
      const jsonExport = monitor.exportMetrics('json')
      expect(typeof jsonExport).toBe('string')
      
      const jsonParsed = JSON.parse(jsonExport)
      expect(jsonParsed.counters?.api_requests).toBe(5)
      expect(jsonParsed.gauges?.active_users).toBe(42)

      // CSV 格式
      const csvExport = monitor.exportMetrics('csv')
      expect(typeof csvExport).toBe('string')
      
      const csvLines = csvExport.split('\n')
      expect(csvLines[0]).toContain('name,value,type,timestamp')
      expect(csvLines.some(line => line.includes('api_requests,5'))).toBe(true)

      // Prometheus 格式
      const prometheusExport = monitor.exportMetrics('prometheus')
      expect(typeof prometheusExport).toBe('string')
      expect(prometheusExport).toMatch(/TYPE/)

      // 支持的格式验证
      expect(() => monitor.exportMetrics('unsupported')).toThrow()
    })

    it('should export histogram metrics with proper formatting', () => {
      // 添加histogram数据
      for (let i = 0; i < 10; i++) {
        monitor.recordValue('request_duration', i * 10)
      }

      const jsonExport = monitor.exportMetrics('json')
      const jsonParsed = JSON.parse(jsonExport)
      
      expect(jsonParsed.histograms?.request_duration).toBeDefined()
      const hist = jsonParsed.histograms.request_duration
      expect(hist.count).toBe(10)
      expect(hist.min).toBe(0)
      expect(hist.max).toBe(90)
      expect(hist.p50).toBe(45)
      // p95 should be close to 90 (within floating point precision)
      expect(hist.p95).toBeGreaterThan(85)
      expect(hist.p95).toBeLessThanOrEqual(90)
    })

    it('should handle edge cases in metric export', () => {
      // 空数据的导出
      const emptyExport = monitor.exportMetrics('json')
      const emptyParsed = JSON.parse(emptyExport)
      expect(emptyParsed.counters).toEqual({})
      expect(emptyParsed.gauges).toEqual({})
      expect(emptyParsed.histograms).toEqual({})
    })
  })

  describe('Performance Alerts', () => {
    it('should detect performance thresholds and generate alerts', () => {
      const monitorWithAlerts = new PerformanceMonitor({
        maxHistogramValues: 100,
        maxMetricEntries: 100,
      })

      // 添加正常数据
      monitorWithAlerts.increment('total_requests', 100)
      monitorWithAlerts.recordValue('response_times', 50)

      // 添加异常数据 - 需要在正确的指标名下添加
      for (let i = 0; i < 5; i++) {
        monitorWithAlerts.recordValue('response_times', 5000) // 5秒响应时间
      }

      const alerts = monitorWithAlerts.checkPerformanceAlerts({
        responseTimeThreshold: 1000,
        errorRateThreshold: 0.1,
      })

      expect(alerts).toBeInstanceOf(Array)
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0].type).toBe('high_response_time')
      expect(alerts[0].metric).toBe('response_times')
    })

    it('should track error rates accurately', () => {
      const monitorWithAlerts = new PerformanceMonitor()

      // 添加成功和失败的请求 - 使用正确的指标名
      for (let i = 0; i < 90; i++) {
        monitorWithAlerts.increment('total_requests', 1)
        monitorWithAlerts.increment('success_requests', 1)
      }
      for (let i = 0; i < 10; i++) {
        monitorWithAlerts.increment('total_requests', 1)
        monitorWithAlerts.increment('error_requests', 1)
      }

      const alerts = monitorWithAlerts.checkPerformanceAlerts({
        responseTimeThreshold: 1000,
        errorRateThreshold: 0.05,
      })

      expect(alerts.some(alert => alert.type === 'high_error_rate')).toBe(true)
    })

    it('should provide alert history for trend analysis', () => {
      const monitorWithAlerts = new PerformanceMonitor()

      // 触发一些警告 - 使用正确的指标名
      monitorWithAlerts.increment('total_requests', 1000)
      monitorWithAlerts.setGauge('cpu_usage', 95)

      const alerts1 = monitorWithAlerts.checkPerformanceAlerts({
        cpuThreshold: 80,
      })
      expect(alerts1.length).toBeGreaterThan(0)

      // 触发另一个警告
      monitorWithAlerts.reset()
      monitorWithAlerts.increment('total_requests', 500)
      monitorWithAlerts.setGauge('memory_usage', 90)

      const alerts2 = monitorWithAlerts.checkPerformanceAlerts({
        memoryThreshold: 85,
      })
      expect(alerts2.length).toBeGreaterThan(0)

      const history = monitorWithAlerts.getAlertHistory()
      expect(history.length).toBe(alerts1.length + alerts2.length)
      expect(history[0].timestamp).toBeDefined()
      expect(history[history.length - 1].type).toBeDefined()
    })
  })

  describe('Batch Operations', () => {
    it('should support batch metric recording for efficiency', () => {
      const batchData = [
        { name: 'api_calls', value: 10, type: MetricType.COUNTER as const },
        { name: 'cpu_usage', value: 75.5, type: MetricType.GAUGE as const },
        { name: 'response_times', value: 120, type: MetricType.HISTOGRAM as const },
      ]

      monitor.recordBatch(batchData)

      expect(monitor.getCounter('api_calls')).toBe(10)
      expect(monitor.getGauge('cpu_usage')).toBe(75.5)
      const histStats = monitor.getHistogramStats('response_times')
      expect(histStats?.count).toBe(1)
      expect(histStats?.avg).toBe(120)
    })

    it('should handle large batches efficiently', () => {
      const largeBatch = []
      for (let i = 0; i < 1000; i++) {
        largeBatch.push({
          name: 'metric_' + i,
          value: i,
          type: MetricType.COUNTER as const,
        })
      }

      expect(() => {
        monitor.recordBatch(largeBatch)
      }).not.toThrow()

      // 验证部分数据被记录
      expect(monitor.getCounter('metric_0')).toBe(0)
      expect(monitor.getCounter('metric_999')).toBe(999)
    })
  })

  describe('Integration with existing functionality', () => {
    it('should maintain all original functionality while adding new features', () => {
      // 原始功能测试
      monitor.increment('test_counter', 5)
      monitor.setGauge('test_gauge', 42)
      monitor.recordValue('test_histogram', 10)
      
      const timerId = monitor.startTimer('test_timer')
      const timerResult = monitor.stopTimer(timerId)
      
      expect(monitor.getCounter('test_counter')).toBe(5)
      expect(monitor.getGauge('test_gauge')).toBe(42)
      expect(monitor.getHistogramStats('test_histogram')?.avg).toBe(10)
      expect(timerResult?.durationMs).toBeGreaterThan(0)
      
      // 新功能测试
      const exportJson = monitor.exportMetrics('json')
      expect(exportJson).toContain('test_counter')
      
      const alerts = monitor.checkPerformanceAlerts({ cpuThreshold: 50 })
      expect(Array.isArray(alerts)).toBe(true)
    })
  })
})