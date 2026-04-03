import { MetricsAggregator, MetricsDataSource } from '../metrics-aggregator'
import { PerformanceMonitor } from '../performance-monitor'
import { ErrorTracker } from '../error-tracker'
import { StructuredLogger } from '../structured-logger'
import { MetricEntry } from '../performance-monitor'

describe('MetricsAggregator', () => {
  let metricsAggregator: MetricsAggregator
  let mockPerfMonitor: jest.Mocked<PerformanceMonitor>
  let mockErrorTracker: jest.Mocked<ErrorTracker>
  let mockLogger: jest.Mocked<StructuredLogger>
  let mockDataSource: MetricsDataSource

  function createMetricsAggregator(): MetricsAggregator {
    mockDataSource = {
      getMetricEntries: jest.fn().mockReturnValue([]),
    }
    return new MetricsAggregator(mockPerfMonitor, mockErrorTracker, mockLogger, mockDataSource)
  }

  beforeEach(() => {
    mockPerfMonitor = {
      snapshot: jest.fn().mockReturnValue({
        timestamp: new Date().toISOString(),
        counters: {},
        gauges: {},
        histograms: {},
        activeTimers: 0,
      }),
      getMetricEntries: jest.fn().mockReturnValue([]),
      increment: jest.fn(),
      reset: jest.fn(),
      recordValue: jest.fn(),
      setGauge: jest.fn(),
      startTimer: jest.fn().mockReturnValue('timer-1'),
      stopTimer: jest.fn(),
    } as any

    mockErrorTracker = {
      getSummary: jest.fn().mockReturnValue({
        total: 0,
        byCategory: {},
        bySeverity: {},
      }),
      track: jest.fn(),
      clear: jest.fn(),
    } as any

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any

    metricsAggregator = createMetricsAggregator()
  })

  describe('getCurrentMetrics', () => {
    it('should return performance metrics with correct structure', () => {
      (mockDataSource.getMetricEntries as jest.Mock).mockReturnValue([
        { name: 'task.total', value: 100, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.completed', value: 80, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.failed', value: 5, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.duration', value: 1500, timestamp: new Date().toISOString(), type: 0 },
      ])

      mockErrorTracker.getSummary.mockReturnValue({
        total: 5,
        byCategory: { orchestrator: 3, filesystem: 2 },
        bySeverity: { high: 3, medium: 2 },
      })

      const metrics = metricsAggregator.getCurrentMetrics()

      expect(metrics).toHaveProperty('memoryUsage')
      expect(metrics).toHaveProperty('tasks')
      expect(metrics).toHaveProperty('errors')
      expect(metrics).toHaveProperty('performance')
      expect(metrics).toHaveProperty('health')

      // Check memory usage structure
      expect(metrics.memoryUsage).toHaveProperty('used')
      expect(metrics.memoryUsage).toHaveProperty('total')
      expect(metrics.memoryUsage).toHaveProperty('percentage')

      // Check tasks structure
      expect(metrics.tasks).toHaveProperty('total')
      expect(metrics.tasks).toHaveProperty('completed')
      expect(metrics.tasks).toHaveProperty('failed')
      expect(metrics.tasks).toHaveProperty('averageExecutionTime')

      // Check errors structure
      expect(metrics.errors).toHaveProperty('total')
      expect(metrics.errors).toHaveProperty('rate')
      expect(metrics.errors).toHaveProperty('byCategory')

      // Check performance structure
      expect(metrics.performance).toHaveProperty('averageResponseTime')
      expect(metrics.performance).toHaveProperty('throughput')

      // Check health structure
      expect(metrics.health).toHaveProperty('overall')
      expect(metrics.health).toHaveProperty('uptime')
      expect(metrics.health).toHaveProperty('lastUpdated')
    })

    it('should calculate task metrics correctly', () => {
      (mockDataSource.getMetricEntries as jest.Mock).mockReturnValue([
        { name: 'task.total', value: 10, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.completed', value: 8, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.failed', value: 1, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.in_progress', value: 1, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.duration', value: 2000, timestamp: new Date().toISOString(), type: 0 },
      ])

      const metrics = metricsAggregator.getCurrentMetrics()

      expect(metrics.tasks.total).toBe(5)
      expect(metrics.tasks.completed).toBe(1)
      expect(metrics.tasks.failed).toBe(1)
      expect(metrics.tasks.inProgress).toBe(1)
      expect(metrics.tasks.averageExecutionTime).toBe(2000)
    })

    it('should handle empty metric entries', () => {
      (mockDataSource.getMetricEntries as jest.Mock).mockReturnValue([])
      mockErrorTracker.getSummary.mockReturnValue({
        total: 0,
        byCategory: {},
        bySeverity: {},
      })

      const metrics = metricsAggregator.getCurrentMetrics()

      expect(metrics.tasks.total).toBe(0)
      expect(metrics.tasks.completed).toBe(0)
      expect(metrics.tasks.failed).toBe(0)
      expect(metrics.tasks.averageExecutionTime).toBe(0)
      expect(metrics.errors.total).toBe(0)
      expect(metrics.errors.rate).toBe(0)
    })

    it('should calculate error rate correctly', () => {
      (mockDataSource.getMetricEntries as jest.Mock).mockReturnValue([
        { name: 'task.total', value: 20, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.completed', value: 15, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.failed', value: 3, timestamp: new Date().toISOString(), type: 0 },
      ])

      mockErrorTracker.getSummary.mockReturnValue({
        total: 3,
        byCategory: { orchestrator: 2, filesystem: 1 },
        bySeverity: {},
      })

      const metrics = metricsAggregator.getCurrentMetrics()

      expect(metrics.errors.rate).toBe(100)
    })

    it('should assess system health correctly', () => {
      (mockDataSource.getMetricEntries as jest.Mock).mockReturnValue([
        { name: 'task.total', value: 100, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.completed', value: 98, timestamp: new Date().toISOString(), type: 0 },
      ])

      mockErrorTracker.getSummary.mockReturnValue({
        total: 0,
        byCategory: {},
        bySeverity: {},
      })

      let metrics = metricsAggregator.getCurrentMetrics()
      expect(metrics.health.overall).toBe('healthy')
      ;(mockDataSource.getMetricEntries as jest.Mock).mockReturnValue([
        { name: 'task.total', value: 10, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.completed', value: 3, timestamp: new Date().toISOString(), type: 0 },
        { name: 'task.failed', value: 5, timestamp: new Date().toISOString(), type: 0 },
      ])

      mockErrorTracker.getSummary.mockReturnValue({
        total: 5,
        byCategory: { orchestrator: 5 },
        bySeverity: {},
      })

      metrics = metricsAggregator.getCurrentMetrics()
      expect(metrics.health.overall).toBe('critical')
    })
  })

  describe('startPeriodicUpdate', () => {
    it('should start periodic updates and call callback', () => {
      (mockDataSource.getMetricEntries as jest.Mock).mockReturnValue([])
      const mockCallback = jest.fn()
      const cleanup = metricsAggregator.startPeriodicUpdate(mockCallback)

      expect(mockCallback).toHaveBeenCalledTimes(1)

      if (typeof cleanup === 'function') cleanup()
    })

    it('should clean up interval when cleanup is called', () => {
      (mockDataSource.getMetricEntries as jest.Mock).mockReturnValue([])
      const mockCallback = jest.fn()
      const cleanup = metricsAggregator.startPeriodicUpdate(mockCallback)

      expect(typeof cleanup).toBe('function')

      if (typeof cleanup === 'function') cleanup()
    })
  })

  describe('percentile calculation', () => {
    it('should calculate 95th percentile correctly', () => {
      const responseTimes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]

      ;(mockDataSource.getMetricEntries as jest.Mock).mockReturnValue(
        responseTimes.map(time => ({
          name: 'response.time',
          value: time,
          timestamp: new Date().toISOString(),
          type: 0,
        }))
      )

      const metrics = metricsAggregator.getCurrentMetrics()
      
      expect(metrics.performance.p95ResponseTime).toBe(1000)
    })

    it('should handle empty response times array', () => {
      (mockDataSource.getMetricEntries as jest.Mock).mockReturnValue([])

      const metrics = metricsAggregator.getCurrentMetrics()
      
      expect(metrics.performance.p95ResponseTime).toBe(0)
      expect(metrics.performance.p99ResponseTime).toBe(0)
      expect(metrics.performance.averageResponseTime).toBe(0)
    })
  })

  describe('memory usage', () => {
    it('should return memory usage within valid range', () => {
      const metrics = metricsAggregator.getCurrentMetrics()

      expect(metrics.memoryUsage.used).toBeGreaterThanOrEqual(0)
      expect(metrics.memoryUsage.total).toBeGreaterThan(0)
      expect(metrics.memoryUsage.percentage).toBeGreaterThanOrEqual(0)
      expect(metrics.memoryUsage.percentage).toBeLessThanOrEqual(100)
    })
  })
})