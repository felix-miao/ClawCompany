import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceDashboard } from '@/components/performance-dashboard';
import { PerformanceMonitor, PerformanceReport } from '@/lib/monitoring/performance-monitor';

// Mock the PerformanceMonitor
jest.mock('@/lib/monitoring/performance-monitor');
import { PerformanceMonitor } from '@/lib/monitoring/performance-monitor';

const mockPerformanceMonitor = new PerformanceMonitor() as jest.Mocked<PerformanceMonitor>;

describe('PerformanceDashboard', () => {
  beforeEach(() => {
    mockPerformanceMonitor.getApiStats.mockReturnValue({
      totalCalls: 100,
      successfulCalls: 95,
      failedCalls: 5,
      averageResponseTime: 250,
      minResponseTime: 50,
      maxResponseTime: 2000,
      successRate: 0.95,
      slowCallCount: 10,
      fastCallCount: 90
    });

    mockPerformanceMonitor.getMemoryStats.mockReturnValue({
      currentUsage: 500,
      averageUsage: 450,
      peakUsage: 800,
      currentPercentage: 25,
      averagePercentage: 22.5
    });

    mockPerformanceMonitor.getMonitoredApis.mockReturnValue(['api1', 'api2', 'llm-glm-5']);
    mockPerformanceMonitor.generatePerformanceReport.mockReturnValue({
      totalApiCalls: 100,
      averageResponseTime: 250,
      successRate: 0.95,
      memoryStats: {
        currentUsage: 500,
        averageUsage: 450,
        peakUsage: 800,
        currentPercentage: 25,
        averagePercentage: 22.5
      },
      apiPerformance: {
        'api1': {
          totalCalls: 50,
          successfulCalls: 48,
          failedCalls: 2,
          averageResponseTime: 200,
          minResponseTime: 50,
          maxResponseTime: 1500,
          successRate: 0.96,
          slowCallCount: 5,
          fastCallCount: 45
        },
        'api2': {
          totalCalls: 30,
          successfulCalls: 27,
          failedCalls: 3,
          averageResponseTime: 300,
          minResponseTime: 100,
          maxResponseTime: 2000,
          successRate: 0.9,
          slowCallCount: 8,
          fastCallCount: 22
        },
        'llm-glm-5': {
          totalCalls: 20,
          successfulCalls: 20,
          failedCalls: 0,
          averageResponseTime: 400,
          minResponseTime: 200,
          maxResponseTime: 800,
          successRate: 1,
          slowCallCount: 2,
          fastCallCount: 18
        }
      },
      timeRange: {
        start: Date.now() - 3600000,
        end: Date.now(),
        duration: 3600000
      },
      timestamp: Date.now()
    });
  });

  test('应该渲染性能概览卡片', () => {
    render(<PerformanceDashboard performanceMonitor={mockPerformanceMonitor} />);
    
    expect(screen.getByText('性能监控仪表板')).toBeInTheDocument();
    expect(screen.getByText('总API调用')).toBeInTheDocument();
    expect(screen.getByText('平均响应时间')).toBeInTheDocument();
    expect(screen.getByText('成功率')).toBeInTheDocument();
    expect(screen.getByText('内存使用')).toBeInTheDocument();
  });

  test('应该显示API性能统计', () => {
    render(<PerformanceDashboard performanceMonitor={mockPerformanceMonitor} />);
    
    expect(screen.getByText('API性能统计')).toBeInTheDocument();
    expect(screen.getByText('api1')).toBeInTheDocument();
    expect(screen.getByText('api2')).toBeInTheDocument();
    expect(screen.getByText('llm-glm-5')).toBeInTheDocument();
  });

  test('应该显示API调用详情', async () => {
    render(<PerformanceDashboard performanceMonitor={mockPerformanceMonitor} />);
    
    // 点击API详情展开
    const apiItems = screen.getAllByText(/api\d+|llm-glm-5/);
    fireEvent.click(apiItems[0]);
    
    await waitFor(() => {
      expect(screen.getByText('总调用')).toBeInTheDocument();
      expect(screen.getByText('平均响应时间')).toBeInTheDocument();
      expect(screen.getByText('成功率')).toBeInTheDocument();
    });
  });

  test('应该显示内存使用图表', () => {
    render(<PerformanceDashboard performanceMonitor={mockPerformanceMonitor} />);
    
    expect(screen.getByText('内存使用')).toBeInTheDocument();
    expect(screen.getByText('当前使用')).toBeInTheDocument();
    expect(screen.getByText('平均使用')).toBeInTheDocument();
    expect(screen.getByText('峰值使用')).toBeInTheDocument();
  });

  test('应该有刷新按钮', () => {
    render(<PerformanceDashboard performanceMonitor={mockPerformanceMonitor} />);
    
    const refreshButton = screen.getByText('刷新数据');
    expect(refreshButton).toBeInTheDocument();
    
    fireEvent.click(refreshButton);
    // 这里可以验证refresh函数是否被调用
  });

  test('应该显示时间范围信息', () => {
    render(<PerformanceDashboard performanceMonitor={mockPerformanceMonitor} />);
    
    expect(screen.getByText(/监控时长/)).toBeInTheDocument();
    expect(screen.getByText(/最后更新/)).toBeInTheDocument();
  });

  test('应该处理无数据情况', () => {
    mockPerformanceMonitor.getMonitoredApis.mockReturnValue([]);
    mockPerformanceMonitor.generatePerformanceReport.mockReturnValue({
      totalApiCalls: 0,
      averageResponseTime: 0,
      successRate: 0,
      memoryStats: {
        currentUsage: 0,
        averageUsage: 0,
        peakUsage: 0,
        currentPercentage: 0,
        averagePercentage: 0
      },
      apiPerformance: {},
      timeRange: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      },
      timestamp: Date.now()
    });

    render(<PerformanceDashboard performanceMonitor={mockPerformanceMonitor} />);
    
    expect(screen.getByText('暂无API调用数据')).toBeInTheDocument();
  });

  test('应该显示性能警告', () => {
    // 模拟高错误率
    mockPerformanceMonitor.getApiStats.mockReturnValue({
      totalCalls: 100,
      successfulCalls: 60,
      failedCalls: 40,
      averageResponseTime: 1000,
      minResponseTime: 100,
      maxResponseTime: 5000,
      successRate: 0.6,
      slowCallCount: 50,
      fastCallCount: 50
    });

    mockPerformanceMonitor.generatePerformanceReport.mockReturnValue({
      totalApiCalls: 100,
      averageResponseTime: 1000,
      successRate: 0.6,
      memoryStats: {
        currentUsage: 500,
        averageUsage: 450,
        peakUsage: 800,
        currentPercentage: 25,
        averagePercentage: 22.5
      },
      apiPerformance: {},
      timeRange: {
        start: Date.now() - 3600000,
        end: Date.now(),
        duration: 3600000
      },
      timestamp: Date.now()
    });

    render(<PerformanceDashboard performanceMonitor={mockPerformanceMonitor} />);
    
    expect(screen.getByText('性能警告')).toBeInTheDocument();
    expect(screen.getByText(/错误率过高/)).toBeInTheDocument();
  });

  test('应该显示成功状态', () => {
    // 模拟良好性能
    mockPerformanceMonitor.getApiStats.mockReturnValue({
      totalCalls: 100,
      successfulCalls: 100,
      failedCalls: 0,
      averageResponseTime: 150,
      minResponseTime: 50,
      maxResponseTime: 500,
      successRate: 1,
      slowCallCount: 5,
      fastCallCount: 95
    });

    mockPerformanceMonitor.generatePerformanceReport.mockReturnValue({
      totalApiCalls: 100,
      averageResponseTime: 150,
      successRate: 1,
      memoryStats: {
        currentUsage: 500,
        averageUsage: 450,
        peakUsage: 800,
        currentPercentage: 25,
        averagePercentage: 22.5
      },
      apiPerformance: {},
      timeRange: {
        start: Date.now() - 3600000,
        end: Date.now(),
        duration: 3600000
      },
      timestamp: Date.now()
    });

    render(<PerformanceDashboard performanceMonitor={mockPerformanceMonitor} />);
    
    // 检查性能正常状态（多个元素包含此文本）
    const performanceNormalElements = screen.getAllByText('性能正常');
    expect(performanceNormalElements.length).toBeGreaterThan(0);
    
    expect(screen.getByText('100%')).toBeInTheDocument();
    // 检查具体的性能详情文本
    expect(screen.getByText(/成功率: 100%, 响应时间: 150ms/)).toBeInTheDocument();
  });
});