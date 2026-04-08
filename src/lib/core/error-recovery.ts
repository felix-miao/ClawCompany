import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  toAppError,
} from './errors'
import { logger } from './logger'
import { UnifiedRetry } from './unified-retry'

export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  SKIP = 'skip',
  CIRCUIT_BREAKER = 'circuit_breaker',
  TERMINATE = 'terminate',
}

export interface RecoveryResult {
  strategy: RecoveryStrategy
  recovered: boolean
  result?: unknown
  error?: AppError
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface ErrorRecoveryOptions {
  circuitThreshold?: number
  circuitCooldown?: number
}

export interface RetryOptions {
  circuitKey: string
  fn: () => Promise<unknown>
  fallback?: () => Promise<unknown>
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
}

export interface RetryResult {
  success: boolean
  result?: unknown
  error?: AppError
  attempts: number
  usedFallback?: boolean
  circuitOpen?: boolean
}

interface RecoveryStats {
  totalErrors: number
  errorsByCategory: Record<string, number>
  recoveriesByStrategy: Record<string, number>
}

export class ErrorRecovery {
  private readonly retry: UnifiedRetry
  private stats: RecoveryStats

  constructor(options?: ErrorRecoveryOptions) {
    this.retry = new UnifiedRetry(undefined, {
      threshold: options?.circuitThreshold ?? 5,
      cooldown: options?.circuitCooldown ?? 30000,
    })
    this.stats = { totalErrors: 0, errorsByCategory: {}, recoveriesByStrategy: {} }
  }

  async handleError(
    error: unknown,
    options?: {
      circuitKey?: string
      fallback?: () => Promise<unknown>
    }
  ): Promise<RecoveryResult> {
    const appError = toAppError(error)

    this.trackError(appError)

    logger.error(`Error handled: ${appError.message}`, {
      code: appError.code,
      category: appError.category,
      severity: appError.severity,
    })

    const circuitKey = options?.circuitKey
    if (circuitKey) {
      this.retry.recordFailure(circuitKey)
      const circuitState = this.retry.getCircuitState(circuitKey)
      if (circuitState === CircuitState.OPEN) {
        this.recordStrategy(RecoveryStrategy.CIRCUIT_BREAKER)
        return { strategy: RecoveryStrategy.CIRCUIT_BREAKER, recovered: false, error: appError }
      }
    }

    const strategy = this.resolveStrategy(appError, options)
    this.recordStrategy(strategy)

    switch (strategy) {
      case RecoveryStrategy.FALLBACK: {
        if (options?.fallback) {
          try {
            const result = await options.fallback()
            if (circuitKey) this.retry.recordSuccess(circuitKey)
            return { strategy, recovered: true, result }
          } catch (fallbackError) {
            return { strategy, recovered: false, error: toAppError(fallbackError) }
          }
        }
        return { strategy, recovered: false, error: appError }
      }

      case RecoveryStrategy.RETRY:
        return { strategy, recovered: false, error: appError }

      case RecoveryStrategy.SKIP:
        return { strategy, recovered: true, error: appError }

      case RecoveryStrategy.TERMINATE:
        return { strategy, recovered: false, error: appError }

      default:
        return { strategy, recovered: false, error: appError }
    }
  }

  private resolveStrategy(
    error: AppError,
    options?: { fallback?: () => Promise<unknown> }
  ): RecoveryStrategy {
    if (error.severity === ErrorSeverity.CRITICAL) {
      return RecoveryStrategy.TERMINATE
    }

    if (error.category === ErrorCategory.VALIDATION) {
      return RecoveryStrategy.SKIP
    }

    if (options?.fallback && (error.category === ErrorCategory.LLM || error.category === ErrorCategory.GATEWAY)) {
      return RecoveryStrategy.FALLBACK
    }

    if (
      error.category === ErrorCategory.AGENT ||
      error.category === ErrorCategory.LLM ||
      error.category === ErrorCategory.NETWORK ||
      error.category === ErrorCategory.GATEWAY
    ) {
      return RecoveryStrategy.RETRY
    }

    return RecoveryStrategy.RETRY
  }

  recordSuccess(key: string): void {
    this.retry.recordSuccess(key)
  }

  getCircuitState(key: string): CircuitState {
    return this.retry.getCircuitState(key)
  }

  private recordStrategy(strategy: RecoveryStrategy): void {
    this.stats.recoveriesByStrategy[strategy] = (this.stats.recoveriesByStrategy[strategy] ?? 0) + 1
  }

  private trackError(appError: AppError): void {
    this.stats.totalErrors++
    this.stats.errorsByCategory[appError.category] = (this.stats.errorsByCategory[appError.category] ?? 0) + 1
  }

  getStats(): RecoveryStats {
    return { ...this.stats }
  }

  async retryWithCircuitBreaker(options: RetryOptions): Promise<RetryResult> {
    const { circuitKey, fn, fallback, maxRetries, initialDelay, maxDelay, backoffMultiplier } = options

    const wrappedFn = async () => {
      try {
        return await fn()
      } catch (error) {
        this.trackError(toAppError(error))
        throw error
      }
    }

    const result = await this.retry.execute(wrappedFn, {
      circuitKey,
      fallback,
      maxRetries,
      initialDelay,
      maxDelay,
      backoffMultiplier,
    })

    return {
      success: result.success,
      result: result.result,
      error: result.error,
      attempts: result.attempts,
      usedFallback: result.usedFallback,
      circuitOpen: result.circuitOpen,
    }
  }
}
