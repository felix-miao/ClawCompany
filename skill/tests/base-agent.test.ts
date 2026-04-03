import { BaseOpenClawAgent } from '../src/core/base-agent'
import type { AgentConfig } from '../src/core/types'

class TestAgent extends BaseOpenClawAgent<AgentConfig> {
  constructor(config: AgentConfig = {}) {
    super('pm', config)
  }

  protected buildPrompt(...args: unknown[]): string {
    return `Test prompt: ${JSON.stringify(args)}`
  }

  testSpawnAgent(task: string, options?: {
    runtime?: 'subagent' | 'acp'
    agentId?: string
    cwd?: string
  }) {
    return this.spawnAgent(task, options)
  }

  testParseJSON<T>(session: any, defaultValue: T) {
    return this.parseJSONFromSession<T>(session, defaultValue)
  }

  testCheckAPI() {
    return this.checkOpenClawAPI()
  }

  testLog(message: string) {
    return this.log(message)
  }
}

const mockSessionsSpawn = jest.fn()
const mockSessionsHistory = jest.fn()

describe('BaseOpenClawAgent', () => {
  let agent: TestAgent

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).sessions_spawn = mockSessionsSpawn
    ;(global as any).sessions_history = mockSessionsHistory
    agent = new TestAgent()
  })

  describe('spawnAgent', () => {
    test('应该在 sessions_spawn 可用时调用它', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'test-session',
        status: 'completed',
      })

      const result = await agent.testSpawnAgent('test task')

      expect(mockSessionsSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'test task',
          mode: 'run',
        })
      )
      expect(result).toEqual({ sessionKey: 'test-session', status: 'completed' })
    })

    test('应该在 sessions_spawn 不可用时抛出异常', async () => {
      delete (global as any).sessions_spawn

      await expect(agent.testSpawnAgent('test')).rejects.toThrow(
        'sessions_spawn not available'
      )

      ;(global as any).sessions_spawn = mockSessionsSpawn
    })

    test('应该传递 runtime 和 agentId 选项', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({ sessionKey: 's1' })

      await agent.testSpawnAgent('test', {
        runtime: 'acp',
        agentId: 'custom',
        cwd: '/project',
      })

      expect(mockSessionsSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'acp',
          agentId: 'custom',
          cwd: '/project',
        })
      )
    })

    test('应该使用默认 thinking 配置', async () => {
      const highAgent = new TestAgent({ thinking: 'high' })
      mockSessionsSpawn.mockResolvedValueOnce({ sessionKey: 's1' })

      await highAgent.testSpawnAgent('test')

      expect(mockSessionsSpawn).toHaveBeenCalledWith(
        expect.objectContaining({ thinking: 'high' })
      )
    })
  })

  describe('parseJSONFromSession', () => {
    test('应该在 sessions_history 不可用时返回默认值', async () => {
      delete (global as any).sessions_history

      const result = await agent.testParseJSON(null, { default: true })

      expect(result).toEqual({ default: true })

      ;(global as any).sessions_history = mockSessionsHistory
    })

    test('应该在 session 为 null 时返回默认值', async () => {
      const result = await agent.testParseJSON(null, { default: true })

      expect(result).toEqual({ default: true })
    })

    test('应该在 session 没有 sessionKey 时返回默认值', async () => {
      const result = await agent.testParseJSON({ status: 'ok' }, { default: true })

      expect(result).toEqual({ default: true })
    })

    test('应该正确解析 JSON 内容', async () => {
      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: 'Some text before {"key":"value","num":42} some text after',
          },
        ],
      })

      const result = await agent.testParseJSON<{ key: string; num: number }>(
        { sessionKey: 'test' },
        { key: 'default', num: 0 }
      )

      expect(result.key).toBe('value')
      expect(result.num).toBe(42)
    })

    test('应该在 JSON 解析失败时返回默认值', async () => {
      mockSessionsHistory.mockResolvedValueOnce({
        messages: [{ role: 'assistant', content: 'no json here' }],
      })

      const result = await agent.testParseJSON(
        { sessionKey: 'test' },
        { default: true }
      )

      expect(result).toEqual({ default: true })
    })

    test('应该在 sessions_history 抛出异常时返回默认值', async () => {
      mockSessionsHistory.mockRejectedValueOnce(new Error('history error'))

      const result = await agent.testParseJSON(
        { sessionKey: 'test' },
        { default: true }
      )

      expect(result).toEqual({ default: true })
    })
  })

  describe('checkOpenClawAPI', () => {
    test('应该在两个 API 都可用时返回 available', () => {
      const result = agent.testCheckAPI()

      expect(result.available).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    test('应该在 sessions_spawn 缺失时报告', () => {
      delete (global as any).sessions_spawn

      const result = agent.testCheckAPI()

      expect(result.available).toBe(false)
      expect(result.missing).toContain('sessions_spawn')

      ;(global as any).sessions_spawn = mockSessionsSpawn
    })

    test('应该在 sessions_history 缺失时报告', () => {
      delete (global as any).sessions_history

      const result = agent.testCheckAPI()

      expect(result.available).toBe(false)
      expect(result.missing).toContain('sessions_history')

      ;(global as any).sessions_history = mockSessionsHistory
    })

    test('应该在两个 API 都缺失时报告两个', () => {
      delete (global as any).sessions_spawn
      delete (global as any).sessions_history

      const result = agent.testCheckAPI()

      expect(result.available).toBe(false)
      expect(result.missing).toHaveLength(2)

      ;(global as any).sessions_spawn = mockSessionsSpawn
      ;(global as any).sessions_history = mockSessionsHistory
    })
  })
})
