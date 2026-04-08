export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  SYSTEM = 'system',
  VALIDATION = 'validation',
  AGENT = 'agent',
  LLM = 'llm',
  ORCHESTRATOR = 'orchestrator',
  FILESYSTEM = 'filesystem',
  GATEWAY = 'gateway',
  NETWORK = 'network',
}

export interface AppErrorOptions {
  severity?: ErrorSeverity
  context?: Record<string, unknown>
  cause?: Error
}

export class AppError extends Error {
  readonly code: string
  readonly category: ErrorCategory
  readonly severity: ErrorSeverity
  readonly timestamp: Date
  readonly context: Record<string, unknown>
  readonly cause?: Error

  constructor(
    code: string,
    message: string,
    category: ErrorCategory,
    options: AppErrorOptions = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.category = category
    this.severity = options.severity ?? ErrorSeverity.MEDIUM
    this.timestamp = new Date()
    this.context = options.context ?? {}
    this.cause = options.cause
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      cause: this.cause?.message,
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, ErrorCategory.VALIDATION, {
      severity: ErrorSeverity.LOW,
      context,
    })
    this.name = 'ValidationError'
  }
}

export class AgentError extends AppError {
  constructor(message: string, agentRole: string, context?: Record<string, unknown>) {
    super('AGENT_ERROR', message, ErrorCategory.AGENT, {
      severity: ErrorSeverity.MEDIUM,
      context: { ...context, agentRole },
    })
    this.name = 'AgentError'
  }
}

export class LLMError extends AppError {
  constructor(message: string, provider: string, context?: Record<string, unknown>) {
    const isRateLimit = context?.isRateLimit === true
    super('LLM_ERROR', message, ErrorCategory.LLM, {
      severity: isRateLimit ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
      context: { ...context, provider },
    })
    this.name = 'LLMError'
  }
}

export class OrchestratorError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('ORCHESTRATOR_ERROR', message, ErrorCategory.ORCHESTRATOR, {
      severity: ErrorSeverity.HIGH,
      context,
    })
    this.name = 'OrchestratorError'
  }
}

export class FileSystemError extends AppError {
  constructor(message: string, path?: string, options?: AppErrorOptions) {
    super('FILESYSTEM_ERROR', message, ErrorCategory.FILESYSTEM, {
      severity: ErrorSeverity.MEDIUM,
      ...options,
      context: { ...options?.context, path },
    })
    this.name = 'FileSystemError'
  }
}

export class GatewayError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('GATEWAY_ERROR', message, ErrorCategory.GATEWAY, {
      severity: ErrorSeverity.HIGH,
      context,
    })
    this.name = 'GatewayError'
  }
}

export class NetworkError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('NETWORK_ERROR', message, ErrorCategory.NETWORK, {
      severity: ErrorSeverity.HIGH,
      context,
    })
    this.name = 'NetworkError'
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  if (error instanceof Error) {
    return new AppError('UNKNOWN_ERROR', error.message, ErrorCategory.SYSTEM, { cause: error })
  }
  if (typeof error === 'string') {
    return new AppError('UNKNOWN_ERROR', error, ErrorCategory.SYSTEM)
  }
  return new AppError('UNKNOWN_ERROR', 'Unknown error', ErrorCategory.SYSTEM)
}
