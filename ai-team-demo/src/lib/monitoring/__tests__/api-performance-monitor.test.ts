import { ApiPerformanceMonitor } from '../api-performance-monitor';
import { PerformanceMonitor } from '../performance-monitor';

// Mock the PerformanceMonitor for unit tests
jest.mock('../performance-monitor');

describe('ApiPerformanceMonitor', () => {
  let performanceMonitor: jest.Mocked<PerformanceMonitor>;
  let apiMonitor: ApiPerformanceMonitor;

  beforeEach(() => {
    // 创建mock实例
    performanceMonitor = {
      recordApiCall: jest.fn(),
      getApiStats: jest.fn(),
      setSlowThreshold: jest.fn(),
      getSlowThreshold: jest.fn().mockReturnValue(1000),
      getMonitoredApis: jest.fn(),
      generatePerformanceReport: jest.fn(),
      cleanupOldData: jest.fn(),
      reset: jest.fn(),
      recordMemoryUsage: jest.fn(),
      getMemoryStats: jest.fn(),
    } as unknown as jest.Mocked<PerformanceMonitor>;
    
    apiMonitor = new ApiPerformanceMonitor(performanceMonitor);
  });

  describe('API调用监控', () => {
    test('应该包装API调用并记录性能', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ success: true });
      const wrappedCall = apiMonitor.monitorApiCall('test-api', mockApiCall);
      
      await wrappedCall();
      
      expect(mockApiCall).toHaveBeenCalled();
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'test-api',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });

    test('应该正确处理API调用失败', async () => {
      const mockApiCall = jest.fn().mockRejectedValue(new Error('API failed'));
      const wrappedCall = apiMonitor.monitorApiCall('test-api', mockApiCall);
      
      await expect(wrappedCall()).rejects.toThrow('API failed');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'test-api',
        expect.any(Number),
        expect.any(Number),
        false
      );
    });

    test('应该支持同步API调用', () => {
      const mockApiCall = jest.fn().mockReturnValue({ success: true });
      const wrappedCall = apiMonitor.monitorApiCallSync('sync-api', mockApiCall);
      
      wrappedCall();
      
      expect(mockApiCall).toHaveBeenCalled();
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'sync-api',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });
  });

  describe('LLM调用监控', () => {
    test('应该监控LLM调用', async () => {
      const mockLlmCall = jest.fn().mockResolvedValue('Response from LLM');
      const wrappedCall = apiMonitor.monitorLlmCall('glm-5', mockLlmCall);
      
      const result = await wrappedCall('Test prompt');
      
      expect(result).toBe('Response from LLM');
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'llm-glm-5',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });

    test('应该正确处理LLM调用失败', async () => {
      const mockLlmCall = jest.fn().mockRejectedValue(new Error('LLM unavailable'));
      const wrappedCall = apiMonitor.monitorLlmCall('glm-5', mockLlmCall);
      
      await expect(wrappedCall('Test prompt')).rejects.toThrow('LLM unavailable');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'llm-glm-5',
        expect.any(Number),
        expect.any(Number),
        false
      );
    });

    test('应该监控不同的LLM模型', async () => {
      const mockLlmCall = jest.fn().mockResolvedValue('Response');
      const wrappedCall = apiMonitor.monitorLlmCall('claude-3', mockLlmCall);
      
      await wrappedCall('Test prompt');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'llm-claude-3',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });
  });

  describe('Agent调用监控', () => {
    test('应该监控agent调用', async () => {
      const mockAgentCall = jest.fn().mockResolvedValue({ result: 'Agent response' });
      const wrappedCall = apiMonitor.monitorAgentCall('dev-agent', mockAgentCall);
      
      const result = await wrappedCall('Test task');
      
      expect(result).toEqual({ result: 'Agent response' });
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'agent-dev-agent',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });

    test('应该监控不同类型的agent', async () => {
      const mockDevCall = jest.fn().mockResolvedValue({ result: 'Dev response' });
      const wrappedCall = apiMonitor.monitorDevAgent(mockDevCall);
      
      await wrappedCall('Test task');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'agent-dev',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });

    test('应该监控reviewer agent调用', async () => {
      const mockReviewCall = jest.fn().mockResolvedValue({ review: 'Approved' });
      const wrappedCall = apiMonitor.monitorReviewerAgent(mockReviewCall);
      
      await wrappedCall('Code to review');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'agent-reviewer',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });

    test('应该监控pm agent调用', async () => {
      const mockPmCall = jest.fn().mockResolvedValue({ tasks: ['task1'], timeline: ['week1'] });
      const wrappedCall = apiMonitor.monitorPmAgent(mockPmCall);
      
      const result = await wrappedCall('Build feature');
      
      expect(result).toEqual({ tasks: ['task1'], timeline: ['week1'] });
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'agent-pm',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });

    test('应该正确处理agent调用失败', async () => {
      const mockAgentCall = jest.fn().mockRejectedValue(new Error('Agent crashed'));
      const wrappedCall = apiMonitor.monitorAgentCall('failing-agent', mockAgentCall);
      
      await expect(wrappedCall('Test task')).rejects.toThrow('Agent crashed');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'agent-failing-agent',
        expect.any(Number),
        expect.any(Number),
        false
      );
    });
  });

  describe('数据库和文件系统监控', () => {
    test('应该监控数据库查询成功', async () => {
      const mockDbCall = jest.fn().mockResolvedValue({ rows: [] });
      const wrappedCall = apiMonitor.monitorDbQuery('select-users', mockDbCall);
      
      const result = await wrappedCall();
      
      expect(result).toEqual({ rows: [] });
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'db-select-users',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });

    test('应该正确处理数据库查询失败', async () => {
      const mockDbCall = jest.fn().mockRejectedValue(new Error('Connection refused'));
      const wrappedCall = apiMonitor.monitorDbQuery('insert-user', mockDbCall);
      
      await expect(wrappedCall()).rejects.toThrow('Connection refused');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'db-insert-user',
        expect.any(Number),
        expect.any(Number),
        false
      );
    });

    test('应该监控文件系统操作成功', async () => {
      const mockFsCall = jest.fn().mockResolvedValue({ bytesWritten: 1024 });
      const wrappedCall = apiMonitor.monitorFsOperation('write-file', mockFsCall);
      
      const result = await wrappedCall();
      
      expect(result).toEqual({ bytesWritten: 1024 });
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'fs-write-file',
        expect.any(Number),
        expect.any(Number),
        true
      );
    });

    test('应该正确处理文件系统操作失败', async () => {
      const mockFsCall = jest.fn().mockRejectedValue(new Error('Permission denied'));
      const wrappedCall = apiMonitor.monitorFsOperation('delete-file', mockFsCall);
      
      await expect(wrappedCall()).rejects.toThrow('Permission denied');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'fs-delete-file',
        expect.any(Number),
        expect.any(Number),
        false
      );
    });
  });

  describe('性能阈值配置', () => {
    test('应该允许配置LLM调用阈值', () => {
      apiMonitor.setLlmSlowThreshold(2000);
      expect(apiMonitor.getCategoryThreshold('llm')).toBe(2000);
    });

    test('应该允许配置agent调用阈值', () => {
      apiMonitor.setAgentSlowThreshold(3000);
      expect(apiMonitor.getCategoryThreshold('agent')).toBe(3000);
    });

    test('应该允许配置通用API阈值', () => {
      apiMonitor.setApiSlowThreshold(500);
      expect(apiMonitor.getCategoryThreshold('api')).toBe(500);
    });

    test('应该允许配置数据库查询阈值', () => {
      apiMonitor.setDbSlowThreshold(1000);
      expect(apiMonitor.getCategoryThreshold('db')).toBe(1000);
    });

    test('应该允许配置文件系统操作阈值', () => {
      apiMonitor.setFsSlowThreshold(200);
      expect(apiMonitor.getCategoryThreshold('fs')).toBe(200);
    });
  });

  describe('批量操作监控', () => {
    test('应该监控批量API调用', async () => {
      const mockCalls = [
        () => Promise.resolve('result1'),
        () => Promise.resolve('result2'),
        () => Promise.resolve('result3')
      ];
      
      const results = await apiMonitor.monitorBatchCalls('batch-api', mockCalls);
      
      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledTimes(3);
    });

    test('应该正确处理批量调用中的失败', async () => {
      const mockCalls = [
        () => Promise.resolve('result1'),
        () => Promise.reject(new Error('Failed')),
        () => Promise.resolve('result3')
      ];
      
      const results = await apiMonitor.monitorBatchCalls('batch-api', mockCalls);
      
      expect(results).toEqual(['result1', undefined, 'result3']);
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledTimes(3);
    });

    test('应该处理空批量调用', async () => {
      const results = await apiMonitor.monitorBatchCalls('empty-batch', []);
      
      expect(results).toEqual([]);
      expect(performanceMonitor.recordApiCall).not.toHaveBeenCalled();
    });

    test('应该处理全部失败的批量调用', async () => {
      const mockCalls = [
        () => Promise.reject(new Error('Fail 1')),
        () => Promise.reject(new Error('Fail 2'))
      ];
      
      const results = await apiMonitor.monitorBatchCalls('fail-batch', mockCalls);
      
      expect(results).toEqual([undefined, undefined]);
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledTimes(2);
    });
  });

  describe('统计和报告', () => {
    test('应该获取单个API的性能统计', () => {
      const mockStats = { avgTime: 150, maxTime: 300, callCount: 10 };
      performanceMonitor.getApiStats = jest.fn().mockReturnValue(mockStats);
      
      const stats = apiMonitor.getApiStats('test-api');
      
      expect(stats).toEqual(mockStats);
      expect(performanceMonitor.getApiStats).toHaveBeenCalledWith('test-api');
    });

    test('应该获取所有API的性能统计', () => {
      performanceMonitor.getMonitoredApis = jest.fn().mockReturnValue(['api1', 'api2']);
      performanceMonitor.getApiStats = jest.fn()
        .mockReturnValueOnce({ avgTime: 100 })
        .mockReturnValueOnce({ avgTime: 200 });
      
      const allStats = apiMonitor.getAllApiStats();
      
      expect(allStats).toEqual({
        api1: { avgTime: 100 },
        api2: { avgTime: 200 }
      });
    });

    test('应该处理无监控API时的getAllApiStats', () => {
      performanceMonitor.getMonitoredApis = jest.fn().mockReturnValue([]);
      
      const allStats = apiMonitor.getAllApiStats();
      
      expect(allStats).toEqual({});
    });

    test('应该生成性能报告', () => {
      const mockReport = 'Performance Report:\nAll systems normal';
      performanceMonitor.generatePerformanceReport = jest.fn().mockReturnValue(mockReport);
      
      const report = apiMonitor.getPerformanceReport();
      
      expect(report).toBe(mockReport);
      expect(performanceMonitor.generatePerformanceReport).toHaveBeenCalled();
    });

    test('应该返回底层性能监控实例', () => {
      const monitor = apiMonitor.getPerformanceMonitor();
      
      expect(monitor).toBe(performanceMonitor);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理异步调用中的错误', async () => {
      const mockApiCall = jest.fn().mockRejectedValue(new Error('Network error'));
      const wrappedCall = apiMonitor.monitorApiCall('error-api', mockApiCall);
      
      await expect(wrappedCall()).rejects.toThrow('Network error');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'error-api',
        expect.any(Number),
        expect.any(Number),
        false
      );
    });

    test('应该正确处理同步调用中的错误', () => {
      const mockApiCall = jest.fn(() => {
        throw new Error('Sync error');
      });
      const wrappedCall = apiMonitor.monitorApiCallSync('sync-error-api', mockApiCall);
      
      expect(() => wrappedCall()).toThrow('Sync error');
      
      expect(performanceMonitor.recordApiCall).toHaveBeenCalledWith(
        'sync-error-api',
        expect.any(Number),
        expect.any(Number),
        false
      );
    });
  });
});