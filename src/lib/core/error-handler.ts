import { AgentContext } from './types'

export type RecoveryType = 'retry' | 'fallback' | 'abort'

export interface RecoveryAction {
  type: RecoveryType
  params?: {
    maxRetries?: number
    delay?: number
    fallbackValue?: unknown
  }
}

export interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
}

const TRANSIENT_PATTERNS = [
  'timeout',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'connection',
  'network',
  'ECONNRESET',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH',
]

const FATAL_PATTERNS = [
  'authentication',
  'unauthorized',
  'invalid api key',
  '401',
  '403',
  'permission denied',
  'forbidden',
  'invalid credentials',
]

export class ErrorHandler {
  private defaultConfig: RetryConfig

  constructor(defaultConfig?: Partial<RetryConfig>) {
    this.defaultConfig = { ...DEFAULT_RETRY_CONFIG, ...defaultConfig }
  }

  handle(error: Error, context: AgentContext): RecoveryAction {
    const errorMessage = error.message.toLowerCase()

    if (this.isTransientError(errorMessage)) {
      const delay = this.calculateDelay(0)
      return {
        type: 'retry',
        params: {
          maxRetries: this.defaultConfig.maxRetries,
          delay,
        },
      }
    }

    if (this.isFatalError(errorMessage)) {
      return {
        type: 'abort',
        params: {},
      }
    }

    return {
      type: 'fallback',
      params: {
        fallbackValue: null,
      },
    }
  }

  async retry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const cfg = { ...this.defaultConfig, ...config }
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < cfg.maxRetries) {
          const delay = this.calculateDelay(attempt, cfg)
          await this.sleep(delay)
        }
      }
    }

    throw lastError
  }

  private isTransientError(message: string): boolean {
    return TRANSIENT_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()))
  }

  private isFatalError(message: string): boolean {
    return FATAL_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()))
  }

  private calculateDelay(attempt: number, config?: RetryConfig): number {
    const cfg = config || this.defaultConfig
    const delay = cfg.initialDelay * Math.pow(cfg.backoffMultiplier, attempt)
    return Math.min(delay, cfg.maxDelay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
