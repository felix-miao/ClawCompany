import {
  StructuredLogger,
  StructuredLogLevel,
  StructuredLogEntry,
  StructuredLogTransport,
  JsonLogFormatter,
  TextLogFormatter,
  createStructuredLogger,
} from '../structured-logger'

describe('StructuredLogger', () => {
  let capturedLogs: StructuredLogEntry[] = []
  let testTransport: StructuredLogTransport

  beforeEach(() => {
    capturedLogs = []
    testTransport = {
      log: (entry: StructuredLogEntry) => { capturedLogs.push(entry) },
    }
  })

  describe('log level management', () => {
    it('should log at DEBUG level', () => {
      const l = new StructuredLogger({ minLevel: StructuredLogLevel.DEBUG, transports: [testTransport] })
      l.debug('debug message')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe(StructuredLogLevel.DEBUG)
      expect(capturedLogs[0].levelName).toBe('DEBUG')
    })

    it('should log at INFO level', () => {
      const l = new StructuredLogger({ minLevel: StructuredLogLevel.DEBUG, transports: [testTransport] })
      l.info('info message')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe(StructuredLogLevel.INFO)
      expect(capturedLogs[0].levelName).toBe('INFO')
    })

    it('should log at WARN level', () => {
      const l = new StructuredLogger({ minLevel: StructuredLogLevel.DEBUG, transports: [testTransport] })
      l.warn('warn message')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe(StructuredLogLevel.WARN)
      expect(capturedLogs[0].levelName).toBe('WARN')
    })

    it('should log at ERROR level', () => {
      const l = new StructuredLogger({ minLevel: StructuredLogLevel.DEBUG, transports: [testTransport] })
      l.error('error message')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe(StructuredLogLevel.ERROR)
      expect(capturedLogs[0].levelName).toBe('ERROR')
    })

    it('should filter logs below minimum level', () => {
      const l = new StructuredLogger({ minLevel: StructuredLogLevel.WARN, transports: [testTransport] })
      l.debug('hidden')
      l.info('hidden')
      l.warn('visible')
      l.error('visible')
      expect(capturedLogs).toHaveLength(2)
      expect(capturedLogs.map(e => e.message)).toEqual(['visible', 'visible'])
    })

    it('should support dynamic level changes', () => {
      const l = new StructuredLogger({ minLevel: StructuredLogLevel.ERROR, transports: [testTransport] })
      l.info('hidden')
      expect(capturedLogs).toHaveLength(0)
      l.setLevel(StructuredLogLevel.DEBUG)
      l.info('visible now')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].message).toBe('visible now')
    })
  })

  describe('structured log entry format', () => {
    it('should include all required fields in a log entry', () => {
      const l = new StructuredLogger({ minLevel: StructuredLogLevel.DEBUG, transports: [testTransport] })
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
      const l = new StructuredLogger({ minLevel: StructuredLogLevel.DEBUG, transports: [testTransport] })
      l.info('timed')
      const ts = capturedLogs[0].timestamp
      expect(new Date(ts).toISOString()).toBe(ts)
    })

    it('should merge base context with per-log context', () => {
      const l = new StructuredLogger({
        minLevel: StructuredLogLevel.DEBUG,
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

    it('should serialize Error objects in context', () => {
      const l = new StructuredLogger({ minLevel: StructuredLogLevel.DEBUG, transports: [testTransport] })
      const err = new Error('boom')
      l.error('failed', { error: err })
      expect(capturedLogs[0].context.error).toEqual({
        name: 'Error',
        message: 'boom',
        stack: expect.any(String),
      })
    })

    it('should include traceId and spanId when provided', () => {
      const l = new StructuredLogger({
        minLevel: StructuredLogLevel.DEBUG,
        transports: [testTransport],
        traceId: 'trace-123',
        spanId: 'span-456',
      })
      l.info('traced')
      expect(capturedLogs[0].traceId).toBe('trace-123')
      expect(capturedLogs[0].spanId).toBe('span-456')
    })
  })

  describe('child loggers', () => {
    it('should create child with merged context', () => {
      const parent = new StructuredLogger({
        minLevel: StructuredLogLevel.DEBUG,
        transports: [testTransport],
        context: { service: 'api' },
      })
      const child = parent.child({ requestId: 'req-1' })
      child.info('child log')
      expect(capturedLogs[0].context).toMatchObject({ service: 'api', requestId: 'req-1' })
    })

    it('should inherit parent traceId', () => {
      const parent = new StructuredLogger({
        minLevel: StructuredLogLevel.DEBUG,
        transports: [testTransport],
        traceId: 'trace-abc',
      })
      const child = parent.child({})
      child.info('from child')
      expect(capturedLogs[0].traceId).toBe('trace-abc')
    })

    it('should allow child to override spanId', () => {
      const parent = new StructuredLogger({
        minLevel: StructuredLogLevel.DEBUG,
        transports: [testTransport],
        spanId: 'span-parent',
      })
      const child = parent.child({}, 'span-child')
      child.info('from child')
      expect(capturedLogs[0].spanId).toBe('span-child')
    })
  })

  describe('formatters', () => {
    const sampleEntry: StructuredLogEntry = {
      timestamp: '2026-04-04T12:00:00.000Z',
      level: StructuredLogLevel.INFO,
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

  describe('createStructuredLogger factory', () => {
    it('should create a logger with module context', () => {
      const l = createStructuredLogger('my-module', [testTransport])
      l.info('hello')
      expect(capturedLogs[0].context.module).toBe('my-module')
    })
  })

  describe('multiple transports', () => {
    it('should send logs to all transports', () => {
      const logs2: StructuredLogEntry[] = []
      const transport2: StructuredLogTransport = { log: (e) => logs2.push(e) }
      const l = new StructuredLogger({
        minLevel: StructuredLogLevel.DEBUG,
        transports: [testTransport, transport2],
      })
      l.info('broadcast')
      expect(capturedLogs).toHaveLength(1)
      expect(logs2).toHaveLength(1)
      expect(capturedLogs[0].message).toBe('broadcast')
      expect(logs2[0].message).toBe('broadcast')
    })
  })
})
