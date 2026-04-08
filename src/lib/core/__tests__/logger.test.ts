import {
  Logger,
  LogLevel,
  logger,
  createLogger,
  LogEntry,
  LogTransport,
} from '../logger'

describe('Logger', () => {
  let capturedLogs: LogEntry[] = []
  let testTransport: LogTransport

  beforeEach(() => {
    capturedLogs = []
    testTransport = {
      log: (entry: LogEntry) => { capturedLogs.push(entry) },
    }
  })

  describe('Logger instance', () => {
    it('should log at debug level', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.debug('debug message')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe(LogLevel.DEBUG)
      expect(capturedLogs[0].message).toBe('debug message')
    })

    it('should log at info level', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.info('info message')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe(LogLevel.INFO)
    })

    it('should log at warn level', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.warn('warn message')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe(LogLevel.WARN)
    })

    it('should log at error level', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.error('error message')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe(LogLevel.ERROR)
    })

    it('should respect minimum log level', () => {
      const l = new Logger({ minLevel: LogLevel.WARN, transports: [testTransport] })
      l.debug('hidden')
      l.info('hidden')
      l.warn('visible')
      l.error('visible')
      expect(capturedLogs).toHaveLength(2)
      expect(capturedLogs.map(e => e.message)).toEqual(['visible', 'visible'])
    })

    it('should include context in log entries', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport], context: { module: 'test' } })
      l.info('with context', { action: 'test-action' })
      expect(capturedLogs[0].context).toMatchObject({ module: 'test', action: 'test-action' })
    })

    it('should include timestamp in log entries', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      l.info('timed')
      expect(capturedLogs[0].timestamp).toBeDefined()
      expect(new Date(capturedLogs[0].timestamp).getTime()).not.toBeNaN()
    })

    it('should log errors with error details', () => {
      const l = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      const error = new Error('test error')
      l.error('something failed', { error })
      expect(capturedLogs[0].context.error).toEqual({
        name: 'Error',
        message: 'test error',
        stack: expect.any(String),
      })
    })
  })

  describe('child logger', () => {
    it('should create child with additional context', () => {
      const parent = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport], context: { module: 'parent' } })
      const child = parent.child({ agentRole: 'dev' })
      child.info('child message')
      expect(capturedLogs[0].context).toMatchObject({ module: 'parent', agentRole: 'dev' })
    })

    it('should share transports with parent', () => {
      const parent = new Logger({ minLevel: LogLevel.DEBUG, transports: [testTransport] })
      const child = parent.child({ sub: 'module' })
      child.info('from child')
      expect(capturedLogs).toHaveLength(1)
    })
  })

  describe('createLogger', () => {
    it('should create a logger with a context module', () => {
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
})
