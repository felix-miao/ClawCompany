import {
  Result,
  ok,
  err,
  isOk,
  isErr,
  ParsedFileEntry,
  ParsedOpenClawResponse,
  RPCRequest,
  RPCResponse,
  RPCError,
  PendingCall,
  TaskStatus,
  AgentRole,
} from '../types'

describe('Result type utilities', () => {
  describe('ok()', () => {
    it('creates a successful result', () => {
      const result = ok(42)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(42)
      }
    })

    it('creates a successful result with object data', () => {
      const result = ok({ name: 'test', value: [1, 2, 3] })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('test')
        expect(result.data.value).toEqual([1, 2, 3])
      }
    })

    it('creates a successful result with null data', () => {
      const result = ok(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeNull()
      }
    })
  })

  describe('err()', () => {
    it('creates an error result with Error', () => {
      const error = new Error('something failed')
      const result = err(error)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(error)
        expect(result.error.message).toBe('something failed')
      }
    })

    it('creates an error result with string', () => {
      const result = err('plain error')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('plain error')
      }
    })
  })

  describe('isOk()', () => {
    it('returns true for successful results', () => {
      expect(isOk(ok('test'))).toBe(true)
    })

    it('returns false for error results', () => {
      expect(isOk(err(new Error('fail')))).toBe(false)
    })

    it('narrows type correctly', () => {
      const result: Result<string, Error> = ok('hello')
      if (isOk(result)) {
        expect(typeof result.data).toBe('string')
      }
    })
  })

  describe('isErr()', () => {
    it('returns false for successful results', () => {
      expect(isErr(ok('test'))).toBe(false)
    })

    it('returns true for error results', () => {
      expect(isErr(err(new Error('fail')))).toBe(true)
    })

    it('narrows type correctly', () => {
      const result: Result<string, Error> = err(new Error('fail'))
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error)
      }
    })
  })
})

describe('ParsedFileEntry type', () => {
  it('accepts valid create action', () => {
    const entry: ParsedFileEntry = {
      path: 'src/test.ts',
      content: 'console.log("hello")',
      action: 'create',
    }
    expect(entry.action).toBe('create')
  })

  it('accepts valid modify action', () => {
    const entry: ParsedFileEntry = {
      path: 'src/test.ts',
      content: 'modified content',
      action: 'modify',
    }
    expect(entry.action).toBe('modify')
  })

  it('accepts valid delete action', () => {
    const entry: ParsedFileEntry = {
      path: 'src/old.ts',
      content: '',
      action: 'delete',
    }
    expect(entry.action).toBe('delete')
  })
})

describe('ParsedOpenClawResponse type', () => {
  it('accepts valid response with files', () => {
    const response: ParsedOpenClawResponse = {
      files: [
        { path: 'a.ts', content: 'code', action: 'create' },
        { path: 'b.ts', content: 'code', action: 'modify' },
      ],
      message: 'Implementation complete',
    }
    expect(response.files).toHaveLength(2)
  })

  it('accepts response with empty files', () => {
    const response: ParsedOpenClawResponse = {
      files: [],
      message: 'No files generated',
    }
    expect(response.files).toHaveLength(0)
  })
})

describe('RPC types', () => {
  it('accepts valid RPCRequest', () => {
    const request: RPCRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sessions.spawn',
      params: { task: 'implement feature' },
    }
    expect(request.jsonrpc).toBe('2.0')
    expect(request.params.task).toBe('implement feature')
  })

  it('accepts valid RPCResponse with result', () => {
    const response: RPCResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { status: 'accepted', runId: 'run_123' },
    }
    expect(response.result).toBeDefined()
  })

  it('accepts valid RPCResponse with error', () => {
    const rpcError: RPCError = {
      code: -32600,
      message: 'Invalid Request',
    }
    const response: RPCResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: rpcError,
    }
    expect(response.error?.code).toBe(-32600)
  })

  it('accepts RPCError with optional data', () => {
    const rpcError: RPCError = {
      code: -32602,
      message: 'Invalid params',
      data: { field: 'task', reason: 'required' },
    }
    expect(rpcError.data).toBeDefined()
  })
})

describe('PendingCall type', () => {
  it('has resolve and reject functions', () => {
    const pending: PendingCall = {
      resolve: jest.fn(),
      reject: jest.fn(),
    }
    expect(typeof pending.resolve).toBe('function')
    expect(typeof pending.reject).toBe('function')
  })
})

describe('Type narrowings', () => {
  it('TaskStatus covers all expected statuses', () => {
    const statuses: TaskStatus[] = [
      'pending', 'in_progress', 'review', 'completed', 'failed',
    ]
    expect(statuses).toHaveLength(5)
  })

  it("'done' is not a valid TaskStatus value", () => {
    const invalidStatus = 'done'
    const validStatuses: TaskStatus[] = ['pending', 'in_progress', 'review', 'completed', 'failed']
    expect(validStatuses.includes(invalidStatus as TaskStatus)).toBe(false)
  })

  it('AgentRole covers all expected roles', () => {
    const roles: AgentRole[] = ['pm', 'dev', 'review']
    expect(roles).toHaveLength(3)
  })
})
