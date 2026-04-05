import {
  ErrorRecovery,
  RecoveryStrategy,
  CircuitState,
} from '../error-recovery'
import {
  AppError,
  AgentError,
  LLMError,
  GatewayError,
  NetworkError,
  ErrorCategory,
  ErrorSeverity,
} from '../errors'

describe('ErrorRecovery - 未覆盖的错误处理分支', () => {
  let recovery: ErrorRecovery

  beforeEach(() => {
    recovery = new ErrorRecovery()
  })

  describe('resolveStrategy 边界情况', () => {
    it('应该对 Gateway 错误 + fallback 使用 FALLBACK 策略', async () => {
      const error = new GatewayError('gateway timeout')
      const result = await recovery.handleError(error, {
        fallback: async () => 'gateway fallback',
      })
      expect(result.strategy).toBe(RecoveryStrategy.FALLBACK)
      expect(result.recovered).toBe(true)
      expect(result.result).toBe('gateway fallback')
    })

    it('应该对 LLM 错误无 fallback 时使用 RETRY', async () => {
      const error = new LLMError('api limit', 'glm')
      const result = await recovery.handleError(error)
      expect(result.strategy).toBe(RecoveryStrategy.RETRY)
      expect(result.recovered).toBe(false)
    })

    it('应该对 NETWORK 错误使用 RETRY', async () => {
      const error = new NetworkError('connection reset')
      const result = await recovery.handleError(error)
      expect(result.strategy).toBe(RecoveryStrategy.RETRY)
    })

    it('应该对 SYSTEM 非 CRITICAL 错误使用 RETRY', async () => {
      const error = new AppError('SYS_ERR', 'system glitch', ErrorCategory.SYSTEM, {
        severity: ErrorSeverity.MEDIUM,
      })
      const result = await recovery.handleError(error)
      expect(result.strategy).toBe(RecoveryStrategy.RETRY)
    })

    it('应该对 UNKNOWN 类别错误使用 RETRY（默认分支）', async () => {
      const error = new AppError('UNKNOWN', 'unknown error', ErrorCategory.UNKNOWN, {
        severity: ErrorSeverity.LOW,
      })
      const result = await recovery.handleError(error)
      expect(result.strategy).toBe(RecoveryStrategy.RETRY)
    })
  })

  describe('FALLBACK 策略细节', () => {
    it('应该在 fallback 抛出异常时标记为未恢复', async () => {
      const error = new LLMError('api fail', 'glm')
      const result = await recovery.handleError(error, {
        fallback: async () => { throw new Error('fallback also failed') },
      })
      expect(result.strategy).toBe(RecoveryStrategy.FALLBACK)
      expect(result.recovered).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('应该在 FALLBACK 无回调时标记为未恢复', async () => {
      const error = new LLMError('api fail', 'glm')
      const result = await recovery.handleError(error, { fallback: undefined })
      expect(result.strategy).toBe(RecoveryStrategy.RETRY)
      expect(result.recovered).toBe(false)
    })

    it('应该在 fallback 成功时记录 circuitKey 成功', async () => {
      const error = new LLMError('fail', 'glm')
      const result = await recovery.handleError(error, {
        circuitKey: 'fallback-circuit',
        fallback: async () => 'recovered',
      })
      expect(result.recovered).toBe(true)
      expect(recovery.getCircuitState('fallback-circuit')).toBe(CircuitState.CLOSED)
    })
  })

  describe('无 circuitKey 时的行为', () => {
    it('应该在不传 circuitKey 时正常处理', async () => {
      const error = new AgentError('agent fail', 'dev')
      const result = await recovery.handleError(error)
      expect(result.strategy).toBe(RecoveryStrategy.RETRY)
      expect(result.recovered).toBe(false)
    })
  })

  describe('统计信息', () => {
    it('应该正确按类别统计错误', async () => {
      await recovery.handleError(new AgentError('a', 'dev'))
      await recovery.handleError(new LLMError('l', 'glm'))
      await recovery.handleError(new NetworkError('n'))

      const stats = recovery.getStats()
      expect(stats.totalErrors).toBe(3)
      expect(stats.errorsByCategory[ErrorCategory.AGENT]).toBe(1)
      expect(stats.errorsByCategory[ErrorCategory.LLM]).toBe(1)
      expect(stats.errorsByCategory[ErrorCategory.NETWORK]).toBe(1)
    })

    it('应该按策略统计恢复次数', async () => {
      await recovery.handleError(new AppError('V', 'v', ErrorCategory.VALIDATION, { severity: ErrorSeverity.LOW }))
      await recovery.handleError(new AppError('C', 'c', ErrorCategory.SYSTEM, { severity: ErrorSeverity.CRITICAL }))
      await recovery.handleError(new AgentError('a', 'dev'))

      const stats = recovery.getStats()
      expect(stats.recoveriesByStrategy[RecoveryStrategy.SKIP]).toBe(1)
      expect(stats.recoveriesByStrategy[RecoveryStrategy.TERMINATE]).toBe(1)
      expect(stats.recoveriesByStrategy[RecoveryStrategy.RETRY]).toBe(1)
    })
  })
})
