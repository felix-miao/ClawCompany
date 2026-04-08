import { AppError, ErrorCategory, ErrorSeverity, isAppError } from './errors'

export interface ErrorFingerprint {
  name: string
  message: string
  code: string | undefined
  category: ErrorCategory | undefined
}

export interface TrackedError {
  id: string
  timestamp: string
  name: string
  message: string
  code: string | undefined
  category: ErrorCategory | undefined
  severity: ErrorSeverity | undefined
  stack: string | undefined
  context: Record<string, unknown>
  fingerprint: ErrorFingerprint
}

export interface ErrorAggregate {
  fingerprint: ErrorFingerprint
  count: number
  firstSeen: string
  lastSeen: string
  severity: ErrorSeverity | undefined
  category: ErrorCategory | undefined
  sample: TrackedError
}

export interface ErrorSummary {
  total: number
  byCategory: Partial<Record<ErrorCategory, number>>
  bySeverity: Partial<Record<ErrorSeverity, number>>
}

export interface ErrorTrackerConfig {
  maxErrors?: number
}

function generateId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function buildFingerprint(error: Error): ErrorFingerprint {
  if (isAppError(error)) {
    const appErr = error as AppError
    return {
      name: appErr.name,
      message: appErr.message,
      code: appErr.code,
      category: appErr.category,
    }
  }
  return {
    name: error.name,
    message: error.message,
    code: undefined,
    category: undefined,
  }
}

function fingerprintKey(fp: ErrorFingerprint): string {
  return `${fp.name}::${fp.message}::${fp.code ?? ''}::${fp.category ?? ''}`
}

export class ErrorTracker {
  private errors: TrackedError[] = []
  private aggregates: Map<string, ErrorAggregate> = new Map()
  private maxErrors: number

  constructor(config: ErrorTrackerConfig = {}) {
    this.maxErrors = config.maxErrors ?? Infinity
  }

  track(error: Error, context?: Record<string, unknown>): TrackedError {
    const fingerprint = buildFingerprint(error)

    let trackedContext: Record<string, unknown> = {}
    if (isAppError(error)) {
      const appErr = error as AppError
      trackedContext = { ...appErr.context }
    }
    if (context) {
      trackedContext = { ...trackedContext, ...context }
    }

    const tracked: TrackedError = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      name: error.name,
      message: error.message,
      code: isAppError(error) ? (error as AppError).code : undefined,
      category: isAppError(error) ? (error as AppError).category : undefined,
      severity: isAppError(error) ? (error as AppError).severity : undefined,
      stack: error.stack,
      context: trackedContext,
      fingerprint,
    }

    this.errors.unshift(tracked)

    if (this.errors.length > this.maxErrors) {
      const evicted = this.errors.pop()!
      this.removeFromAggregate(evicted)
    }

    this.updateAggregate(tracked)

    return tracked
  }

  getAll(options?: { limit?: number }): TrackedError[] {
    const result = [...this.errors]
    if (options?.limit) {
      return result.slice(0, options.limit)
    }
    return result
  }

  getCount(): number {
    return this.errors.length
  }

  getBySeverity(severity: ErrorSeverity): TrackedError[] {
    return this.errors.filter(e => e.severity === severity)
  }

  getByCategory(category: ErrorCategory): TrackedError[] {
    return this.errors.filter(e => e.category === category)
  }

  getCountBySeverity(severity: ErrorSeverity): number {
    return this.getBySeverity(severity).length
  }

  getAggregates(): ErrorAggregate[] {
    return Array.from(this.aggregates.values()).sort(
      (a, b) => b.count - a.count
    )
  }

  getSummary(): ErrorSummary {
    const byCategory: Partial<Record<ErrorCategory, number>> = {}
    const bySeverity: Partial<Record<ErrorSeverity, number>> = {}

    for (const err of this.errors) {
      if (err.category) {
        byCategory[err.category] = (byCategory[err.category] ?? 0) + 1
      }
      if (err.severity) {
        bySeverity[err.severity] = (bySeverity[err.severity] ?? 0) + 1
      }
    }

    return {
      total: this.errors.length,
      byCategory,
      bySeverity,
    }
  }

  clear(): void {
    this.errors = []
    this.aggregates.clear()
  }

  private updateAggregate(tracked: TrackedError): void {
    const key = fingerprintKey(tracked.fingerprint)
    const existing = this.aggregates.get(key)

    if (existing) {
      existing.count++
      existing.lastSeen = tracked.timestamp
    } else {
      this.aggregates.set(key, {
        fingerprint: tracked.fingerprint,
        count: 1,
        firstSeen: tracked.timestamp,
        lastSeen: tracked.timestamp,
        severity: tracked.severity,
        category: tracked.category,
        sample: tracked,
      })
    }
  }

  private removeFromAggregate(tracked: TrackedError): void {
    const key = fingerprintKey(tracked.fingerprint)
    const existing = this.aggregates.get(key)
    if (existing) {
      existing.count--
      if (existing.count <= 0) {
        this.aggregates.delete(key)
      }
    }
  }
}
