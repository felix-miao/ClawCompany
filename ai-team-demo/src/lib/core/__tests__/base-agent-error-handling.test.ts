import { z } from 'zod'
import { BaseAgent, BaseOpenClawAgent, ParseResult } from '../base-agent'
import { AgentRole, AgentConfig, AgentResponse, Task, AgentContext } from '../types'
import { setLLMProvider } from '../../llm/factory'
import type { LLMProvider } from '../../llm/types'

class TestBaseAgent extends BaseAgent {
  constructor() {
    super('test-id', 'Test Agent', 'dev', 'A test agent')
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    return { agent: 'dev', message: 'test', status: 'success' }
  }

  testExecuteWithLLMFallback(
    task: Task,
    context: AgentContext,
    llmHandler: (r: string) => AgentResponse,
    fallbackHandler: () => Promise<AgentResponse>,
    systemPrompt: string,
    userPromptBuilder: (task: Task, context: AgentContext) => string,
  ) {
    return this.executeWithLLMFallback(task, context, llmHandler, fallbackHandler, systemPrompt, userPromptBuilder)
  }

  testCallLLM(systemPrompt: string, userPrompt: string) {
    return this.callLLM(systemPrompt, userPrompt)
  }

  testGetLLM() {
    return this.getLLM()
  }

  testBuildTaskPrompt(task: Task) {
    return this.buildTaskPrompt(task)
  }

  testToPascalCase(str: string) {
    return this.toPascalCase(str)
  }

  testToKebabCase(str: string) {
    return this.toKebabCase(str)
  }

  testGenerateTaskId() {
    return this.generateTaskId()
  }
}

const mockTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  description: 'A test task',
  assignedTo: 'dev',
  dependencies: [],
  files: [],
  status: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockContext: AgentContext = {
  chatHistory: [],
  existingFiles: [],
}

jest.mock('../../llm/factory', () => {
  let _provider: LLMProvider | null = null
  return {
    getLLMProvider: jest.fn(() => _provider),
    setLLMProvider: jest.fn((p: LLMProvider | null) => { _provider = p }),
    LLMFactory: { createFromEnv: jest.fn(() => null) },
  }
})

describe('BaseAgent - 错误处理和 LLM 回退', () => {
  let agent: TestBaseAgent

  beforeEach(() => {
    agent = new TestBaseAgent()
    setLLMProvider(null as any)
  })

  describe('executeWithLLMFallback', () => {
    it('应该在无 LLM 时直接走 fallback', async () => {
      const fallbackHandler = jest.fn().mockResolvedValue({
        agent: 'dev' as const,
        message: 'no llm fallback',
        status: 'success' as const,
      })

      const result = await agent.testExecuteWithLLMFallback(
        mockTask,
        mockContext,
        (r) => ({ agent: 'dev', message: r, status: 'success' }),
        fallbackHandler,
        'system',
        (t) => t.title,
      )

      expect(result.message).toBe('no llm fallback')
      expect(fallbackHandler).toHaveBeenCalled()
    })

    it('应该在 LLM 抛出异常时回退到 fallback', async () => {
      setLLMProvider({
        chat: jest.fn().mockRejectedValue(new Error('LLM unavailable')),
      } as any)

      const fallbackHandler = jest.fn().mockResolvedValue({
        agent: 'dev' as const,
        message: 'fallback from error',
        status: 'success' as const,
      })

      const result = await agent.testExecuteWithLLMFallback(
        mockTask,
        mockContext,
        (r) => ({ agent: 'dev', message: r, status: 'success' }),
        fallbackHandler,
        'system',
        (t) => t.title,
      )

      expect(result.message).toBe('fallback from error')
      expect(fallbackHandler).toHaveBeenCalled()
    })

    it('应该在 LLM 返回 null 时回退到 fallback', async () => {
      setLLMProvider({
        chat: jest.fn().mockResolvedValue(null),
      } as any)

      const fallbackHandler = jest.fn().mockResolvedValue({
        agent: 'dev' as const,
        message: 'fallback result',
        status: 'success' as const,
      })

      const result = await agent.testExecuteWithLLMFallback(
        mockTask,
        mockContext,
        (r) => ({ agent: 'dev', message: r, status: 'success' }),
        fallbackHandler,
        'system',
        (t) => t.title,
      )

      expect(result.message).toBe('fallback result')
      expect(fallbackHandler).toHaveBeenCalled()
    })

    it('应该在 LLM 成功时使用 llmHandler', async () => {
      const mockChat = jest.fn().mockResolvedValue('LLM response content')
      setLLMProvider({ chat: mockChat } as any)

      const llmHandler = jest.fn((r: string) => ({
        agent: 'dev' as const,
        message: `processed: ${r}`,
        status: 'success' as const,
      }))
      const fallbackHandler = jest.fn().mockResolvedValue({
        agent: 'dev' as const,
        message: 'should not be called',
        status: 'success' as const,
      })

      const result = await agent.testExecuteWithLLMFallback(
        mockTask,
        mockContext,
        llmHandler,
        fallbackHandler,
        'system prompt',
        (t) => `user: ${t.title}`,
      )

      expect(llmHandler).toHaveBeenCalledWith('LLM response content')
      expect(fallbackHandler).not.toHaveBeenCalled()
      expect(result.message).toBe('processed: LLM response content')
    })
  })

  describe('callLLM', () => {
    it('应该在无 LLM 时返回 null', async () => {
      const result = await agent.testCallLLM('system', 'user')
      expect(result).toBeNull()
    })
  })

  describe('buildTaskPrompt', () => {
    it('应该正确构建任务提示', () => {
      const prompt = agent.testBuildTaskPrompt(mockTask)
      expect(prompt).toContain('Test Task')
      expect(prompt).toContain('A test task')
    })
  })

  describe('toPascalCase', () => {
    it('应该转换 kebab-case 到 PascalCase', () => {
      expect(agent.testToPascalCase('hello-world')).toBe('HelloWorld')
    })

    it('应该转换 snake_case 到 PascalCase', () => {
      expect(agent.testToPascalCase('hello_world')).toBe('HelloWorld')
    })

    it('应该处理空格分隔', () => {
      expect(agent.testToPascalCase('hello world')).toBe('HelloWorld')
    })

    it('应该移除非字母数字字符', () => {
      expect(agent.testToPascalCase('hello@world#123')).toBe('Helloworld123')
    })
  })

  describe('toKebabCase', () => {
    it('应该转换空格为短横线', () => {
      expect(agent.testToKebabCase('Hello World')).toBe('hello-world')
    })

    it('应该移除非 a-z0-9 的字符', () => {
      expect(agent.testToKebabCase('Hello_World!')).toBe('helloworld')
    })
  })

  describe('generateTaskId', () => {
    it('应该生成 task_ 前缀的 ID', () => {
      const id = agent.testGenerateTaskId()
      expect(id).toMatch(/^task_[a-z0-9-]+$/)
    })

    it('应该生成唯一 ID', () => {
      const ids = new Set(Array.from({ length: 100 }, () => agent.testGenerateTaskId()))
      expect(ids.size).toBe(100)
    })
  })
})

