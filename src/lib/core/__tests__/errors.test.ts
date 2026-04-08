import {
  AppError,
  ValidationError,
  AgentError,
  LLMError,
  OrchestratorError,
  FileSystemError,
  GatewayError,
  ErrorSeverity,
  ErrorCategory,
  isAppError,
  toAppError,
} from '../errors'

describe('Error Types', () => {
  describe('AppError', () => {
    it('should create with code, message, and category', () => {
      const error = new AppError('TEST_001', 'test error', ErrorCategory.SYSTEM)
      expect(error.code).toBe('TEST_001')
      expect(error.message).toBe('test error')
      expect(error.category).toBe(ErrorCategory.SYSTEM)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.timestamp).toBeInstanceOf(Date)
      expect(error.context).toEqual({})
      expect(error.cause).toBeUndefined()
    })

    it('should accept options including severity, context, and cause', () => {
      const cause = new Error('original')
      const error = new AppError('TEST_002', 'wrapped error', ErrorCategory.AGENT, {
        severity: ErrorSeverity.HIGH,
        context: { taskId: 'task-1' },
        cause,
      })
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.context).toEqual({ taskId: 'task-1' })
      expect(error.cause).toBe(cause)
    })

    it('should serialize to JSON with all fields', () => {
      const error = new AppError('TEST_003', 'json test', ErrorCategory.LLM, {
        severity: ErrorSeverity.LOW,
        context: { model: 'glm-4' },
      })
      const json = error.toJSON()
      expect(json).toMatchObject({
        code: 'TEST_003',
        message: 'json test',
        category: ErrorCategory.LLM,
        severity: ErrorSeverity.LOW,
        context: { model: 'glm-4' },
      })
      expect(json.timestamp).toBeDefined()
    })

    it('should be instanceof Error', () => {
      const error = new AppError('TEST_004', 'test', ErrorCategory.SYSTEM)
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(AppError)
    })
  })

  describe('ValidationError', () => {
    it('should create with field info', () => {
      const error = new ValidationError('Invalid input', { field: 'message' })
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.category).toBe(ErrorCategory.VALIDATION)
      expect(error.severity).toBe(ErrorSeverity.LOW)
      expect(error.context).toEqual({ field: 'message' })
    })
  })

  describe('AgentError', () => {
    it('should create with agent role info', () => {
      const error = new AgentError('Agent failed', 'dev', { taskId: 'task-1' })
      expect(error.code).toBe('AGENT_ERROR')
      expect(error.category).toBe(ErrorCategory.AGENT)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.context).toEqual({ agentRole: 'dev', taskId: 'task-1' })
    })
  })

  describe('LLMError', () => {
    it('should create with provider info', () => {
      const error = new LLMError('API call failed', 'glm', { model: 'glm-4' })
      expect(error.code).toBe('LLM_ERROR')
      expect(error.category).toBe(ErrorCategory.LLM)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.context).toEqual({ provider: 'glm', model: 'glm-4' })
    })

    it('should handle rate limit errors with critical severity', () => {
      const error = new LLMError('Rate limited', 'openai', { isRateLimit: true })
      expect(error.severity).toBe(ErrorSeverity.CRITICAL)
    })
  })

  describe('OrchestratorError', () => {
    it('should create with workflow info', () => {
      const error = new OrchestratorError('Workflow failed', { step: 'dev-execution' })
      expect(error.code).toBe('ORCHESTRATOR_ERROR')
      expect(error.category).toBe(ErrorCategory.ORCHESTRATOR)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.context).toEqual({ step: 'dev-execution' })
    })
  })

  describe('FileSystemError', () => {
    it('should create with path info', () => {
      const error = new FileSystemError('File not found', '/path/to/file.ts')
      expect(error.code).toBe('FILESYSTEM_ERROR')
      expect(error.category).toBe(ErrorCategory.FILESYSTEM)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.context).toEqual({ path: '/path/to/file.ts' })
    })
  })

  describe('GatewayError', () => {
    it('should create with connection info', () => {
      const error = new GatewayError('Connection refused', { url: 'ws://localhost:18789' })
      expect(error.code).toBe('GATEWAY_ERROR')
      expect(error.category).toBe(ErrorCategory.GATEWAY)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.context).toEqual({ url: 'ws://localhost:18789' })
    })
  })

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError('X', 'y', ErrorCategory.SYSTEM))).toBe(true)
      expect(isAppError(new ValidationError('x'))).toBe(true)
    })

    it('should return false for regular errors', () => {
      expect(isAppError(new Error('plain'))).toBe(false)
      expect(isAppError(null)).toBe(false)
      expect(isAppError('string')).toBe(false)
    })
  })

  describe('toAppError', () => {
    it('should return AppError as-is', () => {
      const original = new AgentError('test', 'pm')
      expect(toAppError(original)).toBe(original)
    })

    it('should wrap regular Error into AppError', () => {
      const error = new Error('plain error')
      const wrapped = toAppError(error)
      expect(wrapped).toBeInstanceOf(AppError)
      expect(wrapped.message).toBe('plain error')
      expect(wrapped.code).toBe('UNKNOWN_ERROR')
      expect(wrapped.cause).toBe(error)
    })

    it('should wrap string into AppError', () => {
      const wrapped = toAppError('string error')
      expect(wrapped.message).toBe('string error')
      expect(wrapped.code).toBe('UNKNOWN_ERROR')
    })

    it('should wrap unknown values into AppError', () => {
      const wrapped = toAppError(null)
      expect(wrapped.message).toBe('Unknown error')
      expect(wrapped.code).toBe('UNKNOWN_ERROR')
    })
  })
})
