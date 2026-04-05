import { UnifiedRetry, RetryExecutorOptions } from '../unified-retry'
import { CircuitState } from '../error-recovery'
import { AppError, AgentError, LLMError, ErrorCategory, ErrorSeverity } from '../errors'

describe('UnifiedRetry', () => {
  let retry: UnifiedRetry

  beforeEach(() => {
    retry = new UnifiedRetry()
  })

  describe('basic retry', () => {
    it('should return success on first attempt', async () => {
      const result = await retry.execute(async () => 'ok')
      expect(result.success).toBe(true)
      expect(result.result).toBe('ok')
      expect(result.attempts).toBe(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      let callCount = 0
      const result = await retry.execute(
        async () => {
          callCount++
          if (callCount < 3) throw new AgentError('fail', 'dev')
          return 'recovered'
        },
        { maxRetries: 3, initialDelay: 1 }
      )
      expect(result.success).toBe(true)
      expect(result.result).toBe('recovered')
      expect(result.attempts).toBe(3)
    })

    it('should exhaust retries and return failure', async () => {
      const result = await retry.execute(
        async () => { throw new AgentError('always fail', 'dev') },
        { maxRetries: 2, initialDelay: 1 }
      )
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3)
      expect(result.error).toBeDefined()
    })

    it('should use default config from constructor', async () => {
      const customRetry = new UnifiedRetry({ maxRetries: 1, initialDelay: 1, maxDelay: 5, backoffMultiplier: 1 })
      const result = await customRetry.execute(
        async () => { throw new Error('fail') }
      )
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(2)
    })

    it('should allow per-execute config to override constructor config', async () => {
      const customRetry = new UnifiedRetry({ maxRetries: 5, initialDelay: 1 })
      const result = await customRetry.execute(
        async () => { throw new Error('fail') },
        { maxRetries: 1 }
      )
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(2)
    })
  })

  describe('exponential backoff', () => {
    it('should calculate delay with exponential backoff capped at maxDelay', async () => {
      const start = Date.now()
      const result = await retry.execute(
        async () => { throw new AgentError('fail', 'dev') },
        { maxRetries: 2, initialDelay: 5, maxDelay: 10, backoffMultiplier: 2 }
      )
      const elapsed = Date.now() - start
      expect(result.success).toBe(false)
      expect(elapsed).toBeLessThan(100)
    })

    it('should use backoffMultiplier correctly', async () => {
      const delays: number[] = []
      const start = Date.now()
      let attempt = 0

      await retry.execute(
        async () => {
          const now = Date.now()
          if (attempt > 0) delays.push(now - start)
          attempt++
          throw new Error('fail')
        },
        { maxRetries: 2, initialDelay: 10, maxDelay: 1000, backoffMultiplier: 3 }
      )

      expect(delays.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('circuit breaker', () => {
    it('should start in closed state', () => {
      expect(retry.getCircuitState('test')).toBe(CircuitState.CLOSED)
    })

    it('should open circuit after threshold failures', async () => {
      const breakerRetry = new UnifiedRetry(undefined, { threshold: 3, cooldown: 30000 })
      for (let i = 0; i < 3; i++) {
        await breakerRetry.execute(
          async () => { throw new AgentError('fail', 'dev') },
          { maxRetries: 0, initialDelay: 1, circuitKey: 'test-circuit' }
        )
      }
      expect(breakerRetry.getCircuitState('test-circuit')).toBe(CircuitState.OPEN)
    })

    it('should skip execution when circuit is open', async () => {
      const breakerRetry = new UnifiedRetry(undefined, { threshold: 2, cooldown: 30000 })
      for (let i = 0; i < 2; i++) {
        await breakerRetry.execute(
          async () => { throw new Error('fail') },
          { maxRetries: 0, initialDelay: 1, circuitKey: 'blocked' }
        )
      }
      expect(breakerRetry.getCircuitState('blocked')).toBe(CircuitState.OPEN)

      let fnCalled = false
      const result = await breakerRetry.execute(
        async () => { fnCalled = true; return 'never' },
        { maxRetries: 1, initialDelay: 1, circuitKey: 'blocked' }
      )
      expect(result.success).toBe(false)
      expect(result.circuitOpen).toBe(true)
      expect(result.attempts).toBe(0)
      expect(fnCalled).toBe(false)
    })

    it('should transition to half-open after cooldown', async () => {
      const fastRetry = new UnifiedRetry(undefined, { threshold: 2, cooldown: 10 })
      for (let i = 0; i < 2; i++) {
        await fastRetry.execute(
          async () => { throw new Error('fail') },
          { maxRetries: 0, initialDelay: 1, circuitKey: 'fast-circuit' }
        )
      }
      expect(fastRetry.getCircuitState('fast-circuit')).toBe(CircuitState.OPEN)

      await new Promise(r => setTimeout(r, 20))
      expect(fastRetry.getCircuitState('fast-circuit')).toBe(CircuitState.HALF_OPEN)
    })

    it('should reset circuit on successful execution', async () => {
      const breakerRetry = new UnifiedRetry(undefined, { threshold: 2, cooldown: 1 })
      for (let i = 0; i < 2; i++) {
        await breakerRetry.execute(
          async () => { throw new Error('fail') },
          { maxRetries: 0, initialDelay: 1, circuitKey: 'reset-circuit' }
        )
      }
      expect(breakerRetry.getCircuitState('reset-circuit')).toBe(CircuitState.OPEN)

      await new Promise(r => setTimeout(r, 10))

      await breakerRetry.execute(
        async () => 'healed',
        { maxRetries: 1, initialDelay: 1, circuitKey: 'reset-circuit' }
      )
      expect(breakerRetry.getCircuitState('reset-circuit')).toBe(CircuitState.CLOSED)
    })

    it('should record success via recordSuccess method', () => {
      const breakerRetry = new UnifiedRetry(undefined, { threshold: 2, cooldown: 30000 })
      breakerRetry.recordSuccess('manual-key')
      expect(breakerRetry.getCircuitState('manual-key')).toBe(CircuitState.CLOSED)
    })

    it('should not affect circuits when no circuitKey is provided', async () => {
      for (let i = 0; i < 10; i++) {
        await retry.execute(
          async () => { throw new Error('fail') },
          { maxRetries: 0, initialDelay: 1 }
        )
      }
      expect(retry.getCircuitState('any-key')).toBe(CircuitState.CLOSED)
    })
  })

  describe('fallback', () => {
    it('should use fallback when retries exhausted', async () => {
      const result = await retry.execute(
        async () => { throw new LLMError('LLM down', 'glm') },
        {
          maxRetries: 1,
          initialDelay: 1,
          fallback: async () => 'fallback-value',
        }
      )
      expect(result.success).toBe(true)
      expect(result.result).toBe('fallback-value')
      expect(result.usedFallback).toBe(true)
    })

    it('should return failure when fallback also fails', async () => {
      const result = await retry.execute(
        async () => { throw new Error('primary fail') },
        {
          maxRetries: 0,
          initialDelay: 1,
          fallback: async () => { throw new Error('fallback fail') },
        }
      )
      expect(result.success).toBe(false)
      expect(result.usedFallback).toBe(true)
      expect(result.error).toBeDefined()
    })

    it('should record success on fallback when circuitKey is set', async () => {
      const breakerRetry = new UnifiedRetry(undefined, { threshold: 2, cooldown: 30000 })
      const result = await breakerRetry.execute(
        async () => { throw new Error('fail') },
        {
          maxRetries: 0,
          initialDelay: 1,
          circuitKey: 'fallback-circuit',
          fallback: async () => 'saved',
        }
      )
      expect(result.success).toBe(true)
      expect(breakerRetry.getCircuitState('fallback-circuit')).toBe(CircuitState.CLOSED)
    })
  })

  describe('shouldRetry callback', () => {
    it('should not retry when shouldRetry returns false', async () => {
      const criticalError = new AppError('FATAL', 'system down', ErrorCategory.SYSTEM, {
        severity: ErrorSeverity.CRITICAL,
      })
      const result = await retry.execute(
        async () => { throw criticalError },
        {
          maxRetries: 3,
          initialDelay: 1,
          shouldRetry: (error) => {
            return error instanceof AppError ? error.severity !== ErrorSeverity.CRITICAL : true
          },
        }
      )
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
    })

    it('should retry when shouldRetry returns true', async () => {
      let callCount = 0
      const result = await retry.execute(
        async () => {
          callCount++
          throw new AgentError('retryable', 'dev')
        },
        {
          maxRetries: 2,
          initialDelay: 1,
          shouldRetry: () => true,
        }
      )
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3)
    })
  })

  describe('hooks', () => {
    it('should call onSuccess hook', async () => {
      const onSuccess = jest.fn()
      await retry.execute(
        async () => 'result',
        { onSuccess }
      )
      expect(onSuccess).toHaveBeenCalledWith('result', 1)
    })

    it('should call onRetry hook for each retry', async () => {
      const onRetry = jest.fn()
      let callCount = 0
      await retry.execute(
        async () => {
          callCount++
          if (callCount < 3) throw new Error('fail')
          return 'ok'
        },
        { maxRetries: 3, initialDelay: 1, onRetry }
      )
      expect(onRetry).toHaveBeenCalledTimes(2)
    })

    it('should call onExhausted hook when retries run out', async () => {
      const onExhausted = jest.fn()
      await retry.execute(
        async () => { throw new Error('exhausted') },
        { maxRetries: 1, initialDelay: 1, onExhausted }
      )
      expect(onExhausted).toHaveBeenCalledTimes(1)
      expect(onExhausted).toHaveBeenCalledWith(expect.any(Error), 2)
    })

    it('should not call onExhausted when fallback succeeds', async () => {
      const onExhausted = jest.fn()
      await retry.execute(
        async () => { throw new Error('fail') },
        { maxRetries: 0, initialDelay: 1, fallback: async () => 'saved', onExhausted }
      )
      expect(onExhausted).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should convert non-Error throws to AppError', async () => {
      const result = await retry.execute(
        async () => { throw 'string error' },
        { maxRetries: 0, initialDelay: 1 }
      )
      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(AppError)
    })

    it('should preserve AppError instances', async () => {
      const agentError = new AgentError('task failed', 'dev', { taskId: 't1' })
      const result = await retry.execute(
        async () => { throw agentError },
        { maxRetries: 0, initialDelay: 1 }
      )
      expect(result.error).toBe(agentError)
    })
  })

  describe('getStats', () => {
    it('should track retry statistics', async () => {
      await retry.execute(
        async () => { throw new AgentError('fail', 'dev') },
        { maxRetries: 1, initialDelay: 1 }
      )
      const stats = retry.getStats()
      expect(stats.totalRetries).toBe(1)
      expect(stats.totalExecutions).toBe(1)
    })

    it('should track successful executions', async () => {
      await retry.execute(async () => 'ok')
      const stats = retry.getStats()
      expect(stats.totalExecutions).toBe(1)
      expect(stats.successfulExecutions).toBe(1)
    })
  })
})
