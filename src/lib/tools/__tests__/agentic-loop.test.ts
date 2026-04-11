/**
 * Agentic Loop 单元测试
 */
import { runAgenticLoop, adaptLLMProviderToTools } from '../agentic-loop'
import { DefaultAgentToolRegistry } from '../registry'
import { AgentTool, ToolResult, ToolParameterSchema, LLMProviderWithTools } from '../types'

const mockTool: AgentTool<{ message: string }, { echo: string }> = {
  name: 'echo',
  description: 'Echo back the input message',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Message to echo' },
    },
    required: ['message'],
  },
  async execute({ message }) {
    return {
      success: true,
      data: { echo: message },
      durationMs: 1,
    }
  },
  formatResult(result) {
    return result.success ? result.data?.echo ?? '' : `Error: ${result.error}`
  },
}

const mockLLMProvider: LLMProviderWithTools = {
  async chatWithTools(messages, tools) {
    const lastMessage = messages[messages.length - 1]
    const hasToolResult = lastMessage.role === 'tool'
    
    if (hasToolResult) {
      return {
        content: 'This is my final answer.',
        finish_reason: 'stop',
      }
    }
    
    if (lastMessage.content.includes('tool')) {
      return {
        content: 'I need to call a tool.',
        finish_reason: 'tool_calls',
        tool_calls: [{
          id: 'call_1',
          name: 'echo',
          arguments: { message: 'hello from tool' },
        }],
      }
    }
    
    return {
      content: 'Hello, world!',
      finish_reason: 'stop',
    }
  },
}

const mockFailingLLMProvider: LLMProviderWithTools = {
  async chatWithTools() {
    return {
      content: 'Error occurred',
      finish_reason: 'stop',
    }
  },
}

describe('runAgenticLoop', () => {
  let registry: DefaultAgentToolRegistry

  beforeEach(() => {
    registry = new DefaultAgentToolRegistry()
    registry.register(mockTool)
  })

  it('should return final answer without tool calls', async () => {
    const result = await runAgenticLoop(
      mockFailingLLMProvider,
      registry,
      'You are a helpful assistant.',
      'Give me a final answer.',
      { maxRounds: 3 }
    )
    
    expect(result.finalAnswer).toBeTruthy()
    expect(result.rounds).toBe(1)
    expect(result.toolCallsExecuted).toBe(0)
  })

  it('should execute tool and continue loop', async () => {
    const toolCallLog: string[] = []
    
    const result = await runAgenticLoop(
      mockLLMProvider,
      registry,
      'You are a helpful assistant.',
      'Call a tool please.',
      {
        maxRounds: 3,
        onAfterToolCall: (call, result) => {
          toolCallLog.push(`${call.name}: ${result}`)
        },
      }
    )
    
    expect(result.toolCallsExecuted).toBe(1)
    expect(toolCallLog).toContain('echo: hello from tool')
  })

  it('should respect maxRounds limit', async () => {
    const infiniteCallProvider: LLMProviderWithTools = {
      async chatWithTools() {
        return {
          content: 'Calling tool again',
          finish_reason: 'tool_calls',
          tool_calls: [{
            id: 'call_loop',
            name: 'echo',
            arguments: { message: 'loop' },
          }],
        }
      },
    }
    
    const result = await runAgenticLoop(
      infiniteCallProvider,
      registry,
      'You are a helpful assistant.',
      'Keep calling tools.',
      { maxRounds: 2 }
    )
    
    expect(result.finalAnswer).toContain('max rounds')
    expect(result.rounds).toBe(2)
    expect(result.toolCallsExecuted).toBe(2)
  })

  it('should call onBeforeToolCall hook', async () => {
    const allowedTools = new Set(['echo'])
    const blockedTools = new Set(['blocked_tool'])
    
    const blockedTool: AgentTool = {
      name: 'blocked_tool',
      description: 'This tool should be blocked',
      parameters: { type: 'object', properties: {} },
      async execute() {
        return { success: true }
      },
      formatResult() { return 'ok' },
    }
    registry.register(blockedTool)
    
    const blockedProvider: LLMProviderWithTools = {
      async chatWithTools() {
        return {
          content: 'Calling blocked tool',
          finish_reason: 'tool_calls',
          tool_calls: [{
            id: 'call_blocked',
            name: 'blocked_tool',
            arguments: {},
          }],
        }
      },
    }
    
    const result = await runAgenticLoop(
      blockedProvider,
      registry,
      'You are a helpful assistant.',
      'Test blocking.',
      {
        maxRounds: 1,
        onBeforeToolCall: (call) => {
          return !blockedTools.has(call.name)
        },
      }
    )
    
    expect(result.toolCallsExecuted).toBe(0)
  })

  it('should inject tool descriptions into system prompt', async () => {
    const capturedPrompts: string[] = []
    const capturingProvider: LLMProviderWithTools = {
      async chatWithTools(messages) {
        capturedPrompts.push(messages[0].content)
        return { content: 'done', finish_reason: 'stop' }
      },
    }
    
    await runAgenticLoop(
      capturingProvider,
      registry,
      'Base system prompt.',
      'Test.',
    )
    
    expect(capturedPrompts[0]).toContain('可用工具')
    expect(capturedPrompts[0]).toContain('echo')
  })
})

describe('adaptLLMProviderToTools', () => {
  it('should adapt regular provider for tool use', () => {
    const adapted = adaptLLMProviderToTools({
      async chat() { return 'Response' },
    } as any)
    
    expect(adapted.chatWithTools).toBeDefined()
  })

  it('should adapt provider with tool support', async () => {
    const adapted = adaptLLMProviderToTools({
      async chat(_messages: unknown[]) {
        return 'Adapted response'
      },
    } as any)
    
    const result = await adapted.chatWithTools(
      [{ role: 'user', content: 'Test' }],
      []
    )
    
    expect(result.finish_reason).toBe('stop')
  })

  it('should return stop for responses without TOOL_CALL', async () => {
    const adapted = adaptLLMProviderToTools({
      async chat() {
        return 'Plain text response without tool call'
      },
    } as any)
    
    const result = await adapted.chatWithTools(
      [{ role: 'user', content: 'Hello' }],
      []
    )
    
    expect(result.finish_reason).toBe('stop')
    expect(result.content).toBe('Plain text response without tool call')
  })

  it('should return stop when no TOOL_CALL found', async () => {
    const adapted = adaptLLMProviderToTools({
      async chat() {
        return 'Just a regular response without any tool call.'
      },
    } as any)
    
    const result = await adapted.chatWithTools(
      [{ role: 'user', content: 'Hello' }],
      []
    )
    
    expect(result.finish_reason).toBe('stop')
    expect(result.tool_calls).toBeUndefined()
  })
})
