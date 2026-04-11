/**
 * ToolRegistry 单元测试
 */
import {
  DefaultAgentToolRegistry,
  getToolRegistry,
  setToolRegistry,
} from '../registry'
import { AgentTool, ToolCallRequest } from '../types'

const mockTool: AgentTool<{ input: string }, { output: string }> = {
  name: 'mock_tool',
  description: 'A mock tool for testing',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Test input' },
    },
    required: ['input'],
  },
  async execute({ input }) {
    return {
      success: true,
      data: { output: `processed: ${input}` },
      durationMs: 1,
    }
  },
  formatResult(result) {
    return result.success ? result.data?.output ?? '' : `Error: ${result.error}`
  },
}

const failingTool: AgentTool<{ input: string }, { output: string }> = {
  name: 'failing_tool',
  description: 'A tool that always fails',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Test input' },
    },
    required: ['input'],
  },
  async execute() {
    return {
      success: false,
      error: 'Intentional failure',
      durationMs: 0,
    }
  },
  formatResult(result) {
    return result.success ? result.data?.output ?? '' : `Error: ${result.error}`
  },
}

describe('DefaultAgentToolRegistry', () => {
  let registry: DefaultAgentToolRegistry

  beforeEach(() => {
    registry = new DefaultAgentToolRegistry()
  })

  describe('register / get / unregister', () => {
    it('should register and retrieve a tool', () => {
      registry.register(mockTool)
      const retrieved = registry.get('mock_tool')
      expect(retrieved).toBe(mockTool)
    })

    it('should return undefined for unregistered tool', () => {
      const retrieved = registry.get('nonexistent')
      expect(retrieved).toBeUndefined()
    })

    it('should unregister a tool', () => {
      registry.register(mockTool)
      registry.unregister('mock_tool')
      const retrieved = registry.get('mock_tool')
      expect(retrieved).toBeUndefined()
    })

    it('should warn on duplicate registration', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      registry.register(mockTool)
      registry.register(mockTool)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('listAll', () => {
    it('should return all registered tools', () => {
      registry.register(mockTool)
      registry.register(failingTool)
      const tools = registry.listAll()
      expect(tools).toHaveLength(2)
      expect(tools.map(t => t.name)).toContain('mock_tool')
      expect(tools.map(t => t.name)).toContain('failing_tool')
    })

    it('should return empty array when no tools registered', () => {
      const tools = registry.listAll()
      expect(tools).toHaveLength(0)
    })
  })

  describe('toOpenAIFunctions', () => {
    it('should convert tools to OpenAI function format', () => {
      registry.register(mockTool)
      const funcs = registry.toOpenAIFunctions()
      expect(funcs).toHaveLength(1)
      expect(funcs[0]).toEqual({
        type: 'function',
        function: {
          name: 'mock_tool',
          description: 'A mock tool for testing',
          parameters: mockTool.parameters,
        },
      })
    })

    it('should return empty array when no tools registered', () => {
      const funcs = registry.toOpenAIFunctions()
      expect(funcs).toHaveLength(0)
    })
  })

  describe('toAnthropicTools', () => {
    it('should convert tools to Anthropic format', () => {
      registry.register(mockTool)
      const tools = registry.toAnthropicTools()
      expect(tools).toHaveLength(1)
      expect(tools[0]).toEqual({
        name: 'mock_tool',
        description: 'A mock tool for testing',
        input_schema: mockTool.parameters,
      })
    })
  })

  describe('dispatch', () => {
    it('should execute a registered tool', async () => {
      registry.register(mockTool)
      const request: ToolCallRequest = {
        id: 'call_1',
        name: 'mock_tool',
        arguments: { input: 'hello' },
      }
      const result = await registry.dispatch(request)
      expect(result.toolCallId).toBe('call_1')
      expect(result.name).toBe('mock_tool')
      expect(result.content).toBe('processed: hello')
    })

    it('should return error for unregistered tool', async () => {
      const request: ToolCallRequest = {
        id: 'call_2',
        name: 'nonexistent_tool',
        arguments: {},
      }
      const result = await registry.dispatch(request)
      expect(result.content).toContain('not found')
    })

    it('should propagate tool execution error', async () => {
      registry.register(failingTool)
      const request: ToolCallRequest = {
        id: 'call_3',
        name: 'failing_tool',
        arguments: { input: 'test' },
      }
      const result = await registry.dispatch(request)
      expect(result.content).toContain('Error')
    })
  })
})

describe('Global Registry Singleton', () => {
  beforeEach(() => {
    setToolRegistry(new DefaultAgentToolRegistry())
  })

  it('should return global registry instance', () => {
    const registry1 = getToolRegistry()
    const registry2 = getToolRegistry()
    expect(registry1).toBe(registry2)
  })

  it('should allow replacing global registry', () => {
    const customRegistry = new DefaultAgentToolRegistry()
    customRegistry.register(mockTool)
    setToolRegistry(customRegistry)
    const retrieved = getToolRegistry()
    expect(retrieved.get('mock_tool')).toBe(mockTool)
  })
})
