import {
  VirtualOfficePerformanceMonitor,
  VirtualOfficePerformanceReport,
  PerformanceGrade,
  OptimizationSuggestion,
} from '../VirtualOfficePerformanceMonitor';

describe('VirtualOfficePerformanceMonitor', () => {
  let monitor: VirtualOfficePerformanceMonitor;

  beforeEach(() => {
    monitor = new VirtualOfficePerformanceMonitor({
      targetFPS: 60,
      sampleSize: 60,
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultMonitor = new VirtualOfficePerformanceMonitor();
      expect(defaultMonitor.getReport()).toBeDefined();
    });

    it('should accept custom config', () => {
      const custom = new VirtualOfficePerformanceMonitor({ targetFPS: 30 });
      expect(custom).toBeDefined();
    });
  });

  describe('FPS monitoring', () => {
    it('should record frame and compute current FPS', () => {
      monitor.recordFrame(16.67);
      expect(monitor.getCurrentFPS()).toBeCloseTo(60, 0);
    });

    it('should compute average FPS over samples', () => {
      for (let i = 0; i < 30; i++) monitor.recordFrame(16.67);
      expect(monitor.getAverageFPS()).toBeCloseTo(60, 0);
    });

    it('should track FPS history for chart rendering', () => {
      for (let i = 0; i < 10; i++) monitor.recordFrame(16.67);
      const history = monitor.getFPSHistory();
      expect(history.length).toBe(10);
      expect(history[0]).toBeCloseTo(60, 0);
    });

    it('should limit FPS history to maxHistoryLength', () => {
      const smallMonitor = new VirtualOfficePerformanceMonitor({ maxHistoryLength: 5 });
      for (let i = 0; i < 10; i++) smallMonitor.recordFrame(16.67);
      expect(smallMonitor.getFPSHistory().length).toBe(5);
    });

    it('should handle zero delta gracefully', () => {
      monitor.recordFrame(0);
      expect(monitor.getCurrentFPS()).toBe(0);
    });

    it('should detect dropped frames', () => {
      monitor.recordFrame(16.67);
      monitor.recordFrame(33.33);
      monitor.recordFrame(16.67);
      expect(monitor.getDroppedFrameCount()).toBe(1);
    });
  });

  describe('memory monitoring', () => {
    it('should record memory snapshots', () => {
      monitor.recordMemorySnapshot({ usedJSHeapSize: 50 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      const memStats = monitor.getMemoryStats();
      expect(memStats.currentMB).toBeCloseTo(50, 0);
      expect(memStats.totalMB).toBeCloseTo(200, 0);
    });

    it('should track peak memory', () => {
      monitor.recordMemorySnapshot({ usedJSHeapSize: 50 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      monitor.recordMemorySnapshot({ usedJSHeapSize: 80 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      monitor.recordMemorySnapshot({ usedJSHeapSize: 60 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      const memStats = monitor.getMemoryStats();
      expect(memStats.peakMB).toBeCloseTo(80, 0);
    });

    it('should compute average memory', () => {
      monitor.recordMemorySnapshot({ usedJSHeapSize: 40 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      monitor.recordMemorySnapshot({ usedJSHeapSize: 60 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      const memStats = monitor.getMemoryStats();
      expect(memStats.averageMB).toBeCloseTo(50, 0);
    });

    it('should return zero stats when no memory snapshots', () => {
      const memStats = monitor.getMemoryStats();
      expect(memStats.currentMB).toBe(0);
      expect(memStats.peakMB).toBe(0);
      expect(memStats.averageMB).toBe(0);
    });

    it('should track memory history for chart rendering', () => {
      monitor.recordMemorySnapshot({ usedJSHeapSize: 50 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      monitor.recordMemorySnapshot({ usedJSHeapSize: 60 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      const history = monitor.getMemoryHistory();
      expect(history.length).toBe(2);
    });

    it('should limit memory history to maxHistoryLength', () => {
      const smallMonitor = new VirtualOfficePerformanceMonitor({ maxHistoryLength: 3 });
      for (let i = 0; i < 5; i++) {
        smallMonitor.recordMemorySnapshot({ usedJSHeapSize: i * 10 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      }
      expect(smallMonitor.getMemoryHistory().length).toBe(3);
    });
  });

  describe('rendering stats', () => {
    it('should record render stats per frame', () => {
      monitor.recordRenderStats({ drawCalls: 50, visibleObjects: 80, culledObjects: 20, totalObjects: 100 });
      const renderStats = monitor.getAggregatedRenderStats();
      expect(renderStats.avgDrawCalls).toBe(50);
      expect(renderStats.avgVisibleObjects).toBe(80);
      expect(renderStats.avgCulledObjects).toBe(20);
    });

    it('should aggregate multiple render stats', () => {
      monitor.recordRenderStats({ drawCalls: 40, visibleObjects: 70, culledObjects: 30, totalObjects: 100 });
      monitor.recordRenderStats({ drawCalls: 60, visibleObjects: 90, culledObjects: 10, totalObjects: 100 });
      const renderStats = monitor.getAggregatedRenderStats();
      expect(renderStats.avgDrawCalls).toBe(50);
      expect(renderStats.avgVisibleObjects).toBe(80);
      expect(renderStats.avgCulledObjects).toBe(20);
    });

    it('should return zero render stats when no data recorded', () => {
      const renderStats = monitor.getAggregatedRenderStats();
      expect(renderStats.avgDrawCalls).toBe(0);
      expect(renderStats.avgVisibleObjects).toBe(0);
      expect(renderStats.avgCulledObjects).toBe(0);
    });

    it('should compute culling efficiency', () => {
      monitor.recordRenderStats({ drawCalls: 50, visibleObjects: 70, culledObjects: 30, totalObjects: 100 });
      const renderStats = monitor.getAggregatedRenderStats();
      expect(renderStats.cullingEfficiency).toBeCloseTo(30, 0);
    });
  });

  describe('performance grade', () => {
    it('should grade as excellent when FPS is high', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(16.67);
      expect(monitor.getPerformanceGrade()).toBe('excellent');
    });

    it('should grade as good when FPS is above 45', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(22);
      expect(monitor.getPerformanceGrade()).toBe('good');
    });

    it('should grade as fair when FPS is above 30', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(30);
      expect(monitor.getPerformanceGrade()).toBe('fair');
    });

    it('should grade as poor when FPS is below 30', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(50);
      expect(monitor.getPerformanceGrade()).toBe('poor');
    });

    it('should return unknown when no data', () => {
      expect(monitor.getPerformanceGrade()).toBe('unknown');
    });
  });

  describe('optimization suggestions', () => {
    it('should suggest reducing complexity when FPS is low', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(50);
      const suggestions = monitor.getOptimizationSuggestions();
      expect(suggestions.some(s => s.category === 'rendering')).toBe(true);
    });

    it('should suggest memory cleanup when memory is high', () => {
      for (let i = 0; i < 10; i++) monitor.recordFrame(16.67);
      monitor.recordMemorySnapshot({ usedJSHeapSize: 190 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      const suggestions = monitor.getOptimizationSuggestions();
      expect(suggestions.some(s => s.category === 'memory')).toBe(true);
    });

    it('should suggest enabling culling when many objects are visible', () => {
      for (let i = 0; i < 10; i++) monitor.recordFrame(16.67);
      monitor.recordRenderStats({ drawCalls: 250, visibleObjects: 200, culledObjects: 5, totalObjects: 250 });
      const suggestions = monitor.getOptimizationSuggestions();
      expect(suggestions.some(s => s.category === 'culling')).toBe(true);
    });

    it('should return empty suggestions when performance is good', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(16.67);
      monitor.recordMemorySnapshot({ usedJSHeapSize: 50 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      monitor.recordRenderStats({ drawCalls: 30, visibleObjects: 60, culledObjects: 40, totalObjects: 100 });
      const suggestions = monitor.getOptimizationSuggestions();
      expect(suggestions.length).toBe(0);
    });
  });

  describe('performance report', () => {
    it('should generate a comprehensive report', () => {
      for (let i = 0; i < 30; i++) monitor.recordFrame(16.67);
      monitor.recordMemorySnapshot({ usedJSHeapSize: 50 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      monitor.recordRenderStats({ drawCalls: 50, visibleObjects: 80, culledObjects: 20, totalObjects: 100 });

      const report = monitor.getReport();
      expect(report.grade).toBeDefined();
      expect(report.fps.current).toBeCloseTo(60, 0);
      expect(report.fps.average).toBeCloseTo(60, 0);
      expect(report.memory.currentMB).toBeCloseTo(50, 0);
      expect(report.render.avgDrawCalls).toBe(50);
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('should include optimization suggestions in report', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(50);
      const report = monitor.getReport();
      expect(report.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('alerts', () => {
    it('should generate FPS alert when performance is poor', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(50);
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should generate memory alert when usage is high', () => {
      monitor.recordMemorySnapshot({ usedJSHeapSize: 190 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      const alerts = monitor.getAlerts();
      expect(alerts.some(a => a.type === 'memory')).toBe(true);
    });

    it('should clear alerts', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(50);
      monitor.clearAlerts();
      expect(monitor.getAlerts().length).toBe(0);
    });

    it('should limit alerts history size', () => {
      for (let i = 0; i < 200; i++) monitor.recordFrame(50);
      expect(monitor.getAlerts().length).toBeLessThanOrEqual(50);
    });
  });

  describe('reset', () => {
    it('should clear all data on reset', () => {
      for (let i = 0; i < 30; i++) monitor.recordFrame(16.67);
      monitor.recordMemorySnapshot({ usedJSHeapSize: 50 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024 });
      monitor.recordRenderStats({ drawCalls: 50, visibleObjects: 80, culledObjects: 20, totalObjects: 100 });

      monitor.reset();

      expect(monitor.getCurrentFPS()).toBe(0);
      expect(monitor.getAverageFPS()).toBe(0);
      expect(monitor.getFPSHistory().length).toBe(0);
      expect(monitor.getMemoryHistory().length).toBe(0);
      expect(monitor.getMemoryStats().currentMB).toBe(0);
      expect(monitor.getAggregatedRenderStats().avgDrawCalls).toBe(0);
      expect(monitor.getAlerts().length).toBe(0);
      expect(monitor.getDroppedFrameCount()).toBe(0);
    });
  });
});
