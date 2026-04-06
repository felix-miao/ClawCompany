import { ApiPerformanceMonitor } from '../api-performance-monitor';
import { PerformanceMonitor } from '../performance-monitor';

describe('ApiPerformanceMonitor - 独立阈值', () => {
  let monitor: PerformanceMonitor;
  let apiMonitor: ApiPerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    apiMonitor = new ApiPerformanceMonitor(monitor);
  });

  test('不同类别的阈值应独立存储', () => {
    apiMonitor.setApiSlowThreshold(100)
    apiMonitor.setLlmSlowThreshold(5000)
    apiMonitor.setAgentSlowThreshold(3000)
    apiMonitor.setDbSlowThreshold(2000)
    apiMonitor.setFsSlowThreshold(500)

    monitor.recordApiCall('test-api', 0, 200)
    monitor.recordApiCall('llm-glm-5', 0, 2000)
    monitor.recordApiCall('agent-dev', 0, 2500)
    monitor.recordApiCall('db-query', 0, 1500)
    monitor.recordApiCall('fs-read', 0, 400)

    const apiStats = apiMonitor.getApiStats('test-api')
    expect(apiStats.slowCallCount).toBe(1)

    const llmStats = apiMonitor.getApiStats('llm-glm-5')
    expect(llmStats.slowCallCount).toBe(0)

    const agentStats = apiMonitor.getApiStats('agent-dev')
    expect(agentStats.slowCallCount).toBe(0)

    const dbStats = apiMonitor.getApiStats('db-query')
    expect(dbStats.slowCallCount).toBe(0)

    const fsStats = apiMonitor.getApiStats('fs-read')
    expect(fsStats.slowCallCount).toBe(0)
  })

  test('各类别阈值不应互相覆盖', () => {
    apiMonitor.setApiSlowThreshold(1000)
    apiMonitor.setLlmSlowThreshold(5000)

    monitor.recordApiCall('test-api', 0, 2000)

    const apiStats = apiMonitor.getApiStats('test-api')
    expect(apiStats.slowCallCount).toBe(1)
  })

  test('未设置类别的阈值使用 PerformanceMonitor 默认值', () => {
    monitor.recordApiCall('unknown-api', 0, 1500)

    const stats = apiMonitor.getApiStats('unknown-api')
    expect(stats.slowCallCount).toBe(1)
  })

  test('getCategoryThreshold 返回已设置的阈值', () => {
    apiMonitor.setApiSlowThreshold(100)
    apiMonitor.setLlmSlowThreshold(5000)

    expect(apiMonitor.getCategoryThreshold('api')).toBe(100)
    expect(apiMonitor.getCategoryThreshold('llm')).toBe(5000)
    expect(apiMonitor.getCategoryThreshold('agent')).toBeUndefined()
  })

  test('monitorApiCall 正确记录并通过 getApiStats 使用类别阈值', async () => {
    apiMonitor.setApiSlowThreshold(50)

    const call = apiMonitor.monitorApiCall('test-api', async () => {
      await new Promise(r => setTimeout(r, 100))
      return 'slow'
    })
    await call()

    const stats = apiMonitor.getApiStats('test-api')
    expect(stats.totalCalls).toBe(1)
    expect(stats.slowCallCount).toBe(1)
  })
})
