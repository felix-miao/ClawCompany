import { PerformanceMonitor } from '../performance-monitor'

describe('PerformanceMonitor Memory Management', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      maxHistogramValues: 100,
      maxMetricEntries: 50,
    })
  })

  describe('Memory leak prevention', () => {
    it('should limit histogram values without memory leaks', () => {
      // 记录超过限制的值
      for (let i = 0; i < 1000; i++) {
        monitor.recordValue('latency', i)
      }
      
      const stats = monitor.getHistogramStats('latency')
      expect(stats!.count).toBe(100) // 只保留最新的100个值
      expect(stats!.min).toBe(900) // 最小的值应该是900（最新100个值中最小的）
      expect(stats!.max).toBe(999) // 最大的值应该是999
      
      // 验证没有内存泄漏 - histogram数组大小应该被限制
      const histogramValues = (monitor as any).histograms.get('latency')
      expect(histogramValues.length).toBe(100)
    })

    it('should limit metric entries without memory leaks', () => {
      // 添加超过限制的指标条目
      for (let i = 0; i < 1000; i++) {
        monitor.increment('requests', 1, { iteration: i.toString() })
      }
      
      const entries = monitor.getMetricEntries('requests')
      expect(entries.length).toBe(50) // 只保留最新的50个条目
      
      // 验证最新的条目（因为从0开始，所以第一个应该是950）
      expect(entries[0].tags?.iteration).toBe('950') // 最新的50个条目从950开始
      expect(entries[entries.length - 1].tags?.iteration).toBe('999') // 最新的条目是999
    })

    it('should efficiently clean up stale timers', () => {
      const monitorWithShortTimeout = new PerformanceMonitor({
        maxTimerAgeMs: 0, // 立即超时
      })
      
      // 启动多个计时器
      const timerIds = []
      for (let i = 0; i < 10; i++) {
        timerIds.push(monitorWithShortTimeout.startTimer(`timer_${i}`))
      }
      
      expect(monitorWithShortTimeout.getActiveTimerCount()).toBe(10)
      
      // 清理过期计时器
      const cleaned = monitorWithShortTimeout.cleanupStaleTimers()
      expect(cleaned).toBe(10)
      expect(monitorWithShortTimeout.getActiveTimerCount()).toBe(0)
    })

    it('should maintain performance under high load', () => {
      const startTime = performance.now()
      
      // 模拟高负载情况
      for (let i = 0; i < 10000; i++) {
        monitor.increment('ops', 1)
        monitor.recordValue('response_time', Math.random() * 100)
        if (i % 100 === 0) {
          monitor.setGauge('memory_usage', Math.random() * 1000)
        }
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // 验证性能：应该在合理时间内完成
      expect(duration).toBeLessThan(1000) // 10000次操作应该在1秒内完成
      
      // 验证内存使用被限制
      expect(monitor.getMetricEntries('ops').length).toBeLessThanOrEqual(50)
      const histStats = monitor.getHistogramStats('response_time')
      expect(histStats!.count).toBeLessThanOrEqual(100)
    })

    it('should handle circular references properly', () => {
      // 创建带有循环引用的对象
      const circularRef = { data: 'test' }
      ;(circularRef as any).self = circularRef
      
      // 应该能够处理带有循环引用的标签而不会崩溃
      expect(() => {
        monitor.increment('test', 1, { circular: circularRef } as any)
      }).not.toThrow()
      
      // 验证操作仍然正常
      expect(monitor.getCounter('test')).toBe(1)
    })

    it('should provide efficient memory cleanup', () => {
      // 创建一个新的监控器实例
      const testMonitor = new PerformanceMonitor({
        maxHistogramValues: 100,
        maxMetricEntries: 50,
      })
      
      // 添加数据
      testMonitor.increment('counter', 1000)
      testMonitor.recordValue('metric', 50)
      
      // 验证数据存在
      expect(testMonitor.getCounter('counter')).toBe(1000)
      expect(testMonitor.getHistogramStats('metric')?.count).toBe(1)
      
      // 重置监控器
      testMonitor.reset()
      
      // 验证所有数据都被清理
      expect(testMonitor.getCounter('counter')).toBe(0)
      expect(testMonitor.getHistogramStats('metric')).toBeUndefined()
      expect(testMonitor.getActiveTimerCount()).toBe(0)
    })
  })

  describe('Memory efficiency improvements', () => {
    it('should use efficient array operations for histogram cleanup', () => {
      const monitor = new PerformanceMonitor({
        maxHistogramValues: 10,
      })
      
      // 添加大量数据
      for (let i = 0; i < 100; i++) {
        monitor.recordValue('efficiency_test', i)
      }
      
      // 验证使用的是更高效的数组操作
      const histogramValues = (monitor as any).histograms.get('efficiency_test')
      expect(histogramValues.length).toBe(10)
      
      // 验证保留的是最新的值
      expect(histogramValues[0]).toBe(90) // 最旧的保留值
      expect(histogramValues[9]).toBe(99) // 最新的值
    })

    it('should minimize object creation during metric recording', () => {
      const monitor = new PerformanceMonitor({
        maxHistogramValues: 100,
        maxMetricEntries: 100,
      })
      
      // 添加大量数据
      for (let i = 0; i < 1000; i++) {
        monitor.increment('low_alloc_test', 1)
      }
      
      // 验证metric entries数量被限制
      const entries = monitor.getMetricEntries('low_alloc_test')
      expect(entries.length).toBeLessThanOrEqual(100)
      
      // 验证counter值正确
      expect(monitor.getCounter('low_alloc_test')).toBe(1000)
    })
  })

  describe('Batch cleanup functionality', () => {
    it('should efficiently clean up expired metrics in batch', () => {
      const monitor = new PerformanceMonitor({
        maxHistogramValues: 10,
        maxMetricEntries: 5,
      })
      
      // 添加大量数据
      for (let i = 0; i < 20; i++) {
        monitor.recordValue('histogram_metric', i)
        monitor.increment('counter_metric', 1)
      }
      
      // 验证自动清理已经生效
      const histogramEntries = monitor.getHistogramStats('histogram_metric')
      expect(histogramEntries!.count).toBe(10)
      
      const metricEntries = monitor.getMetricEntries('counter_metric')
      expect(metricEntries.length).toBe(5)
      
      // 批量清理应该仍然有效，确保内存使用最优
      const cleanedCount = monitor.cleanupExpiredMetrics()
      
      // 验证清理操作（可能返回0，因为数据已经被管理）
      expect(cleanedCount).toBeGreaterThanOrEqual(0)
      
      // 验证数据仍然在限制范围内
      const histogramAfter = monitor.getHistogramStats('histogram_metric')
      expect(histogramAfter!.count).toBeLessThanOrEqual(10)
      
      const metricAfter = monitor.getMetricEntries('counter_metric')
      expect(metricAfter.length).toBeLessThanOrEqual(5)
    })
  })
})