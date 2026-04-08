import { PerformanceMonitor, FrameStats } from '../PerformanceMonitor';

describe('PerformanceMonitor - Panel Interaction', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      targetFPS: 60,
      warningThreshold: 0.8,
      criticalThreshold: 0.5,
      sampleSize: 60,
    });
  });

  describe('getFrameStats returns safe defaults when no data', () => {
    it('should return zero stats when no frames recorded', () => {
      const stats = monitor.getFrameStats();
      expect(stats.currentFPS).toBe(0);
      expect(stats.averageFPS).toBe(0);
      expect(stats.minFPS).toBe(0);
      expect(stats.maxFPS).toBe(0);
      expect(stats.samples).toBe(0);
      expect(stats.avgFrameTime).toBe(0);
    });

    it('should not throw when calling getAverageFPS with no data', () => {
      expect(() => monitor.getAverageFPS()).not.toThrow();
      expect(monitor.getAverageFPS()).toBe(0);
    });
  });

  describe('circular buffer overflow protection', () => {
    it('should not grow beyond sampleSize', () => {
      for (let i = 0; i < 200; i++) {
        monitor.recordFrame(16.67);
      }
      const stats = monitor.getFrameStats();
      expect(stats.samples).toBe(60);
    });

    it('should maintain accurate rolling average after overflow', () => {
      for (let i = 0; i < 120; i++) monitor.recordFrame(16.67);
      for (let i = 0; i < 60; i++) monitor.recordFrame(33.33);

      const avgFPS = monitor.getAverageFPS();
      expect(avgFPS).toBeCloseTo(30, -1);
    });
  });

  describe('alert management for UI panel', () => {
    it('should limit alerts to 50 to prevent UI overflow', () => {
      for (let i = 0; i < 200; i++) monitor.recordFrame(100);

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeLessThanOrEqual(50);
    });

    it('should provide clearable alerts for panel reset', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(100);
      expect(monitor.getAlerts().length).toBeGreaterThan(0);

      monitor.clearAlerts();
      expect(monitor.getAlerts()).toHaveLength(0);
    });

    it('should generate alerts with timestamps for historical display', () => {
      const beforeTime = Date.now();
      for (let i = 0; i < 60; i++) monitor.recordFrame(100);

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(alerts[0]).toHaveProperty('level');
      expect(alerts[0]).toHaveProperty('message');
      expect(alerts[0]).toHaveProperty('fps');
    });
  });

  describe('throttle level calculation for UI indicator', () => {
    it('should return 0 throttle level at target FPS', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(16.67);
      expect(monitor.getThrottleLevel()).toBeLessThan(0.01);
    });

    it('should return 1 throttle level at 0 FPS', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(10000);
      expect(monitor.getThrottleLevel()).toBeGreaterThan(0.99);
    });

    it('should return proportional throttle between 0 and 1', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(33.33);
      const level = monitor.getThrottleLevel();
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThan(1);
    });
  });

  describe('reset for panel refresh', () => {
    it('should clear all data for fresh start', () => {
      for (let i = 0; i < 60; i++) monitor.recordFrame(16.67);

      monitor.reset();

      expect(monitor.getCurrentFPS()).toBe(0);
      expect(monitor.getAverageFPS()).toBe(0);
      expect(monitor.getFrameStats().samples).toBe(0);
      expect(monitor.getAlerts()).toHaveLength(0);
      expect(monitor.getAverageFrameTime()).toBe(0);
    });
  });

  describe('edge cases for panel display', () => {
    it('should handle zero delta frame', () => {
      monitor.recordFrame(0);
      expect(monitor.getCurrentFPS()).toBe(0);
    });

    it('should handle extremely large delta frame', () => {
      monitor.recordFrame(10000);
      expect(monitor.getCurrentFPS()).toBe(0.1);
    });

    it('should handle negative delta gracefully', () => {
      expect(() => monitor.recordFrame(-10)).not.toThrow();
    });
  });
});
