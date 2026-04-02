import { PerformanceMonitor, FrameStats, PerformanceAlert } from '../PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      targetFPS: 60,
      warningThreshold: 0.8,
      criticalThreshold: 0.5,
      sampleSize: 60,
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultMonitor = new PerformanceMonitor();
      expect(defaultMonitor.getCurrentFPS()).toBe(0);
      expect(defaultMonitor.getAverageFPS()).toBe(0);
    });

    it('should accept custom config', () => {
      const custom = new PerformanceMonitor({ targetFPS: 30, sampleSize: 30 });
      expect(custom).toBeDefined();
    });
  });

  describe('recordFrame', () => {
    it('should record frame delta time', () => {
      monitor.recordFrame(16.67);
      expect(monitor.getCurrentFPS()).toBeCloseTo(60, 0);
    });

    it('should calculate FPS from delta', () => {
      monitor.recordFrame(33.33);
      expect(monitor.getCurrentFPS()).toBeCloseTo(30, 0);
    });

    it('should track average FPS over sample window', () => {
      for (let i = 0; i < 30; i++) monitor.recordFrame(16.67);
      expect(monitor.getAverageFPS()).toBeCloseTo(60, 0);
    });

    it('should handle varying frame times', () => {
      for (let i = 0; i < 30; i++) monitor.recordFrame(16.67);
      for (let i = 0; i < 30; i++) monitor.recordFrame(33.33);
      expect(monitor.getAverageFPS()).toBeCloseTo(45, 0);
    });

    it('should limit sample window size', () => {
      for (let i = 0; i < 100; i++) monitor.recordFrame(16.67);
      const stats = monitor.getFrameStats();
      expect(stats.samples).toBeLessThanOrEqual(60);
    });
  });

  describe('performance alerts', () => {
    it('should generate warning when FPS drops below threshold', () => {
      for (let i = 0; i < 30; i++) monitor.recordFrame(16.67);
      for (let i = 0; i < 30; i++) monitor.recordFrame(50);
      const alerts = monitor.getAlerts();
      expect(alerts.some(a => a.level === 'warning')).toBe(true);
    });

    it('should generate critical alert when FPS is very low', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(100);
      const alerts = monitor.getAlerts();
      expect(alerts.some(a => a.level === 'critical')).toBe(true);
    });

    it('should clear old alerts', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(100);
      monitor.clearAlerts();
      expect(monitor.getAlerts()).toHaveLength(0);
    });
  });

  describe('frame budget', () => {
    it('should calculate frame budget in ms', () => {
      expect(monitor.getFrameBudgetMs()).toBeCloseTo(16.67, 1);
    });

    it('should calculate used budget percentage', () => {
      monitor.recordFrame(12);
      expect(monitor.getBudgetUsedPercent()).toBeCloseTo(72, 0);
    });

    it('should report when over budget', () => {
      monitor.recordFrame(20);
      expect(monitor.isOverBudget()).toBe(true);
    });

    it('should report when under budget', () => {
      monitor.recordFrame(10);
      expect(monitor.isOverBudget()).toBe(false);
    });
  });

  describe('getFrameStats', () => {
    it('should return comprehensive frame stats', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(16.67);
      const stats = monitor.getFrameStats();
      expect(stats.currentFPS).toBeCloseTo(60, 0);
      expect(stats.averageFPS).toBeCloseTo(60, 0);
      expect(stats.minFPS).toBeCloseTo(60, 0);
      expect(stats.maxFPS).toBeCloseTo(60, 0);
      expect(stats.samples).toBe(60);
    });

    it('should track min and max FPS', () => {
      for (let i = 0; i < 30; i++) monitor.recordFrame(16.67);
      monitor.recordFrame(100);
      monitor.recordFrame(11);
      for (let i = 0; i < 29; i++) monitor.recordFrame(16.67);
      const stats = monitor.getFrameStats();
      expect(stats.minFPS).toBeLessThan(20);
      expect(stats.maxFPS).toBeGreaterThan(80);
    });
  });

  describe('throttling recommendation', () => {
    it('should recommend throttle when performance is poor', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(50);
      expect(monitor.shouldThrottle()).toBe(true);
    });

    it('should not recommend throttle when performance is good', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(16.67);
      expect(monitor.shouldThrottle()).toBe(false);
    });

    it('should suggest throttle level', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(50);
      expect(monitor.getThrottleLevel()).toBeGreaterThan(0);
      expect(monitor.getThrottleLevel()).toBeLessThanOrEqual(1);
    });
  });

  describe('reset', () => {
    it('should clear all recorded data', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(16.67);
      monitor.reset();
      expect(monitor.getCurrentFPS()).toBe(0);
      expect(monitor.getAverageFPS()).toBe(0);
      expect(monitor.getFrameStats().samples).toBe(0);
    });
  });
});
