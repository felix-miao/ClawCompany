import {
  ErrorTracker,
  TrackedError,
  ErrorFingerprint,
  ErrorAggregate,
  ErrorTrackerConfig,
} from '../error-tracker'
import { AppError, ErrorCategory, ErrorSeverity } from '../errors'

describe('ErrorTracker', () => {
  let tracker: ErrorTracker

  beforeEach(() => {
    tracker = new ErrorTracker()
  })

  describe('error tracking', () => {
    it('should track a generic error', () => {
      const error = new Error('something went wrong')
      tracker.track(error)
      const errors = tracker.getAll()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('something went wrong')
    })

    it('should track an AppError with category and severity', () => {
      const error = new AppError('TEST_CODE', 'test error', ErrorCategory.AGENT, {
        severity: ErrorSeverity.HIGH,
        context: { agentRole: 'dev' },
      })
      tracker.track(error)
      const tracked = tracker.getAll()[0]
      expect(tracked.code).toBe('TEST_CODE')
      expect(tracked.category).toBe(ErrorCategory.AGENT)
      expect(tracked.severity).toBe(ErrorSeverity.HIGH)
      expect(tracked.context).toEqual({ agentRole: 'dev' })
    })

    it('should track error with additional context', () => {
      const error = new Error('timeout')
      tracker.track(error, { requestId: 'req-1', url: '/api/data' })
      const tracked = tracker.getAll()[0]
      expect(tracked.context).toMatchObject({ requestId: 'req-1', url: '/api/data' })
    })

    it('should assign a unique ID to each tracked error', () => {
      tracker.track(new Error('err1'))
      tracker.track(new Error('err2'))
      const errors = tracker.getAll()
      expect(errors[0].id).not.toBe(errors[1].id)
    })

    it('should include a timestamp for each tracked error', () => {
      tracker.track(new Error('timed'))
      const tracked = tracker.getAll()[0]
      expect(tracked.timestamp).toBeDefined()
      expect(new Date(tracked.timestamp).getTime()).not.toBeNaN()
    })

    it('should capture error stack trace', () => {
      const error = new Error('with stack')
      tracker.track(error)
      const tracked = tracker.getAll()[0]
      expect(tracked.stack).toBeDefined()
      expect(tracked.stack).toContain('with stack')
    })
  })

  describe('error fingerprinting and aggregation', () => {
    it('should group identical errors by fingerprint', () => {
      for (let i = 0; i < 5; i++) {
        tracker.track(new Error('connection refused'))
      }
      const aggregates = tracker.getAggregates()
      expect(aggregates).toHaveLength(1)
      expect(aggregates[0].count).toBe(5)
      expect(aggregates[0].fingerprint.message).toBe('connection refused')
    })

    it('should group AppErrors by code and category', () => {
      for (let i = 0; i < 3; i++) {
        tracker.track(new AppError('LLM_TIMEOUT', 'timeout', ErrorCategory.LLM))
      }
      for (let i = 0; i < 2; i++) {
        tracker.track(new AppError('LLM_RATE_LIMIT', 'rate limited', ErrorCategory.LLM))
      }
      const aggregates = tracker.getAggregates()
      expect(aggregates).toHaveLength(2)
    })

    it('should track first and last occurrence in aggregate', () => {
      tracker.track(new Error('repeat'))
      tracker.track(new Error('repeat'))
      const agg = tracker.getAggregates()[0]
      expect(agg.firstSeen).toBeDefined()
      expect(agg.lastSeen).toBeDefined()
      expect(new Date(agg.lastSeen).getTime()).toBeGreaterThanOrEqual(new Date(agg.firstSeen).getTime())
    })

    it('should maintain severity in aggregate', () => {
      tracker.track(new AppError('E1', 'err', ErrorCategory.SYSTEM, {
        severity: ErrorSeverity.CRITICAL,
      }))
      const agg = tracker.getAggregates()[0]
      expect(agg.severity).toBe(ErrorSeverity.CRITICAL)
    })

    it('should produce correct fingerprint for Error', () => {
      const fp = tracker.track(new Error('test'))
      const aggregates = tracker.getAggregates()
      expect(aggregates[0].fingerprint).toEqual({
        name: 'Error',
        message: 'test',
        code: undefined,
        category: undefined,
      })
    })

    it('should produce correct fingerprint for AppError', () => {
      tracker.track(new AppError('CODE', 'msg', ErrorCategory.VALIDATION))
      const agg = tracker.getAggregates()[0]
      expect(agg.fingerprint).toEqual({
        name: 'AppError',
        message: 'msg',
        code: 'CODE',
        category: ErrorCategory.VALIDATION,
      })
    })
  })

  describe('querying and filtering', () => {
    beforeEach(() => {
      tracker.track(new AppError('E_LOW', 'low', ErrorCategory.VALIDATION, {
        severity: ErrorSeverity.LOW,
      }))
      tracker.track(new AppError('E_HIGH', 'high', ErrorCategory.LLM, {
        severity: ErrorSeverity.HIGH,
      }))
      tracker.track(new AppError('E_CRIT', 'critical', ErrorCategory.SYSTEM, {
        severity: ErrorSeverity.CRITICAL,
      }))
    })

    it('should filter by severity', () => {
      const high = tracker.getBySeverity(ErrorSeverity.HIGH)
      expect(high).toHaveLength(1)
      expect(high[0].code).toBe('E_HIGH')
    })

    it('should filter by category', () => {
      const llm = tracker.getByCategory(ErrorCategory.LLM)
      expect(llm).toHaveLength(1)
      expect(llm[0].code).toBe('E_HIGH')
    })

    it('should return errors sorted by timestamp (newest first)', () => {
      const errors = tracker.getAll()
      for (let i = 1; i < errors.length; i++) {
        expect(new Date(errors[i - 1].timestamp).getTime())
          .toBeGreaterThanOrEqual(new Date(errors[i].timestamp).getTime())
      }
    })

    it('should limit the number of returned errors', () => {
      const limited = tracker.getAll({ limit: 2 })
      expect(limited).toHaveLength(2)
    })
  })

  describe('error count and summary', () => {
    it('should return total error count', () => {
      tracker.track(new Error('a'))
      tracker.track(new Error('b'))
      tracker.track(new Error('c'))
      expect(tracker.getCount()).toBe(3)
    })

    it('should return count by severity', () => {
      tracker.track(new AppError('E1', 'err', ErrorCategory.SYSTEM, { severity: ErrorSeverity.CRITICAL }))
      tracker.track(new AppError('E2', 'err', ErrorCategory.SYSTEM, { severity: ErrorSeverity.CRITICAL }))
      tracker.track(new AppError('E3', 'err', ErrorCategory.SYSTEM, { severity: ErrorSeverity.LOW }))
      expect(tracker.getCountBySeverity(ErrorSeverity.CRITICAL)).toBe(2)
      expect(tracker.getCountBySeverity(ErrorSeverity.LOW)).toBe(1)
    })

    it('should return summary with counts per category', () => {
      tracker.track(new AppError('E1', 'err', ErrorCategory.VALIDATION))
      tracker.track(new AppError('E2', 'err', ErrorCategory.VALIDATION))
      tracker.track(new AppError('E3', 'err', ErrorCategory.LLM))
      const summary = tracker.getSummary()
      expect(summary.total).toBe(3)
      expect(summary.byCategory[ErrorCategory.VALIDATION]).toBe(2)
      expect(summary.byCategory[ErrorCategory.LLM]).toBe(1)
    })
  })

  describe('config', () => {
    it('should respect maxErrors config and evict oldest', () => {
      const limitedTracker = new ErrorTracker({ maxErrors: 2 })
      limitedTracker.track(new Error('first'))
      limitedTracker.track(new Error('second'))
      limitedTracker.track(new Error('third'))
      expect(limitedTracker.getAll()).toHaveLength(2)
      expect(limitedTracker.getAll().map(e => e.message)).not.toContain('first')
    })

    it('should clear all errors', () => {
      tracker.track(new Error('a'))
      tracker.track(new Error('b'))
      tracker.clear()
      expect(tracker.getAll()).toHaveLength(0)
      expect(tracker.getAggregates()).toHaveLength(0)
    })
  })
})
