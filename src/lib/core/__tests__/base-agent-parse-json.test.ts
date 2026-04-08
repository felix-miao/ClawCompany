import { z } from 'zod'

import { BaseAgent, ParseResult } from '../base-agent'

const TestSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  tags: z.array(z.string()).default([]),
})

type TestType = z.infer<typeof TestSchema>

class TestAgent extends BaseAgent {
  constructor() {
    super('test-1', 'Test Agent', 'dev', 'test')
  }

  testParseJSON<T>(response: string): T | null {
    return this.parseJSONResponse<T>(response)
  }

  testParseJSONWithSchema<T>(
    response: string,
    schema: z.ZodType<T>,
  ): ParseResult<T> {
    return this.parseJSONResponse<T>(response, schema)
  }

  async execute() {
    return { agent: 'dev' as const, message: 'test', status: 'success' as const }
  }
}

describe('BaseAgent.parseJSONResponse - backward compat (no schema)', () => {
  let agent: TestAgent

  beforeEach(() => {
    agent = new TestAgent()
  })

  it('should parse valid JSON object', () => {
    const result = agent.testParseJSON<{ name: string }>('{"name":"test"}')
    expect(result).toEqual({ name: 'test' })
  })

  it('should extract JSON from markdown text', () => {
    const result = agent.testParseJSON<{ name: string }>(
      'Here is the response:\n```json\n{"name":"hello"}\n```\nDone.'
    )
    expect(result).toEqual({ name: 'hello' })
  })

  it('should return null for text without JSON', () => {
    const result = agent.testParseJSON('no json here')
    expect(result).toBeNull()
  })

  it('should return null for empty string', () => {
    const result = agent.testParseJSON('')
    expect(result).toBeNull()
  })
})

describe('BaseAgent.parseJSONResponse - with Zod schema', () => {
  let agent: TestAgent

  beforeEach(() => {
    agent = new TestAgent()
  })

  it('should validate and return typed data on valid input', () => {
    const response = '{"name":"test","value":42,"tags":["a","b"]}'
    const result = agent.testParseJSONWithSchema(response, TestSchema)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'test', value: 42, tags: ['a', 'b'] })
    }
  })

  it('should apply schema defaults', () => {
    const response = '{"name":"test","value":1}'
    const result = agent.testParseJSONWithSchema(response, TestSchema)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'test', value: 1, tags: [] })
    }
  })

  it('should return error for invalid data', () => {
    const response = '{"name":"","value":"not-a-number"}'
    const result = agent.testParseJSONWithSchema(response, TestSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
      expect(result.raw).toEqual({ name: '', value: 'not-a-number' })
    }
  })

  it('should return error for missing required fields', () => {
    const response = '{"name":"test"}'
    const result = agent.testParseJSONWithSchema(response, TestSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('value')
    }
  })

  it('should return error when no JSON found', () => {
    const response = 'plain text without json'
    const result = agent.testParseJSONWithSchema(response, TestSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
      expect(result.raw).toBe('plain text without json')
    }
  })

  it('should extract and validate JSON from markdown', () => {
    const response = 'Result:\n```json\n{"name":"md-test","value":99}\n```\nEnd.'
    const result = agent.testParseJSONWithSchema(response, TestSchema)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'md-test', value: 99, tags: [] })
    }
  })

  it('should strip extra fields not in schema', () => {
    const response = '{"name":"test","value":1,"extra":"removed","tags":[]}'
    const result = agent.testParseJSONWithSchema(response, TestSchema)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('extra')
    }
  })

  it('should validate with existing PMAgentResponseSchema', () => {
    const { PMAgentResponseSchema } = require('../../agents/schemas') as typeof import('../../agents/schemas')
    const response = JSON.stringify({
      analysis: 'test analysis',
      tasks: [{ title: 'do thing', description: 'desc', assignedTo: 'dev', dependencies: [] }],
      message: 'plan done',
    })

    const result = agent.testParseJSONWithSchema(response, PMAgentResponseSchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.analysis).toBe('test analysis')
      expect(result.data.tasks).toHaveLength(1)
    }
  })
})
