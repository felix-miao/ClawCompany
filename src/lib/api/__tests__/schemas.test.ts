import { ChatRequestSchema, AgentPostRequestSchema, AgentPutRequestSchema, parseRequestBody } from '../schemas'

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

jest.mock('../route-utils', () => ({
  errorResponse: (error: unknown, status?: number) => ({
    json: async () => {
      const msg = typeof error === 'object' && error !== null && 'error' in error
        ? (error as any).error
        : String(error)
      return { success: false, error: msg }
    },
    status: status || 500,
  }),
}))

describe('schemas', () => {
  describe('ChatRequestSchema', () => {
    it('should validate valid message', () => {
      const result = ChatRequestSchema.safeParse({ message: 'Hello' })
      expect(result.success).toBe(true)
    })

    it('should reject empty message', () => {
      const result = ChatRequestSchema.safeParse({ message: '' })
      expect(result.success).toBe(false)
    })

    it('should reject whitespace-only message', () => {
      const result = ChatRequestSchema.safeParse({ message: '   ' })
      expect(result.success).toBe(false)
    })

    it('should reject message exceeding 10000 chars', () => {
      const result = ChatRequestSchema.safeParse({ message: 'a'.repeat(10001) })
      expect(result.success).toBe(false)
    })

    it('should accept message at max length boundary', () => {
      const result = ChatRequestSchema.safeParse({ message: 'a'.repeat(10000) })
      expect(result.success).toBe(true)
    })

    it('should accept single character message', () => {
      const result = ChatRequestSchema.safeParse({ message: 'x' })
      expect(result.success).toBe(true)
    })

    it('should reject missing message field', () => {
      const result = ChatRequestSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject non-string message', () => {
      const result = ChatRequestSchema.safeParse({ message: 123 })
      expect(result.success).toBe(false)
    })
  })

  describe('AgentPostRequestSchema', () => {
    it('should validate valid request', () => {
      const result = AgentPostRequestSchema.safeParse({
        agentId: 'pm-agent',
        userMessage: 'Hello',
      })
      expect(result.success).toBe(true)
    })

    it('should validate request with optional conversationId', () => {
      const result = AgentPostRequestSchema.safeParse({
        agentId: 'pm-agent',
        userMessage: 'Hello',
        conversationId: 'conv-123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid agent ID with uppercase', () => {
      const result = AgentPostRequestSchema.safeParse({
        agentId: 'PM-Agent',
        userMessage: 'Hello',
      })
      expect(result.success).toBe(false)
    })

    it('should reject agent ID with special characters', () => {
      const result = AgentPostRequestSchema.safeParse({
        agentId: 'agent!',
        userMessage: 'Hello',
      })
      expect(result.success).toBe(false)
    })

    it('should reject agent ID with spaces', () => {
      const result = AgentPostRequestSchema.safeParse({
        agentId: 'pm agent',
        userMessage: 'Hello',
      })
      expect(result.success).toBe(false)
    })

    it('should accept agent ID with hyphens and numbers', () => {
      const result = AgentPostRequestSchema.safeParse({
        agentId: 'agent-123-test',
        userMessage: 'Hello',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty userMessage', () => {
      const result = AgentPostRequestSchema.safeParse({
        agentId: 'pm-agent',
        userMessage: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject userMessage over 10000 chars', () => {
      const result = AgentPostRequestSchema.safeParse({
        agentId: 'pm-agent',
        userMessage: 'a'.repeat(10001),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('AgentPutRequestSchema', () => {
    it('should validate update with single field', () => {
      const result = AgentPutRequestSchema.safeParse({
        agentId: 'pm-agent',
        name: 'Updated Name',
      })
      expect(result.success).toBe(true)
    })

    it('should validate update with all fields', () => {
      const result = AgentPutRequestSchema.safeParse({
        agentId: 'pm-agent',
        name: 'New Name',
        role: 'dev',
        emoji: '🤖',
        color: '#FF0000',
        systemPrompt: 'New prompt',
        runtime: 'subagent',
        thinking: 'high',
      })
      expect(result.success).toBe(true)
    })

    it('should validate update with only agentId', () => {
      const result = AgentPutRequestSchema.safeParse({
        agentId: 'pm-agent',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid role', () => {
      const result = AgentPutRequestSchema.safeParse({
        agentId: 'pm-agent',
        role: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const result = AgentPutRequestSchema.safeParse({
        agentId: 'pm-agent',
        name: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid runtime', () => {
      const result = AgentPutRequestSchema.safeParse({
        agentId: 'pm-agent',
        runtime: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid thinking level', () => {
      const result = AgentPutRequestSchema.safeParse({
        agentId: 'pm-agent',
        thinking: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('should accept all valid roles', () => {
      for (const role of ['pm', 'dev', 'review', 'custom'] as const) {
        const result = AgentPutRequestSchema.safeParse({
          agentId: 'pm-agent',
          role,
        })
        expect(result.success).toBe(true)
      }
    })

    it('should accept all valid runtimes', () => {
      for (const runtime of ['subagent', 'acp'] as const) {
        const result = AgentPutRequestSchema.safeParse({
          agentId: 'pm-agent',
          runtime,
        })
        expect(result.success).toBe(true)
      }
    })

    it('should accept all valid thinking levels', () => {
      for (const thinking of ['low', 'medium', 'high'] as const) {
        const result = AgentPutRequestSchema.safeParse({
          agentId: 'pm-agent',
          thinking,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('parseRequestBody', () => {
    it('should return data for valid input', () => {
      const result = parseRequestBody(ChatRequestSchema, { message: 'Hello' })
      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data).toEqual({ message: 'Hello' })
      }
    })

    it('should return error response for invalid input', () => {
      const result = parseRequestBody(ChatRequestSchema, { message: '' })
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.status).toBe(400)
      }
    })

    it('should return error with first validation message', async () => {
      const result = parseRequestBody(AgentPostRequestSchema, {
        agentId: 'invalid!',
        userMessage: '',
      })
      expect('error' in result).toBe(true)
      if ('error' in result) {
        const data = await result.error.json()
        expect(data.error).toBeDefined()
        expect(data.success).toBe(false)
      }
    })

    it('should handle missing body fields', () => {
      const result = parseRequestBody(AgentPostRequestSchema, {})
      expect('error' in result).toBe(true)
    })

    it('should handle null body', () => {
      const result = parseRequestBody(ChatRequestSchema, null)
      expect('error' in result).toBe(true)
    })

    it('should handle undefined body', () => {
      const result = parseRequestBody(ChatRequestSchema, undefined)
      expect('error' in result).toBe(true)
    })
  })

  describe('strict mode - reject extra fields', () => {
    it('ChatRequestSchema should reject extra fields (strict mode)', () => {
      const result = ChatRequestSchema.safeParse({
        message: 'Hello',
        agentId: 'pm-agent',
      })
      expect(result.success).toBe(false)
    })

    it('ChatRequestSchema should reject extra fields: userMessage', () => {
      const result = ChatRequestSchema.safeParse({
        message: 'Hello',
        userMessage: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('AgentPostRequestSchema should reject extra fields (strict mode)', () => {
      const result = AgentPostRequestSchema.strict().safeParse({
        agentId: 'pm-agent',
        userMessage: 'Hello',
        message: 'extra message',
      })
      expect(result.success).toBe(false)
    })

    it('AgentPostRequestSchema should reject extra fields: message not allowed on agent schema', () => {
      const result = AgentPostRequestSchema.strict().safeParse({
        agentId: 'pm-agent',
        userMessage: 'Hello',
        message: 'extra message',
      })
      expect(result.success).toBe(false)
    })

    it('ChatRequestSchema should reject extra fields including agentId', () => {
      const result = ChatRequestSchema.safeParse({
        message: 'Hello',
        agentId: 'pm-agent',
      })
      expect(result.success).toBe(false)
    })

    it('should provide helpful error message mentioning the extra field', () => {
      const result = ChatRequestSchema.safeParse({
        message: 'Hello',
        agentId: 'pm-agent',
      })
      if (!result.success) {
        const firstIssue = result.error.issues[0]
        expect(firstIssue.message).toContain('agentId')
      }
    })
  })
})
