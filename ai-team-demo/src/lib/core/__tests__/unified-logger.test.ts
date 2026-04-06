import {
  Logger,
  LogLevel,
  LogEntry,
  LogTransport,
  LogFormatter,
  JsonLogFormatter,
  TextLogFormatter,
  ConsoleTransport,
  createLogger,
  logger,
} from '../logger'
import {
  StructuredLogger,
  StructuredLogLevel,
  StructuredLogEntry,
  StructuredLogTransport,
  StructuredLogFormatter,
  JsonLogFormatter as JsonLogFormatterCompat,
  TextLogFormatter as TextLogFormatterCompat,
  createStructuredLogger,
} from '../structured-logger'

describe('Unified Logger', () => {
  let capturedLogs: LogEntry[] = []
  let testTransport: LogTransport

  beforeEach(() => {
    capturedLogs = []
    testTransport = {
      log: (entry: LogEntry) => { capturedLogs.push(entry) },
    }
  })

  describe('log levels', () => {
    it('should log at DEBUG level with levelName', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.debug('debug message')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe(LogLevel.DEBUG)
      expect(capturedLogs[0].levelName).toBe('DEBUG')
    })

    it('should log at INFO level', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.info('info message')
      expect(capturedLogs[0].level).toBe(LogLevel.INFO)
      expect(capturedLogs[0].levelName).toBe('INFO')
    })

    it('should log at WARN level', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.warn('warn message')
      expect(capturedLogs[0].level).toBe(LogLevel.WARN)
      expect(capturedLogs[0].levelName).toBe('WARN')
    })

    it('should log at ERROR level', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.error('error message')
      expect(capturedLogs[0].level).toBe(LogLevel.ERROR)
      expect(capturedLogs[0].levelName).toBe('ERROR')
    })

    it('should filter logs below minimum level', () => {
      const l = new Logger({ minLevel: LogLevel.WARN, transports: [testTransport] })
      l.debug('hidden')
      l.info('hidden')
      l.warn('visible')
      l.error('visible')
      expect(capturedLogs).toHaveLength(2)
      expect(capturedLogs.map(e => e.message)).toEqual(['visible', 'visible'])
    })

    it('should support dynamic level changes via setLevel', () => {
      const l = new Logger({ minLevel: LogLevel.ERROR, transports: [testTransport] })
      l.info('hidden')
      expect(capturedLogs).toHaveLength(0)
      l.setLevel(LogLevel.DEBUG)
      l.info('visible now')
      expect(capturedLogs).toHaveLength(1)
    })
  })

  describe('log entry format', () => {
    it('should include all required fields in a log entry', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.info('test', { key: 'value' })

      const entry = capturedLogs[0]
      expect(entry).toHaveProperty('timestamp')
      expect(entry).toHaveProperty('level')
      expect(entry).toHaveProperty('levelName')
      expect(entry).toHaveProperty('message')
      expect(entry).toHaveProperty('context')
      expect(entry).toHaveProperty('traceId')
      expect(entry).toHaveProperty('spanId')
    })

    it('should produce a valid ISO timestamp', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.info('timed')
      const ts = capturedLogs[0].timestamp
      expect(new Date(ts).toISOString()).toBe(ts)
    })

    it('should merge base context with per-log context', () => {
      const l = new Logger({
        minLevel: LogLevel.DEBUG,
        transports: [testTransport],
        context: { module: 'core', env: 'test' },
      })
      l.info('merged', { action: 'process' })
      expect(capturedLogs[0].context).toMatchObject({
        module: 'core',
        env: 'test',
        action: 'process',
      })
    })

    it('should serialize Error objects with name, message, stack', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      const err = new Error('boom')
      l.error('failed', { error: err })
      expect(capturedLogs[0].context.error).toEqual({
        name: 'Error',
        message: 'boom',
        stack: expect.any(String),
      })
    })

    it('should include traceId and spanId when provided', () => {
      const l = new Logger({
        minLevel: LogLevel.DEBUG,
        transports: [testTransport],
        traceId: 'trace-123',
        spanId: 'span-456',
      })
      l.info('traced')
      expect(capturedLogs[0].traceId).toBe('trace-123')
      expect(capturedLogs[0].spanId).toBe('span-456')
    })

    it('should leave traceId and spanId undefined when not provided', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.info('no trace')
      expect(capturedLogs[0].traceId).toBeUndefined()
      expect(capturedLogs[0].spanId).toBeUndefined()
    })
  })

  describe('child loggers', () => {
    it('should create child with merged context', () => {
      const parent = new Logger({
        minLevel: LogLevel.DEBUG,
        transports: [testTransport],
        context: { service: 'api' },
      })
      const child = parent.child({ requestId: 'req-1' })
      child.info('child log')
      expect(capturedLogs[0].context).toMatchObject({ service: 'api', requestId: 'req-1' })
    })

    it('should share transports with parent', () => {
      const parent = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      const child = parent.child({ sub: 'module' })
      child.info('from child')
      expect(capturedLogs).toHaveLength(1)
    })

    it('should inherit parent traceId', () => {
      const parent = new Logger({
        minLevel: LogLevel.DEBUG,
        transports: [testTransport],
        traceId: 'trace-abc',
      })
      const child = parent.child({})
      child.info('from child')
      expect(capturedLogs[0].traceId).toBe('trace-abc')
    })

    it('should allow child to override spanId', () => {
      const parent = new Logger({
        minLevel: LogLevel.DEBUG,
        transports: [testTransport],
        spanId: 'span-parent',
      })
      const child = parent.child({}, 'span-child')
      child.info('from child')
      expect(capturedLogs[0].spanId).toBe('span-child')
    })
  })

  describe('traceId and spanId getters', () => {
    it('should expose traceId getter', () => {
      const l = new Logger({ traceId: 'trace-1' })
      expect(l.traceId).toBe('trace-1')
    })

    it('should expose spanId getter', () => {
      const l = new Logger({ spanId: 'span-1' })
      expect(l.spanId).toBe('span-1')
    })

    it('should return undefined when not set', () => {
      const l = new Logger()
      expect(l.traceId).toBeUndefined()
      expect(l.spanId).toBeUndefined()
    })
  })

  describe('formatters', () => {
    const sampleEntry: LogEntry = {
      timestamp: '2026-04-04T12:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'user logged in',
      context: { userId: 'u-1' },
      traceId: 'trace-1',
      spanId: 'span-1',
    }

    it('JsonLogFormatter should produce valid JSON', () => {
      const formatter = new JsonLogFormatter()
      const output = formatter.format(sampleEntry)
      const parsed = JSON.parse(output)
      expect(parsed).toMatchObject({
        timestamp: '2026-04-04T12:00:00.000Z',
        level: 'INFO',
        message: 'user logged in',
        context: { userId: 'u-1' },
        traceId: 'trace-1',
        spanId: 'span-1',
      })
    })

    it('TextLogFormatter should produce human-readable output', () => {
      const formatter = new TextLogFormatter()
      const output = formatter.format(sampleEntry)
      expect(output).toContain('2026-04-04T12:00:00.000Z')
      expect(output).toContain('INFO')
      expect(output).toContain('user logged in')
      expect(output).toContain('traceId=trace-1')
      expect(output).toContain('spanId=span-1')
    })

    it('TextLogFormatter should omit trace/span when absent', () => {
      const entryNoTrace = { ...sampleEntry, traceId: undefined, spanId: undefined }
      const formatter = new TextLogFormatter()
      const output = formatter.format(entryNoTrace)
      expect(output).not.toContain('traceId')
      expect(output).not.toContain('spanId')
    })
  })

  describe('multiple transports', () => {
    it('should send logs to all transports', () => {
      const logs2: LogEntry[] = []
      const transport2: LogTransport = { log: (e) => logs2.push(e) }
      const l = new Logger({
        minLevel: LogLevel.DEBUG,
        transports: [testTransport, transport2],
      })
      l.info('broadcast')
      expect(capturedLogs).toHaveLength(1)
      expect(logs2).toHaveLength(1)
      expect(capturedLogs[0].message).toBe('broadcast')
      expect(logs2[0].message).toBe('broadcast')
    })
  })

  describe('factory functions', () => {
    it('createLogger should create a logger with module context', () => {
      const l = createLogger('my-module', [testTransport])
      l.info('hello')
      expect(capturedLogs[0].context.module).toBe('my-module')
    })
  })

  describe('default logger', () => {
    it('should be a Logger instance', () => {
      expect(logger).toBeInstanceOf(Logger)
    })
  })

  describe('backward compatibility with structured-logger types', () => {
    it('StructuredLogLevel should equal LogLevel', () => {
      expect(StructuredLogLevel.DEBUG).toBe(LogLevel.DEBUG)
      expect(StructuredLogLevel.INFO).toBe(LogLevel.INFO)
      expect(StructuredLogLevel.WARN).toBe(LogLevel.WARN)
      expect(StructuredLogLevel.ERROR).toBe(LogLevel.ERROR)
      expect(StructuredLogLevel.SILENT).toBe(LogLevel.SILENT)
    })

    it('StructuredLogger should be constructable with same options', () => {
      const captured: StructuredLogEntry[] = []
      const transport: StructuredLogTransport = { log: (e) => captured.push(e) }
      const l = new StructuredLogger({
        minLevel: StructuredLogLevel.DEBUG,
        transports: [transport],
        context: { module: 'test' },
        traceId: 'trace-1',
        spanId: 'span-1',
      })
      l.info('compat test')
      expect(captured).toHaveLength(1)
      expect(captured[0].context.module).toBe('test')
      expect(captured[0].traceId).toBe('trace-1')
      expect(captured[0].levelName).toBe('INFO')
    })

    it('createStructuredLogger should create a logger with module context', () => {
      const captured: StructuredLogEntry[] = []
      const transport: StructuredLogTransport = { log: (e) => captured.push(e) }
      const l = createStructuredLogger('my-module', [transport])
      l.info('hello')
      expect(captured[0].context.module).toBe('my-module')
    })

    it('JsonLogFormatter from structured-logger should work', () => {
      const formatter = new JsonLogFormatterCompat()
      expect(formatter).toBeInstanceOf(JsonLogFormatter)
    })

    it('TextLogFormatter from structured-logger should work', () => {
      const formatter = new TextLogFormatterCompat()
      expect(formatter).toBeInstanceOf(TextLogFormatter)
    })

    it('LogEntry should be assignable to StructuredLogEntry', () => {
      const entry: LogEntry = {
        timestamp: '2026-04-04T12:00:00.000Z',
        level: LogLevel.INFO,
        levelName: 'INFO',
        message: 'test',
        context: {},
      }
      const structured: StructuredLogEntry = entry
      expect(structured.levelName).toBe('INFO')
    })

    it('StructuredLogFormatter should be compatible with LogFormatter', () => {
      const formatter: StructuredLogFormatter = new JsonLogFormatter()
      const entry: LogEntry = {
        timestamp: '2026-04-04T12:00:00.000Z',
        level: LogLevel.INFO,
        levelName: 'INFO',
        message: 'test',
        context: {},
      }
      const output = formatter.format(entry)
      expect(JSON.parse(output).level).toBe('INFO')
    })

    it('StructuredLogger child should support spanId override', () => {
      const captured: StructuredLogEntry[] = []
      const transport: StructuredLogTransport = { log: (e) => captured.push(e) }
      const parent = new StructuredLogger({
        minLevel: StructuredLogLevel.DEBUG,
        transports: [transport],
        spanId: 'span-parent',
      })
      const child = parent.child({}, 'span-child')
      child.info('from child')
      expect(captured[0].spanId).toBe('span-child')
    })

    it('StructuredLogger should support setLevel', () => {
      const captured: StructuredLogEntry[] = []
      const transport: StructuredLogTransport = { log: (e) => captured.push(e) }
      const l = new StructuredLogger({
        minLevel: StructuredLogLevel.ERROR,
        transports: [transport],
      })
      l.info('hidden')
      expect(captured).toHaveLength(0)
      l.setLevel(StructuredLogLevel.DEBUG)
      l.info('visible')
      expect(captured).toHaveLength(1)
    })
  })
})
