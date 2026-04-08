import {
  AppError,
  isAppError,
  toAppError,
  ErrorSeverity,
} from './errors'
import { CircuitState } from './error-recovery'

export interface UnifiedRetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export interface CircuitBreakerConfig {
  threshold: number
  cooldown: number
}

export interface RetryExecutorOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  circuitKey?: string
  fallback?: () => Promise<unknown>
  shouldRetry?: (error: Error) => boolean
  onSuccess?: (result: unknown, attempts: number) => void
  onRetry?: (error: Error, attempt: number, delay: number) => void
  onExhausted?: (error: Error, attempts: number) => void
}

export interface RetryResult<T = unknown> {
  success: boolean
  result?: T
  error?: AppError
  attempts: number
  circuitOpen?: boolean
  usedFallback?: boolean
}

export interface RetryStats {
  totalExecutions: number
  successfulExecutions: number
  totalRetries: number
}

const DEFAULT_CONFIG: UnifiedRetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  threshold: 5,
  cooldown: 30000,
}

interface CircuitBreaker {
  state: CircuitState
  failureCount: number
  lastFailureTime: number
}

export class UnifiedRetry {
  private readonly config: UnifiedRetryConfig
  private readonly circuitConfig: CircuitBreakerConfig
  private readonly circuits = new Map<string, CircuitBreaker>()
  private stats: RetryStats

  constructor(config?: Partial<UnifiedRetryConfig>, circuitConfig?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.circuitConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...circuitConfig }
    this.stats = { totalExecutions: 0, successfulExecutions: 0, totalRetries: 0 }
  }

  async execute<T>(fn: () => Promise<T>, options?: RetryExecutorOptions): Promise<RetryResult<T>> {
    this.stats.totalExecutions++

    const maxRetries = options?.maxRetries ?? this.config.maxRetries
    const initialDelay = options?.initialDelay ?? this.config.initialDelay
    const maxDelay = options?.maxDelay ?? this.config.maxDelay
    const backoffMultiplier = options?.backoffMultiplier ?? this.config.backoffMultiplier
    const circuitKey = options?.circuitKey

    if (circuitKey) {
      const state = this.getCircuitState(circuitKey)
      if (state === CircuitState.OPEN) {
        return { success: false, attempts: 0, circuitOpen: true }
      }
    }

    let lastError: AppError | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn()
        if (circuitKey) this.recordSuccess(circuitKey)
        this.stats.successfulExecutions++
        options?.onSuccess?.(result, attempt + 1)
        return { success: true, result, attempts: attempt + 1 }
      } catch (error) {
        const appError = toAppError(error)
        lastError = appError

        if (circuitKey) this.recordFailure(circuitKey)

        if (options?.shouldRetry && !options.shouldRetry(appError)) {
          return { success: false, error: appError, attempts: attempt + 1 }
        }

        if (!options?.shouldRetry && appError.severity === ErrorSeverity.CRITICAL) {
          return { success: false, error: appError, attempts: attempt + 1 }
        }

        if (attempt < maxRetries) {
          const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), maxDelay)
          this.stats.totalRetries++
          options?.onRetry?.(appError, attempt + 1, delay)
          await this.sleep(delay)
        }
      }
    }

    if (options?.fallback) {
      try {
        const result = await options.fallback()
        if (circuitKey) this.recordSuccess(circuitKey)
        this.stats.successfulExecutions++
        return { success: true, result: result as T, attempts: maxRetries + 1, usedFallback: true }
      } catch (fallbackError) {
        return { success: false, error: toAppError(fallbackError), attempts: maxRetries + 1, usedFallback: true }
      }
    }

    options?.onExhausted?.(lastError!, maxRetries + 1)
    return { success: false, error: lastError, attempts: maxRetries + 1 }
  }

  getCircuitState(key: string): CircuitState {
    const circuit = this.circuits.get(key)
    if (!circuit) return CircuitState.CLOSED
    if (circuit.state === CircuitState.OPEN) {
      const elapsed = Date.now() - circuit.lastFailureTime
      if (elapsed >= this.circuitConfig.cooldown) {
        circuit.state = CircuitState.HALF_OPEN
        this.circuits.set(key, circuit)
      }
    }
    return circuit.state
  }

  recordSuccess(key: string): void {
    this.circuits.set(key, {
      state: CircuitState.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
    })
  }

  getStats(): RetryStats {
    return { ...this.stats }
  }

  recordFailure(key: string): void {
    const circuit = this.circuits.get(key) ?? { state: CircuitState.CLOSED, failureCount: 0, lastFailureTime: 0 }
    circuit.failureCount++
    circuit.lastFailureTime = Date.now()
    if (circuit.failureCount >= this.circuitConfig.threshold) {
      circuit.state = CircuitState.OPEN
    }
    this.circuits.set(key, circuit)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
