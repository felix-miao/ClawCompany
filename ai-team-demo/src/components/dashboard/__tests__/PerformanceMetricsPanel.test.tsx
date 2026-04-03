import { render, screen, waitFor } from '@testing-library/react'
import { PerformanceMetricsPanel } from '../PerformanceMetricsPanel'
import { MetricsAggregator } from '@/lib/core/metrics-aggregator'

// Mock MetricsAggregator
jest.mock('@/lib/core/metrics-aggregator')

const mockMetricsAggregator = MetricsAggregator as jest.MockedClass<typeof MetricsAggregator>

describe('PerformanceMetricsPanel', () => {
  const mockMetrics = {
    memoryUsage: {
      used: 1024,
      total: 4096,
      percentage: 25,
    },
    tasks: {
      total: 100,
      completed: 85,
      failed: 5,
      averageExecutionTime: 1500,
      pending: 10,
      inProgress: 5,
    },
    errors: {
      total: 5,
      rate: 5.0,
      byCategory: {
        'Orchestrator': 3,
        'FileSystem': 2,
      },
    },
    performance: {
      averageResponseTime: 1200,
      p95ResponseTime: 3500,
      p99ResponseTime: 5000,
      throughput: 8.5,
    },
    health: {
      overall: 'healthy' as const,
      uptime: 3600, // 1 hour
      lastUpdated: new Date(),
    },
  }

  beforeEach(() => {
    // Reset mocks
    mockMetricsAggregator.prototype.getCurrentMetrics.mockClear()
    mockMetricsAggregator.prototype.startPeriodicUpdate.mockClear()

    // Setup mock implementation
    mockMetricsAggregator.prototype.getCurrentMetrics.mockReturnValue(mockMetrics)
    mockMetricsAggregator.prototype.startPeriodicUpdate.mockImplementation((callback) => {
      // Call callback immediately
      callback(mockMetrics)
      // Return cleanup function
      return () => {}
    })
  })

  // Create a helper function to create the aggregator with mocked dependencies
  const createMockAggregator = () => {
    const mockPerfMonitor = {
      snapshot: jest.fn(),
      getMetricEntries: jest.fn(),
    } as any
    
    const mockErrorTracker = {
      getSummary: jest.fn(),
    } as any
    
    const mockLogger = {
      info: jest.fn(),
    } as any
    
    return new MetricsAggregator(mockPerfMonitor, mockErrorTracker, mockLogger)
  }

  it('should render loading state initially', () => {
    render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)
    
    expect(screen.getByText('性能指标')).toBeInTheDocument()
    expect(screen.getByText('加载性能数据...')).toBeInTheDocument()
  })

  it('should display performance metrics when loaded', async () => {
    const { container } = render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)

    await waitFor(() => {
      expect(screen.getByText('性能指标')).toBeInTheDocument()
      
      // Check memory usage section
      expect(screen.getByText('内存使用')).toBeInTheDocument()
      expect(screen.getByText('1 GB / 4 GB')).toBeInTheDocument()
      expect(screen.getByText('25.0% 已使用')).toBeInTheDocument()
      
      // Check task statistics section
      expect(screen.getByText('任务统计')).toBeInTheDocument()
      expect(screen.getByText('总计')).toBeInTheDocument()
      expect(screen.getByText('已完成')).toBeInTheDocument()
      expect(screen.getByText('进行中')).toBeInTheDocument()
      expect(screen.getByText('失败')).toBeInTheDocument()
      
      // Check error statistics section
      expect(screen.getByText('错误统计')).toBeInTheDocument()
      expect(screen.getByText('错误率')).toBeInTheDocument()
      expect(screen.getByText('5.00%')).toBeInTheDocument()
      
      // Check performance metrics section
      expect(screen.getByText('性能指标')).toBeInTheDocument()
      expect(screen.getByText('平均响应时间')).toBeInTheDocument()
      expect(screen.getByText('1.2s')).toBeInTheDocument()
    })

    // Check that the health status is displayed
    expect(screen.getByText('健康')).toBeInTheDocument()
  })

  it('should format memory usage correctly', async () => {
    render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)

    await waitFor(() => {
      expect(screen.getByText('1 GB / 4 GB')).toBeInTheDocument()
    })
  })

  it('should format time correctly', async () => {
    render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)

    await waitFor(() => {
      expect(screen.getByText('1.5s')).toBeInTheDocument() // averageExecutionTime
      expect(screen.getByText('1.2s')).toBeInTheDocument() // averageResponseTime
      expect(screen.getByText('3.5s')).toBeInTheDocument() // p95ResponseTime
      expect(screen.getByText('5.0s')).toBeInTheDocument() // p99ResponseTime
    })
  })

  it('should handle critical health status', async () => {
    const criticalMetrics = { ...mockMetrics, health: { ...mockMetrics.health, overall: 'critical' as const } }
    mockMetricsAggregator.prototype.getCurrentMetrics.mockReturnValue(criticalMetrics)

    render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)

    await waitFor(() => {
      expect(screen.getByText('严重')).toBeInTheDocument()
    })
  })

  it('should handle warning health status', async () => {
    const warningMetrics = { ...mockMetrics, health: { ...mockMetrics.health, overall: 'warning' as const } }
    mockMetricsAggregator.prototype.getCurrentMetrics.mockReturnValue(warningMetrics)

    render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)

    await waitFor(() => {
      expect(screen.getByText('警告')).toBeInTheDocument()
    })
  })

  it('should display error categories when available', async () => {
    render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)

    await waitFor(() => {
      expect(screen.getByText('按类别分布:')).toBeInTheDocument()
      expect(screen.getByText('Orchestrator')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('FileSystem')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('should display update timestamp', async () => {
    const fixedDate = new Date('2026-04-04T10:30:00Z')
    jest.spyOn(global, 'Date').mockImplementation(() => fixedDate)

    render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)

    await waitFor(() => {
      expect(screen.getByText('10:30')).toBeInTheDocument()
    })

    jest.restoreAllMocks()
  })

  it('should start periodic updates on mount', () => {
    const mockCleanup = jest.fn() as any
    mockMetricsAggregator.prototype.startPeriodicUpdate.mockReturnValue(mockCleanup)

    const { unmount } = render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)

    expect(mockMetricsAggregator.prototype.startPeriodicUpdate).toHaveBeenCalled()
    expect(mockCleanup).not.toHaveBeenCalled()

    // Cleanup should be called on unmount
    unmount()
    expect(mockCleanup).toHaveBeenCalled()
  })

  it('should handle empty error categories', async () => {
    const emptyErrorMetrics = { ...mockMetrics, errors: { ...mockMetrics.errors, byCategory: {} } }
    mockMetricsAggregator.prototype.getCurrentMetrics.mockReturnValue(emptyErrorMetrics)

    render(<PerformanceMetricsPanel metricsAggregator={createMockAggregator()} />)

    await waitFor(() => {
      // Should still show error stats but not categories section
      expect(screen.getByText('错误率')).toBeInTheDocument()
      expect(screen.queryByText('按类别分布:')).not.toBeInTheDocument()
    })
  })
})