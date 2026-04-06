import { ActivityTracker, ActivityLog, AgentStats, ActivityContext } from '../activity-tracker'

describe('ActivityTracker', () => {
  let tracker: ActivityTracker

  beforeEach(() => {
    tracker = new ActivityTracker()
  })

  describe('track()', () => {
    it('should return an ActivityContext with end method', () => {
      const context = tracker.track('pm-agent-1', 'analyze', { taskId: 'task-1' })
      
      expect(context).toHaveProperty('end')
      expect(context).toHaveProperty('activityId')
      expect(typeof context.end).toBe('function')
    })

    it('should track activity with correct metadata', () => {
      const context = tracker.track('dev-agent-1', 'implement', { file: 'test.ts' })
      
      expect(context.activityId).toBeDefined()
      
      const history = tracker.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        agentId: 'dev-agent-1',
        action: 'implement',
        success: true,
      })
    })
  })

  describe('getHistory()', () => {
    it('should return empty array initially', () => {
      expect(tracker.getHistory()).toHaveLength(0)
    })

    it('should return all activities when no agentId specified', () => {
      tracker.track('pm-agent', 'analyze', {})
      tracker.track('dev-agent', 'implement', {})
      tracker.track('pm-agent', 'plan', {})
      
      const history = tracker.getHistory()
      expect(history).toHaveLength(3)
    })

    it('should filter by agentId when specified', () => {
      tracker.track('pm-agent', 'analyze', {})
      tracker.track('dev-agent', 'implement', {})
      tracker.track('pm-agent', 'plan', {})
      
      const history = tracker.getHistory('pm-agent')
      expect(history).toHaveLength(2)
      history.forEach(log => {
        expect(log.agentId).toBe('pm-agent')
      })
    })

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        tracker.track('agent', `action-${i}`, {})
      }
      
      const history = tracker.getHistory(undefined, 5)
      expect(history).toHaveLength(5)
    })
  })

  describe('getStats()', () => {
    it('should return stats for specific agent', () => {
      tracker.track('pm-agent', 'analyze', {})
      const ctx1 = tracker.track('dev-agent', 'implement', {})
      ctx1.end({ success: true })
      const ctx2 = tracker.track('dev-agent', 'review', {})
      ctx2.end({ success: false, error: 'Test error' })
      
      const stats = tracker.getStats('dev-agent')
      
      expect(stats.totalActivities).toBe(2)
      expect(stats.successfulActivities).toBe(1)
      expect(stats.failedActivities).toBe(1)
      expect(stats.averageDuration).toBeGreaterThanOrEqual(0)
    })

    it('should return zero stats for unknown agent', () => {
      const stats = tracker.getStats('unknown-agent')
      
      expect(stats.totalActivities).toBe(0)
      expect(stats.successfulActivities).toBe(0)
      expect(stats.failedActivities).toBe(0)
    })
  })

  describe('context.end()', () => {
    it('should complete activity with output', () => {
      const context = tracker.track('pm-agent', 'analyze', { input: 'test' })
      context.end({ output: { tasks: ['task-1', 'task-2'] } })
      
      const history = tracker.getHistory()
      expect(history[0].output).toEqual({ tasks: ['task-1', 'task-2'] })
      expect(history[0].success).toBe(true)
      expect(history[0].duration).toBeGreaterThanOrEqual(0)
    })

    it('should record failure when error provided', () => {
      const context = tracker.track('dev-agent', 'implement', {})
      context.end({ success: false, error: 'Implementation failed' })
      
      const history = tracker.getHistory()
      expect(history[0].success).toBe(false)
      expect(history[0].error).toBe('Implementation failed')
    })

    it('should default success to true if not specified', () => {
      const context = tracker.track('pm-agent', 'analyze', {})
      context.end({})
      
      const history = tracker.getHistory()
      expect(history[0].success).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle invalid input gracefully', () => {
      expect(() => tracker.track('', 'action', {})).not.toThrow()
      expect(() => tracker.getHistory('nonexistent')).not.toThrow()
      expect(() => tracker.getStats('nonexistent')).not.toThrow()
    })

    it('should handle multiple rapid tracks', () => {
      const contexts = []
      for (let i = 0; i < 100; i++) {
        contexts.push(tracker.track('agent', `action-${i}`, { index: i }))
      }
      
      contexts.forEach(ctx => ctx.end({ output: { done: true } }))
      
      expect(tracker.getHistory()).toHaveLength(100)
    })
  })
})
