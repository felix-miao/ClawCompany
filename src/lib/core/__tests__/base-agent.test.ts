import { BaseOpenClawAgent } from '../base-agent'
import { AgentRole, AgentConfig } from '../types'

class TestAgent extends BaseOpenClawAgent {
  constructor(role: AgentRole, config: AgentConfig) {
    super(role, config)
  }

  protected buildPrompt(): string {
    return 'test prompt'
  }

  protected getDefaultResult(): unknown {
    return { ok: true }
  }

  async testSpawnAgent(task: string) {
    return this.spawnAgent(task)
  }

  async testParseJSONFromSession<T>(session: { sessionKey?: string } | null, defaultValue: T): Promise<T> {
    return this.parseJSONFromSession(session, defaultValue)
  }
}

describe('BaseOpenClawAgent - global declarations', () => {
  let agent: TestAgent

  beforeEach(() => {
    agent = new TestAgent('dev', { thinking: 'high' })
  })

  it('should throw if sessions_spawn is not available', async () => {
    delete (globalThis as Record<string, unknown>).sessions_spawn
    await expect(agent.testSpawnAgent('test')).rejects.toThrow('sessions_spawn not available')
  })

  it('should call sessions_spawn when available', async () => {
    const mockSpawn = jest.fn().mockResolvedValue({ sessionKey: 'test-key' })
    ;(globalThis as Record<string, unknown>).sessions_spawn = mockSpawn

    await agent.testSpawnAgent('implement feature')

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'implement feature',
        runtime: 'subagent',
        thinking: 'high',
        mode: 'run',
      })
    )

    delete (globalThis as Record<string, unknown>).sessions_spawn
  })

  it('should return default when sessions_history is not available', async () => {
    delete (globalThis as Record<string, unknown>).sessions_history
    const result = await agent.testParseJSONFromSession(null, { default: true })
    expect(result).toEqual({ default: true })
  })

  it('should parse JSON from session history', async () => {
    const mockHistory = jest.fn().mockResolvedValue({
      messages: [{ content: 'Here is the result: {"status": "ok", "value": 42}' }],
    })
    ;(globalThis as Record<string, unknown>).sessions_history = mockHistory

    const result = await agent.testParseJSONFromSession(
      { sessionKey: 'test-key' },
      { status: 'pending' }
    )

    expect(result).toEqual({ status: 'ok', value: 42 })
    delete (globalThis as Record<string, unknown>).sessions_history
  })

  it('should have correct role', () => {
    expect(agent.role).toBe('dev')
  })
})
