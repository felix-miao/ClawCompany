import {
  AgentConfigSchema,
  AppAgentConfigSchema,
  PersistedAgentConfigSchema,
  type AgentConfig,
  type AppAgentConfig,
  type PersistedAgentConfig,
  validateAgentConfig,
  APP_AGENT_ROLES,
} from '../agent-config'

describe('AgentConfigSchema (unified)', () => {
  describe('valid configurations', () => {
    it('should accept minimal config (id, name, role only)', () => {
      const result = AgentConfigSchema.safeParse({
        id: 'test-agent',
        name: 'Test Agent',
        role: 'Developer',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('test-agent')
        expect(result.data.name).toBe('Test Agent')
        expect(result.data.role).toBe('Developer')
      }
    })

    it('should accept full config with all fields', () => {
      const config = {
        id: 'pm-agent',
        name: 'PM Claw',
        role: 'pm',
        emoji: '📋',
        color: '#3B82F6',
        systemPrompt: 'You are a PM agent',
        runtime: 'subagent' as const,
        agentId: 'opencode',
        thinking: 'high' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      const result = AgentConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(config)
      }
    })

    it('should accept game-style config with arbitrary role string', () => {
      const config = {
        id: 'dev1',
        name: 'Alice',
        role: 'Developer',
      }

      const result = AgentConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('should accept config with partial optional fields', () => {
      const config = {
        id: 'agent-1',
        name: 'Agent',
        role: 'custom',
        emoji: '🤖',
        runtime: 'acp' as const,
      }

      const result = AgentConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })
  })

  describe('invalid configurations', () => {
    it('should reject config without id', () => {
      const result = AgentConfigSchema.safeParse({
        name: 'Test',
        role: 'dev',
      })

      expect(result.success).toBe(false)
    })

    it('should reject config without name', () => {
      const result = AgentConfigSchema.safeParse({
        id: 'test',
        role: 'dev',
      })

      expect(result.success).toBe(false)
    })

    it('should reject config without role', () => {
      const result = AgentConfigSchema.safeParse({
        id: 'test',
        name: 'Test',
      })

      expect(result.success).toBe(false)
    })

    it('should reject empty id', () => {
      const result = AgentConfigSchema.safeParse({
        id: '',
        name: 'Test',
        role: 'dev',
      })

      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const result = AgentConfigSchema.safeParse({
        id: 'test',
        name: '',
        role: 'dev',
      })

      expect(result.success).toBe(false)
    })

    it('should reject empty role', () => {
      const result = AgentConfigSchema.safeParse({
        id: 'test',
        name: 'Test',
        role: '',
      })

      expect(result.success).toBe(false)
    })

    it('should reject invalid runtime value', () => {
      const result = AgentConfigSchema.safeParse({
        id: 'test',
        name: 'Test',
        role: 'dev',
        runtime: 'invalid',
      })

      expect(result.success).toBe(false)
    })

    it('should reject invalid thinking value', () => {
      const result = AgentConfigSchema.safeParse({
        id: 'test',
        name: 'Test',
        role: 'dev',
        thinking: 'ultra',
      })

      expect(result.success).toBe(false)
    })

    it('should reject non-string id', () => {
      const result = AgentConfigSchema.safeParse({
        id: 123,
        name: 'Test',
        role: 'dev',
      })

      expect(result.success).toBe(false)
    })

    it('should reject completely empty object', () => {
      const result = AgentConfigSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject null', () => {
      const result = AgentConfigSchema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('should reject undefined', () => {
      const result = AgentConfigSchema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('parse (with defaults)', () => {
    it('should apply default emoji when omitted', () => {
      const result = AgentConfigSchema.parse({
        id: 'test',
        name: 'Test',
        role: 'dev',
      })

      expect(result.emoji).toBe('🤖')
    })

    it('should apply default color when omitted', () => {
      const result = AgentConfigSchema.parse({
        id: 'test',
        name: 'Test',
        role: 'dev',
      })

      expect(result.color).toBe('#6B7280')
    })

    it('should apply default systemPrompt when omitted', () => {
      const result = AgentConfigSchema.parse({
        id: 'test',
        name: 'Test',
        role: 'dev',
      })

      expect(result.systemPrompt).toBe('')
    })

    it('should apply default runtime when omitted', () => {
      const result = AgentConfigSchema.parse({
        id: 'test',
        name: 'Test',
        role: 'dev',
      })

      expect(result.runtime).toBe('subagent')
    })

    it('should preserve explicit values over defaults', () => {
      const result = AgentConfigSchema.parse({
        id: 'test',
        name: 'Test',
        role: 'dev',
        emoji: '📋',
        color: '#FF0000',
        runtime: 'acp',
      })

      expect(result.emoji).toBe('📋')
      expect(result.color).toBe('#FF0000')
      expect(result.runtime).toBe('acp')
    })
  })
})

describe('AppAgentConfigSchema (restricted roles)', () => {
  describe('valid configurations', () => {
    it.each(APP_AGENT_ROLES)('should accept role: %s', (role) => {
      const result = AppAgentConfigSchema.safeParse({
        id: `${role}-agent`,
        name: `${role} Agent`,
        role,
        emoji: '🤖',
        color: '#000',
        systemPrompt: 'prompt',
        runtime: 'subagent',
      })

      expect(result.success).toBe(true)
    })

    it('should accept full app config with all optional fields', () => {
      const result = AppAgentConfigSchema.safeParse({
        id: 'dev-agent',
        name: 'Dev Claw',
        role: 'dev',
        emoji: '💻',
        color: '#10B981',
        systemPrompt: 'You are a dev agent',
        runtime: 'acp',
        agentId: 'opencode',
        thinking: 'medium',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('invalid configurations', () => {
    it('should reject arbitrary role strings', () => {
      const result = AppAgentConfigSchema.safeParse({
        id: 'test',
        name: 'Test',
        role: 'Developer',
        emoji: '🤖',
        color: '#000',
        systemPrompt: 'prompt',
        runtime: 'subagent',
      })

      expect(result.success).toBe(false)
    })

    it('should reject missing required app fields (systemPrompt)', () => {
      const result = AppAgentConfigSchema.safeParse({
        id: 'test',
        name: 'Test',
        role: 'pm',
        emoji: '🤖',
        color: '#000',
        runtime: 'subagent',
      })

      expect(result.success).toBe(false)
    })

    it('should reject missing required app fields (emoji)', () => {
      const result = AppAgentConfigSchema.safeParse({
        id: 'test',
        name: 'Test',
        role: 'pm',
        color: '#000',
        systemPrompt: 'prompt',
        runtime: 'subagent',
      })

      expect(result.success).toBe(false)
    })

    it('should reject missing required app fields (color)', () => {
      const result = AppAgentConfigSchema.safeParse({
        id: 'test',
        name: 'Test',
        role: 'pm',
        emoji: '🤖',
        systemPrompt: 'prompt',
        runtime: 'subagent',
      })

      expect(result.success).toBe(false)
    })

    it('should reject missing required app fields (runtime)', () => {
      const result = AppAgentConfigSchema.safeParse({
        id: 'test',
        name: 'Test',
        role: 'pm',
        emoji: '🤖',
        color: '#000',
        systemPrompt: 'prompt',
      })

      expect(result.success).toBe(false)
    })
  })
})

describe('PersistedAgentConfigSchema', () => {
  it('should require createdAt and updatedAt', () => {
    const result = PersistedAgentConfigSchema.safeParse({
      id: 'test',
      name: 'Test',
      role: 'pm',
      emoji: '🤖',
      color: '#000',
      systemPrompt: 'prompt',
      runtime: 'subagent',
    })

    expect(result.success).toBe(false)
  })

  it('should accept config with timestamps', () => {
    const now = new Date().toISOString()
    const result = PersistedAgentConfigSchema.safeParse({
      id: 'test',
      name: 'Test',
      role: 'pm',
      emoji: '🤖',
      color: '#000',
      systemPrompt: 'prompt',
      runtime: 'subagent',
      createdAt: now,
      updatedAt: now,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.createdAt).toBe(now)
      expect(result.data.updatedAt).toBe(now)
    }
  })

  it('should reject empty timestamp strings', () => {
    const result = PersistedAgentConfigSchema.safeParse({
      id: 'test',
      name: 'Test',
      role: 'pm',
      emoji: '🤖',
      color: '#000',
      systemPrompt: 'prompt',
      runtime: 'subagent',
      createdAt: '',
      updatedAt: '',
    })

    expect(result.success).toBe(false)
  })
})

describe('validateAgentConfig helper', () => {
  it('should return parsed data for valid config', () => {
    const result = validateAgentConfig({
      id: 'test',
      name: 'Test',
      role: 'dev',
    })

    expect(result).toEqual({
      id: 'test',
      name: 'Test',
      role: 'dev',
      emoji: '🤖',
      color: '#6B7280',
      systemPrompt: '',
      runtime: 'subagent',
    })
  })

  it('should throw on invalid config', () => {
    expect(() => validateAgentConfig({ id: '' })).toThrow()
  })
})

describe('type inference', () => {
  it('AgentConfig should allow minimal config as type', () => {
    const config: AgentConfig = {
      id: 'game-agent',
      name: 'Game Agent',
      role: 'warrior',
    }

    expect(config.id).toBe('game-agent')
    expect(config.role).toBe('warrior')
  })

  it('AppAgentConfig should require all app fields', () => {
    const config: AppAgentConfig = {
      id: 'app-agent',
      name: 'App Agent',
      role: 'pm',
      emoji: '📋',
      color: '#3B82F6',
      systemPrompt: 'prompt',
      runtime: 'subagent',
    }

    expect(config.role).toBe('pm')
  })

  it('PersistedAgentConfig should require timestamps', () => {
    const config: PersistedAgentConfig = {
      id: 'stored-agent',
      name: 'Stored Agent',
      role: 'dev',
      emoji: '💻',
      color: '#10B981',
      systemPrompt: 'prompt',
      runtime: 'acp',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    expect(config.createdAt).toBeDefined()
    expect(config.updatedAt).toBeDefined()
  })
})
