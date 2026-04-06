import { ErrorHandler, RecoveryAction, RetryConfig, AgentContext } from '../error-handler'

describe('ErrorHandler', () => {
  let handler: ErrorHandler

  beforeEach(() => {
    handler = new ErrorHandler()
  })

  describe('handle()', () => {
    it('should return retry action for transient errors', () => {
      const error = new Error('Network timeout')
      const context: AgentContext = {
        projectId: 'test-project',
        tasks: [],
        files: {},
        chatHistory: [],
      }

      const action = handler.handle(error, context)

      expect(action.type).toBe('retry')
    })

    it('should return abort action for fatal errors', () => {
      const error = new Error('Authentication failed: invalid API key')
      const context: AgentContext = {
        projectId: 'test-project',
        tasks: [],
        files: {},
        chatHistory: [],
      }

      const action = handler.handle(error, context)

      expect(action.type).toBe('abort')
    })

    it('should return fallback action for non-critical errors', () => {
      const error = new Error('Warning: deprecated API usage')
      const context: AgentContext = {
        projectId: 'test-project',
        tasks: [],
        files: {},
        chatHistory: [],
      }

      const action = handler.handle(error, context)

      expect(action.type).toBe('fallback')
    })

    it('should include retry params for retry action', () => {
      const error = new Error('Connection reset')
      const context: AgentContext = {
        projectId: 'test-project',
        tasks: [],
        files: {},
        chatHistory: [],
      }

      const action = handler.handle(error, context)

      expect(action.params).toBeDefined()
      expect(action.params?.maxRetries).toBeDefined()
      expect(action.params?.delay).toBeDefined()
    })
  })

  describe('retry()', () => {
    it('should retry failed operations', async () => {
      let attempts = 0
      const operation = async () => {
        attempts++
        if (attempts < 2) {
          throw new Error('Transient error')
        }
        return 'success'
      }

      const config: RetryConfig = {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
      }

      const result = await handler.retry(operation, config)
      expect(result).toBe('success')
      expect(attempts).toBe(2)
    })

    it('should throw after max retries exhausted', async () => {
      const operation = async () => {
        throw new Error('Persistent error')
      }

      const config: RetryConfig = {
        maxRetries: 2,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
      }

      await expect(handler.retry(operation, config)).rejects.toThrow('Persistent error')
    })

    it('should succeed immediately if operation succeeds', async () => {
      let attempts = 0
      const operation = async () => {
        attempts++
        return 'immediate success'
      }

      const config: RetryConfig = {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
      }

      const result = await handler.retry(operation, config)
      expect(result).toBe('immediate success')
      expect(attempts).toBe(1)
    })

    it('should use default config when not provided', async () => {
      let attempts = 0
      const operation = async () => {
        attempts++
        if (attempts < 2) {
          throw new Error('Error')
        }
        return 'done'
      }

      const result = await handler.retry(operation)
      expect(result).toBe('done')
    })
  })

  describe('error classification', () => {
    it('should classify network errors as transient', () => {
      const networkErrors = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'Network request failed',
        'timeout',
        'connection',
      ]

      networkErrors.forEach(msg => {
        const error = new Error(msg)
        const context: AgentContext = {
          projectId: 'test',
          tasks: [],
          files: {},
          chatHistory: [],
        }
        const action = handler.handle(error, context)
        expect(action.type).toBe('retry')
      })
    })

    it('should classify auth errors as abort', () => {
      const authErrors = [
        'Authentication failed',
        'Invalid API key',
        'Unauthorized',
        '401',
        '403',
      ]

      authErrors.forEach(msg => {
        const error = new Error(msg)
        const context: AgentContext = {
          projectId: 'test',
          tasks: [],
          files: {},
          chatHistory: [],
        }
        const action = handler.handle(error, context)
        expect(action.type).toBe('abort')
      })
    })
  })
})
