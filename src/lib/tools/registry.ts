/**
 * AgentToolRegistry 实现
 */
import {
  AgentTool,
  AgentToolRegistry,
  ToolCallRequest,
  ToolCallResult,
  OpenAIFunctionDef,
  AnthropicToolDef,
} from './types'

export class DefaultAgentToolRegistry implements AgentToolRegistry {
  private tools = new Map<string, AgentTool<Record<string, unknown>, unknown>>()

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Tool "${tool.name}" is already registered. Overwriting.`)
    }
    this.tools.set(tool.name, tool)
  }

  unregister(name: string): void {
    this.tools.delete(name)
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  listAll(): AgentTool[] {
    return Array.from(this.tools.values())
  }

  toOpenAIFunctions(): OpenAIFunctionDef[] {
    return this.listAll().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }

  toAnthropicTools(): AnthropicToolDef[] {
    return this.listAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }))
  }

  async dispatch(call: ToolCallRequest): Promise<ToolCallResult> {
    const tool = this.tools.get(call.name)
    if (!tool) {
      return {
        toolCallId: call.id,
        name: call.name,
        content: `Error: tool "${call.name}" not found in registry`,
      }
    }

    const result = await tool.execute(call.arguments)
    return {
      toolCallId: call.id,
      name: call.name,
      content: tool.formatResult(result),
    }
  }
}

// 全局单例（可被测试替换）
let _globalRegistry: AgentToolRegistry | null = null

export function getToolRegistry(): AgentToolRegistry {
  if (!_globalRegistry) {
    _globalRegistry = new DefaultAgentToolRegistry()
  }
  return _globalRegistry
}

export function setToolRegistry(registry: AgentToolRegistry): void {
  _globalRegistry = registry
}
