/**
 * createToolAwareDevAgent 单元测试
 *
 * 覆盖：
 * - createToolAwareDevAgent：无 LLM 时退回原始 DevAgent.execute
 * - createToolAwareDevAgent：自定义 registryOverride 注入
 * - createToolAwareDevAgent：有 LLM 时使用工具增强 execute
 * - createToolAwareDevAgent：有 LLM + tool rounds 完成工作
 * - buildDefaultRegistry（通过 registryOverride=undefined 触发）：本地工具模式
 * - buildDefaultRegistry：OpenClaw Bridge 模式（USE_OPENCLAW_GATEWAY=true）
 * - 返回对象保留 DevAgent 原始属性（agent 名称等）
 */

import { createToolAwareDevAgent } from '../tool-aware-dev-agent'
import { DefaultAgentToolRegistry } from '../registry'
import { AgentTool, ToolResult, ToolParameterSchema, LLMProviderWithTools } from '../types'
import { Task, AgentContext } from '../../core/types'

// ---------------------------------------------------------------------------
// Mock: getLLMProvider & runAgenticLoop
// ---------------------------------------------------------------------------

jest.mock('../../llm/factory', () => ({
  getLLMProvider: jest.fn(),
  getLLMProviderForAgent: jest.fn().mockReturnValue(null),
}))

jest.mock('../agentic-loop', () => ({
  runAgenticLoop: jest.fn(),
  adaptLLMProviderToTools: jest.fn((provider) => provider),
}))

jest.mock('../../gateway/client', () => ({
  getGatewayClient: jest.fn().mockReturnValue({
    isConnected: () => false,
    connect: jest.fn(),
    call: jest.fn(),
  }),
}))

import { getLLMProvider } from '../../llm/factory'
import { runAgenticLoop } from '../agentic-loop'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockTask: Task = {
  id: 'task-1',
  title: 'Write a hello function',
  description: 'Create a simple function that returns "hello"',
  status: 'pending',
  priority: 'normal',
  createdAt: new Date().toISOString(),
}

const mockContext: AgentContext = {
  files: { 'src/index.ts': 'export {}' },
  projectPath: '/tmp/test-project',
  conversationHistory: [],
}

