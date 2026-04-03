export enum StructuredLogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

const LEVEL_NAMES: Record<StructuredLogLevel, string> = {
  [StructuredLogLevel.DEBUG]: 'DEBUG',
  [StructuredLogLevel.INFO]: 'INFO',
  [StructuredLogLevel.WARN]: 'WARN',
  [StructuredLogLevel.ERROR]: 'ERROR',
  [StructuredLogLevel.SILENT]: 'SILENT',
}

export interface StructuredLogEntry {
  timestamp: string
  level: StructuredLogLevel
  levelName: string
  message: string
  context: Record<string, unknown>
  traceId?: string
  spanId?: string
}

export interface StructuredLogTransport {
  log(entry: StructuredLogEntry): void
}

export interface StructuredLogFormatter {
  format(entry: StructuredLogEntry): string
}

export class JsonLogFormatter implements StructuredLogFormatter {
  format(entry: StructuredLogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.levelName,
      message: entry.message,
      context: entry.context,
      ...(entry.traceId ? { traceId: entry.traceId } : {}),
      ...(entry.spanId ? { spanId: entry.spanId } : {}),
    })
  }
}

export class TextLogFormatter implements StructuredLogFormatter {
  format(entry: StructuredLogEntry): string {
    const parts = [`[${entry.timestamp}]`, `[${entry.levelName}]`, entry.message]
    if (Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context))
    }
    if (entry.traceId) {
      parts.push(`traceId=${entry.traceId}`)
    }
    if (entry.spanId) {
      parts.push(`spanId=${entry.spanId}`)
    }
    return parts.join(' ')
  }
}

export interface StructuredLoggerOptions {
  minLevel?: StructuredLogLevel
  transports?: StructuredLogTransport[]
  context?: Record<string, unknown>
  traceId?: string
  spanId?: string
}

export class StructuredLogger {
  private minLevel: StructuredLogLevel
  private transports: StructuredLogTransport[]
  private baseContext: Record<string, unknown>
  private _traceId?: string
  private _spanId?: string

  constructor(options: StructuredLoggerOptions = {}) {
    this.minLevel = options.minLevel ?? (process.env.NODE_ENV === 'production' ? StructuredLogLevel.INFO : StructuredLogLevel.DEBUG)
    this.transports = options.transports ?? []
    this.baseContext = options.context ?? {}
    this._traceId = options.traceId
    this._spanId = options.spanId
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(StructuredLogLevel.DEBUG, message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(StructuredLogLevel.INFO, message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(StructuredLogLevel.WARN, message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(StructuredLogLevel.ERROR, message, context)
  }

  setLevel(level: StructuredLogLevel): void {
    this.minLevel = level
  }

  get traceId(): string | undefined {
    return this._traceId
  }

  get spanId(): string | undefined {
    return this._spanId
  }

  child(context: Record<string, unknown>, spanId?: string): StructuredLogger {
    return new StructuredLogger({
      minLevel: this.minLevel,
      transports: this.transports,
      context: { ...this.baseContext, ...context },
      traceId: this._traceId,
      spanId: spanId ?? this._spanId,
    })
  }

  private log(level: StructuredLogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.minLevel) return

    const mergedContext: Record<string, unknown> = { ...this.baseContext }
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (value instanceof Error) {
          mergedContext[key] = {
            name: value.name,
            message: value.message,
            stack: value.stack,
          }
        } else {
          mergedContext[key] = value
        }
      }
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelName: LEVEL_NAMES[level],
      message,
      context: mergedContext,
      traceId: this._traceId,
      spanId: this._spanId,
    }

    for (const transport of this.transports) {
      transport.log(entry)
    }
  }
}

export function createStructuredLogger(module: string, transports?: StructuredLogTransport[]): StructuredLogger {
  return new StructuredLogger({ context: { module }, transports })
}
