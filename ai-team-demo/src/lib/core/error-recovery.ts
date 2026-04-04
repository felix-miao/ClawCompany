import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  isAppError,
  toAppError,
} from './errors'
import { logger } from './logger'

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

interface CircuitBreaker {
  state: CircuitState
  failureCount: number
  lastFailureTime: number
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
  private circuits = new Map<string, CircuitBreaker>()
  private readonly circuitThreshold: number
  private readonly circuitCooldown: number
  private stats: RecoveryStats

  constructor(options?: ErrorRecoveryOptions) {
    this.circuitThreshold = options?.circuitThreshold ?? 5
    this.circuitCooldown = options?.circuitCooldown ?? 30000
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

    this.stats.totalErrors++
    const cat = appError.category
    this.stats.errorsByCategory[cat] = (this.stats.errorsByCategory[cat] ?? 0) + 1

    logger.error(`Error handled: ${appError.message}`, {
      code: appError.code,
      category: appError.category,
      severity: appError.severity,
    })

    const circuitKey = options?.circuitKey
    if (circuitKey) {
      this.recordFailure(circuitKey)
      const circuitState = this.getCircuitState(circuitKey)
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
            if (circuitKey) this.recordSuccess(circuitKey)
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
      error.category === ErrorCategory.NETWORK
    ) {
      return RecoveryStrategy.RETRY
    }

    return RecoveryStrategy.RETRY
  }

  private recordFailure(key: string): void {
    const circuit = this.circuits.get(key) ?? { state: CircuitState.CLOSED, failureCount: 0, lastFailureTime: 0 }
    circuit.failureCount++
    circuit.lastFailureTime = Date.now()
    if (circuit.failureCount >= this.circuitThreshold) {
      circuit.state = CircuitState.OPEN
    }
    this.circuits.set(key, circuit)
  }

  recordSuccess(key: string): void {
    this.circuits.set(key, {
      state: CircuitState.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
    })
  }

  getCircuitState(key: string): CircuitState {
    const circuit = this.circuits.get(key)
    if (!circuit) return CircuitState.CLOSED
    if (circuit.state === CircuitState.OPEN) {
      const elapsed = Date.now() - circuit.lastFailureTime
      if (elapsed >= this.circuitCooldown) {
        circuit.state = CircuitState.HALF_OPEN
        this.circuits.set(key, circuit)
      }
    }
    return circuit.state
  }

  private recordStrategy(strategy: RecoveryStrategy): void {
    this.stats.recoveriesByStrategy[strategy] = (this.stats.recoveriesByStrategy[strategy] ?? 0) + 1
  }

  getStats(): RecoveryStats {
    return { ...this.stats }
  }

  async retryWithCircuitBreaker(options: RetryOptions): Promise<RetryResult> {
    const {
      circuitKey,
      fn,
      fallback,
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
    } = options

    const circuitState = this.getCircuitState(circuitKey)
    if (circuitState === CircuitState.OPEN) {
      return { success: false, attempts: 0, circuitOpen: true }
    }

    let lastError: AppError | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn()
        this.recordSuccess(circuitKey)
        return { success: true, result, attempts: attempt + 1 }
      } catch (error) {
        const appError = toAppError(error)
        lastError = appError
        this.stats.totalErrors++
        this.stats.errorsByCategory[appError.category] = (this.stats.errorsByCategory[appError.category] ?? 0) + 1
        this.recordFailure(circuitKey)

        if (appError.severity === ErrorSeverity.CRITICAL) {
          return { success: false, error: appError, attempts: attempt + 1 }
        }

        if (attempt < maxRetries) {
          const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), maxDelay)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    if (fallback) {
      try {
        const result = await fallback()
        this.recordSuccess(circuitKey)
        return { success: true, result, attempts: maxRetries + 1, usedFallback: true }
      } catch (fallbackError) {
        return { success: false, error: toAppError(fallbackError), attempts: maxRetries + 1, usedFallback: true }
      }
    }

    return { success: false, error: lastError, attempts: maxRetries + 1 }
  }
}
