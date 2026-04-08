export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.SILENT]: 'SILENT',
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  levelName: string
  message: string
  context: Record<string, unknown>
  traceId?: string
  spanId?: string
}

export interface LogTransport {
  log(entry: LogEntry): void
}

export interface LogFormatter {
  format(entry: LogEntry): string
}

export class JsonLogFormatter implements LogFormatter {
  format(entry: LogEntry): string {
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

export class TextLogFormatter implements LogFormatter {
  format(entry: LogEntry): string {
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

export class ConsoleTransport implements LogTransport {
  private formatter: LogFormatter

  constructor(formatter: LogFormatter = new TextLogFormatter()) {
    this.formatter = formatter
  }

  log(entry: LogEntry): void {
    const formatted = this.formatter.format(entry)
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted)
        break
      case LogLevel.INFO:
        console.info(formatted)
        break
      case LogLevel.WARN:
        console.warn(formatted)
        break
      case LogLevel.ERROR:
      case LogLevel.SILENT:
        console.error(formatted)
        break
    }
  }
}

export interface LoggerOptions {
  minLevel?: LogLevel
  transports?: LogTransport[]
  context?: Record<string, unknown>
  traceId?: string
  spanId?: string
}

export class Logger {
  private minLevel: LogLevel
  private transports: LogTransport[]
  private baseContext: Record<string, unknown>
  private _traceId?: string
  private _spanId?: string

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG)
    this.transports = options.transports ?? [new ConsoleTransport()]
    this.baseContext = options.context ?? {}
    this._traceId = options.traceId
    this._spanId = options.spanId
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context)
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  get traceId(): string | undefined {
    return this._traceId
  }

  get spanId(): string | undefined {
    return this._spanId
  }

  child(context: Record<string, unknown>, spanId?: string): Logger {
    return new Logger({
      minLevel: this.minLevel,
      transports: this.transports,
      context: { ...this.baseContext, ...context },
      traceId: this._traceId,
      spanId: spanId ?? this._spanId,
    })
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
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

    const entry: LogEntry = {
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

export function createLogger(module: string, transports?: LogTransport[]): Logger {
  return new Logger({ context: { module }, transports })
}

export const logger = new Logger()