describe('BaseOpenClawAgent - 错误处理', () => {
  class TestOC extends BaseOpenClawAgent {
    constructor(role: AgentRole, config: AgentConfig) { super(role, config) }
    protected buildPrompt(): string { return 'test' }
    protected getDefaultResult(): unknown { return {} }

    async testParseJSON<T>(session: { sessionKey?: string } | null, def: T): Promise<T> {
      return this.parseJSONFromSession(session, def)
    }

    async testSpawn(task: string, opts?: any) {
      return this.spawnAgent(task, opts)
    }
  }

  let agent: TestOC

  beforeEach(() => {
    agent = new TestOC('dev', { thinking: 'high' })
  })

  afterEach(() => {
    delete (globalThis as any).sessions_spawn
    delete (globalThis as any).sessions_history
  })

  it('应该在 session 为 null 时返回默认值', async () => {
    delete (globalThis as any).sessions_history
    const result = await agent.testParseJSON(null, { default: true })
    expect(result).toEqual({ default: true })
  })

  it('应该在 session 无 sessionKey 时返回默认值', async () => {
    ;(globalThis as any).sessions_history = jest.fn()
    const result = await agent.testParseJSON({}, { default: true })
    expect(result).toEqual({ default: true })
  })

  it('应该在 sessions_history 抛出异常时返回默认值', async () => {
    ;(globalThis as any).sessions_history = jest.fn().mockRejectedValue(new Error('history error'))
    const result = await agent.testParseJSON({ sessionKey: 'key' }, { safe: true })
    expect(result).toEqual({ safe: true })
  })

  it('应该在 session 消息为空时返回默认值', async () => {
    ;(globalThis as any).sessions_history = jest.fn().mockResolvedValue({ messages: [] })
    const result = await agent.testParseJSON({ sessionKey: 'key' }, { default: 'yes' })
    expect(result).toEqual({ default: 'yes' })
  })

  it('应该在消息无 JSON 时返回默认值', async () => {
    ;(globalThis as any).sessions_history = jest.fn().mockResolvedValue({
      messages: [{ content: 'plain text without json' }],
    })
    const result = await agent.testParseJSON({ sessionKey: 'key' }, 'default')
    expect(result).toBe('default')
  })

  it('应该在 spawn 时传递自定义选项', async () => {
    const mockSpawn = jest.fn().mockResolvedValue({ sessionKey: 'custom-key' })
    ;(globalThis as any).sessions_spawn = mockSpawn

    await agent.testSpawn('custom task', {
      runtime: 'acp',
      agentId: 'reviewer',
      cwd: '/custom/dir',
    })

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: 'acp',
        agentId: 'reviewer',
        cwd: '/custom/dir',
        task: 'custom task',
      })
    )
  })
})