const mockTool: AgentTool<{ value: string }, { echo: string }> = {
  name: 'echo_tool',
  description: 'Echo tool for testing',
  parameters: {
    type: 'object',
    properties: { value: { type: 'string', description: 'value' } },
    required: ['value'],
  } as ToolParameterSchema,
  async execute({ value }) {
    return { success: true, data: { echo: value }, durationMs: 1 }
  },
  formatResult(r) {
    return r.success ? r.data?.echo ?? '' : `Error: ${r.error}`
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createToolAwareDevAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getLLMProvider as jest.Mock).mockReturnValue(null)
  })

  describe('basic structure', () => {
    it('should return an object with toolRegistry and executeWithTools', () => {
      const registry = new DefaultAgentToolRegistry()
      const agent = createToolAwareDevAgent({ registryOverride: registry })

      expect(agent.toolRegistry).toBeDefined()
      expect(typeof agent.executeWithTools).toBe('function')
    })

    it('should expose the injected registryOverride as toolRegistry', () => {
      const registry = new DefaultAgentToolRegistry()
      registry.register(mockTool)
      const agent = createToolAwareDevAgent({ registryOverride: registry })

      expect(agent.toolRegistry.get('echo_tool')).toBe(mockTool)
    })
  })

  describe('executeWithTools – no LLM provider', () => {
    it('should fall back to DevAgent.execute when getLLMProvider returns null', async () => {
      ;(getLLMProvider as jest.Mock).mockReturnValue(null)
      const registry = new DefaultAgentToolRegistry()
      const agent = createToolAwareDevAgent({ registryOverride: registry })

      // DevAgent.execute is expected to return a response with agent: 'dev'
      const result = await agent.executeWithTools(mockTask, mockContext)

      // runAgenticLoop should NOT have been called
      expect(runAgenticLoop).not.toHaveBeenCalled()
      // result should come from DevAgent (has 'agent' field at minimum)
      expect(result).toBeDefined()
      expect(result.agent).toBe('dev')
    })
  })

  describe('executeWithTools – with LLM provider', () => {
    const mockLLMProvider = {
      complete: jest.fn(),
      completeWithTools: jest.fn(),
    } as unknown as LLMProviderWithTools

    it('should call runAgenticLoop when LLM is available', async () => {
      ;(getLLMProvider as jest.Mock).mockReturnValue(mockLLMProvider)
      ;(runAgenticLoop as jest.Mock).mockResolvedValue({
        finalAnswer: '{"files": []}',
        rounds: 2,
        toolCallsExecuted: 1,
      })

      const registry = new DefaultAgentToolRegistry()
      const agent = createToolAwareDevAgent({ registryOverride: registry })

      const result = await agent.executeWithTools(mockTask, mockContext)

      expect(runAgenticLoop).toHaveBeenCalledTimes(1)
      expect(result.agent).toBe('dev')
      expect(result.status).toBe('success')
      expect(result.metadata?.toolRounds).toBe(2)
      expect(result.metadata?.toolCallsExecuted).toBe(1)
    })

    it('should pass registry tools to runAgenticLoop', async () => {
      ;(getLLMProvider as jest.Mock).mockReturnValue(mockLLMProvider)
      ;(runAgenticLoop as jest.Mock).mockResolvedValue({
        finalAnswer: 'done',
        rounds: 1,
        toolCallsExecuted: 0,
      })

      const registry = new DefaultAgentToolRegistry()
      registry.register(mockTool)
      const agent = createToolAwareDevAgent({ registryOverride: registry })

      await agent.executeWithTools(mockTask, mockContext)

      // Second arg to runAgenticLoop is the registry
      const callArgs = (runAgenticLoop as jest.Mock).mock.calls[0]
      // callArgs[1] should be the registry (has the registered tool)
      const passedRegistry = callArgs[1]
      expect(passedRegistry.get('echo_tool')).toBeDefined()
    })

    it('should include task title and description in user prompt', async () => {
      ;(getLLMProvider as jest.Mock).mockReturnValue(mockLLMProvider)
      ;(runAgenticLoop as jest.Mock).mockResolvedValue({
        finalAnswer: 'done',
        rounds: 1,
        toolCallsExecuted: 0,
      })

      const registry = new DefaultAgentToolRegistry()
      const agent = createToolAwareDevAgent({ registryOverride: registry })

      await agent.executeWithTools(mockTask, mockContext)

      const callArgs = (runAgenticLoop as jest.Mock).mock.calls[0]
      const userPrompt: string = callArgs[3]
      expect(userPrompt).toContain(mockTask.title)
      expect(userPrompt).toContain(mockTask.description)
    })
  })

  describe('default registry selection', () => {
    it('should use local tools by default (no bridge env var)', () => {
      delete process.env.USE_OPENCLAW_GATEWAY
      const agent = createToolAwareDevAgent()
      const tools = agent.toolRegistry.listAll()
      // In local mode: ExecTool, FileTool, FetchTool, GitTool are registered
      expect(tools.length).toBeGreaterThanOrEqual(1)
      const names = tools.map(t => t.name)
      // At least one of the builtin tools
      expect(names.some(n => ['exec', 'file', 'fetch', 'git'].includes(n))).toBe(true)
    })

    it('should use bridge tools when USE_OPENCLAW_GATEWAY=true', () => {
      process.env.USE_OPENCLAW_GATEWAY = 'true'
      const agent = createToolAwareDevAgent()
      const tools = agent.toolRegistry.listAll()
      const names = tools.map(t => t.name)
      expect(names.some(n => n.includes('openclaw') || n.includes('oc_'))).toBe(true)
      delete process.env.USE_OPENCLAW_GATEWAY
    })

    it('should use bridge tools when useOpenClawBridge option is true', () => {
      delete process.env.USE_OPENCLAW_GATEWAY
      const agent = createToolAwareDevAgent({ useOpenClawBridge: true })
      const tools = agent.toolRegistry.listAll()
      const names = tools.map(t => t.name)
      expect(names.some(n => n.includes('openclaw') || n.includes('oc_'))).toBe(true)
    })
  })
})
