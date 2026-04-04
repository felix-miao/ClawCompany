import {
  ErrorRecovery,
  RecoveryStrategy,
  RecoveryResult,
  CircuitState,
  RetryOptions,
  RetryResult,
} from '../error-recovery'
import { AppError, AgentError, LLMError, ErrorCategory, ErrorSeverity } from '../errors'

describe('ErrorRecovery', () => {
  let recovery: ErrorRecovery

  beforeEach(() => {
    recovery = new ErrorRecovery()
  })

  describe('handleError', () => {
    it('should return retry strategy for agent errors', async () => {
      const error = new AgentError('Agent timeout', 'dev', { taskId: 'task-1' })
      const result = await recovery.handleError(error)
      expect(result.strategy).toBe(RecoveryStrategy.RETRY)
      expect(result.recovered).toBe(false)
    })

    it('should return fallback strategy for LLM errors when fallback exists', async () => {
      const error = new LLMError('API error', 'glm')
      const result = await recovery.handleError(error, {
        fallback: async () => 'fallback result',
      })
      expect(result.strategy).toBe(RecoveryStrategy.FALLBACK)
      expect(result.recovered).toBe(true)
      expect(result.result).toBe('fallback result')
    })

    it('should return circuit_breaker strategy for repeated failures', async () => {
      const error = new LLMError('API error', 'glm')
      const key = 'llm-glm'
      for (let i = 0; i < 5; i++) {
        await recovery.handleError(error, { circuitKey: key })
      }
      const result = await recovery.handleError(error, { circuitKey: key })
      expect(result.strategy).toBe(RecoveryStrategy.CIRCUIT_BREAKER)
    })

    it('should return skip strategy for validation errors', async () => {
      const error = new AppError('VALIDATION', 'bad input', ErrorCategory.VALIDATION, {
        severity: ErrorSeverity.LOW,
      })
      const result = await recovery.handleError(error)
      expect(result.strategy).toBe(RecoveryStrategy.SKIP)
    })

    it('should return terminate strategy for critical errors', async () => {
      const error = new AppError('CRITICAL', 'system down', ErrorCategory.SYSTEM, {
        severity: ErrorSeverity.CRITICAL,
      })
      const result = await recovery.handleError(error)
      expect(result.strategy).toBe(RecoveryStrategy.TERMINATE)
    })
  })

  describe('circuit breaker', () => {
    it('should start in closed state', () => {
      expect(recovery.getCircuitState('test')).toBe(CircuitState.CLOSED)
    })

    it('should open after threshold failures', async () => {
      const error = new LLMError('fail', 'glm')
      for (let i = 0; i < 5; i++) {
        await recovery.handleError(error, { circuitKey: 'test-circuit' })
      }
      expect(recovery.getCircuitState('test-circuit')).toBe(CircuitState.OPEN)
    })

    it('should transition to half-open after cooldown', async () => {
      const shortRecovery = new ErrorRecovery({ circuitCooldown: 10 })
      const error = new LLMError('fail', 'glm')
      for (let i = 0; i < 5; i++) {
        await shortRecovery.handleError(error, { circuitKey: 'fast-circuit' })
      }
      expect(shortRecovery.getCircuitState('fast-circuit')).toBe(CircuitState.OPEN)
      await new Promise(r => setTimeout(r, 20))
      expect(shortRecovery.getCircuitState('fast-circuit')).toBe(CircuitState.HALF_OPEN)
    })

    it('should reset circuit on success', async () => {
      const error = new LLMError('fail', 'glm')
      for (let i = 0; i < 5; i++) {
        await recovery.handleError(error, { circuitKey: 'reset-circuit' })
      }
      expect(recovery.getCircuitState('reset-circuit')).toBe(CircuitState.OPEN)
      recovery.recordSuccess('reset-circuit')
      expect(recovery.getCircuitState('reset-circuit')).toBe(CircuitState.CLOSED)
    })
  })

  describe('recovery stats', () => {
    it('should track recovery statistics', async () => {
      const error = new AgentError('fail', 'dev')
      await recovery.handleError(error)
      await recovery.handleError(error)
      const stats = recovery.getStats()
      expect(stats.totalErrors).toBe(2)
      expect(stats.errorsByCategory[ErrorCategory.AGENT]).toBe(2)
    })
  })

  describe('retryWithCircuitBreaker', () => {
    it('should return success on first attempt', async () => {
      const result = await recovery.retryWithCircuitBreaker({
        circuitKey: 'test',
        fn: async () => 'ok',
      })
      expect(result.success).toBe(true)
      expect(result.result).toBe('ok')
      expect(result.attempts).toBe(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      let callCount = 0
      const result = await recovery.retryWithCircuitBreaker({
        circuitKey: 'test',
        fn: async () => {
          callCount++
          if (callCount < 3) throw new AgentError('fail', 'dev')
          return 'recovered'
        },
        maxRetries: 3,
        initialDelay: 1,
      })
      expect(result.success).toBe(true)
      expect(result.result).toBe('recovered')
      expect(result.attempts).toBe(3)
    })

    it('should exhaust retries and return failure', async () => {
      const result = await recovery.retryWithCircuitBreaker({
        circuitKey: 'test',
        fn: async () => { throw new AgentError('always fail', 'dev') },
        maxRetries: 2,
        initialDelay: 1,
      })
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3)
      expect(result.error).toBeDefined()
    })

    it('should return fallback result when retries exhausted', async () => {
      const result = await recovery.retryWithCircuitBreaker({
        circuitKey: 'test',
        fn: async () => { throw new LLMError('LLM down', 'glm') },
        fallback: async () => 'fallback-value',
        maxRetries: 1,
        initialDelay: 1,
      })
      expect(result.success).toBe(true)
      expect(result.result).toBe('fallback-value')
      expect(result.usedFallback).toBe(true)
    })

    it('should trip circuit breaker after repeated failures', async () => {
      const failFn = async () => { throw new LLMError('fail', 'glm') }
      for (let i = 0; i < 5; i++) {
        await recovery.retryWithCircuitBreaker({
          circuitKey: 'breaker-test',
          fn: failFn,
          maxRetries: 0,
          initialDelay: 1,
        })
      }
      expect(recovery.getCircuitState('breaker-test')).toBe(CircuitState.OPEN)

      const result = await recovery.retryWithCircuitBreaker({
        circuitKey: 'breaker-test',
        fn: async () => 'should not run',
        maxRetries: 1,
        initialDelay: 1,
      })
      expect(result.success).toBe(false)
      expect(result.circuitOpen).toBe(true)
      expect(result.attempts).toBe(0)
    })

    it('should reset circuit on successful execution', async () => {
      let callCount = 0
      for (let i = 0; i < 5; i++) {
        await recovery.retryWithCircuitBreaker({
          circuitKey: 'reset-test',
          fn: async () => { throw new AgentError('fail', 'dev') },
          maxRetries: 0,
          initialDelay: 1,
        })
      }
      expect(recovery.getCircuitState('reset-test')).toBe(CircuitState.OPEN)

      const fastRecovery = new ErrorRecovery({ circuitCooldown: 1 })
      for (let i = 0; i < 5; i++) {
        await fastRecovery.retryWithCircuitBreaker({
          circuitKey: 'reset-test-2',
          fn: async () => { throw new AgentError('fail', 'dev') },
          maxRetries: 0,
          initialDelay: 1,
        })
      }
      await new Promise(r => setTimeout(r, 10))
      expect(fastRecovery.getCircuitState('reset-test-2')).toBe(CircuitState.HALF_OPEN)

      const successResult = await fastRecovery.retryWithCircuitBreaker({
        circuitKey: 'reset-test-2',
        fn: async () => 'healed',
        maxRetries: 1,
        initialDelay: 1,
      })
      expect(successResult.success).toBe(true)
      expect(fastRecovery.getCircuitState('reset-test-2')).toBe(CircuitState.CLOSED)
    })

    it('should respect maxDelay cap', async () => {
      const start = Date.now()
      const result = await recovery.retryWithCircuitBreaker({
        circuitKey: 'delay-test',
        fn: async () => { throw new AgentError('fail', 'dev') },
        maxRetries: 2,
        initialDelay: 5,
        maxDelay: 10,
      })
      const elapsed = Date.now() - start
      expect(result.success).toBe(false)
      expect(elapsed).toBeLessThan(100)
    })

    it('should not retry non-retryable errors', async () => {
      const criticalError = new AppError('FATAL', 'system down', ErrorCategory.SYSTEM, {
        severity: ErrorSeverity.CRITICAL,
      })
      let thrown = false
      const result = await recovery.retryWithCircuitBreaker({
        circuitKey: 'critical-test',
        fn: async () => { thrown = true; throw criticalError },
        maxRetries: 3,
        initialDelay: 1,
      })
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
      expect(thrown).toBe(true)
    })

    it('should track stats across retryWithCircuitBreaker calls', async () => {
      await recovery.retryWithCircuitBreaker({
        circuitKey: 'stats-test',
        fn: async () => { throw new AgentError('fail', 'dev') },
        maxRetries: 1,
        initialDelay: 1,
      })
      const stats = recovery.getStats()
      expect(stats.totalErrors).toBeGreaterThan(0)
      expect(stats.errorsByCategory[ErrorCategory.AGENT]).toBeGreaterThan(0)
    })

    it('should return attempts=0 with circuitOpen=true when circuit is open on entry', async () => {
      for (let i = 0; i < 5; i++) {
        await recovery.handleError(new AgentError('fail', 'dev'), { circuitKey: 'open-entry' })
      }
      expect(recovery.getCircuitState('open-entry')).toBe(CircuitState.OPEN)

      const result = await recovery.retryWithCircuitBreaker({
        circuitKey: 'open-entry',
        fn: async () => 'never',
        maxRetries: 3,
        initialDelay: 1,
      })
      expect(result.success).toBe(false)
      expect(result.circuitOpen).toBe(true)
      expect(result.attempts).toBe(0)
    })
  })
})
