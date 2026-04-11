/**
 * MCP Tool Adapter
 *
 * Adapts MCP tools discovered from an MCP server into ClawCompany's
 * AgentTool interface, so they can be registered in the tool registry
 * and used transparently by DevAgent and other agents.
 *
 * Usage:
 *   const client = new MCPClient()
 *   await client.connect()
 *   const tools = await createMCPToolAdapters(client)
 *   tools.forEach(t => registry.register(t))
 */

import { MCPClient, MCPTool, MCPCallToolResult } from './mcp-client'
import { AgentTool, ToolResult, ToolParameterSchema } from '../tools/types'

// ---------------------------------------------------------------------------
// MCPToolAdapter: wraps a single MCP tool as an AgentTool
// ---------------------------------------------------------------------------

export class MCPToolAdapter implements AgentTool<Record<string, unknown>, MCPCallToolResult> {
  readonly name: string
  readonly description: string
  readonly parameters: ToolParameterSchema

  constructor(
    private readonly mcpTool: MCPTool,
    private readonly client: MCPClient,
  ) {
    this.name = `mcp__${mcpTool.name}`
    this.description = mcpTool.description ?? `MCP tool: ${mcpTool.name}`
    this.parameters = (mcpTool.inputSchema as ToolParameterSchema) ?? {
      type: 'object',
      properties: {},
    }
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult<MCPCallToolResult>> {
    const start = Date.now()
    try {
      const result = await this.client.callTool(this.mcpTool.name, input)
      const isError = result.isError === true
      return {
        success: !isError,
        data: result,
        durationMs: Date.now() - start,
        error: isError ? this.extractText(result) : undefined,
      }
    } catch (err: unknown) {
      const e = err as Error
      return {
        success: false,
        error: e.message,
        durationMs: Date.now() - start,
      }
    }
  }

  formatResult(result: ToolResult<MCPCallToolResult>): string {
    if (!result.success || !result.data) {
      return `[mcp tool error] ${result.error}`
    }
    return this.extractText(result.data)
  }

  private extractText(result: MCPCallToolResult): string {
    return result.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text ?? '')
      .join('\n')
      .trim() || JSON.stringify(result.content)
  }
}

// ---------------------------------------------------------------------------
// Factory: discover all tools from an MCP server and return adapters
// ---------------------------------------------------------------------------

/**
 * Connects to an MCP server and returns AgentTool adapters for all
 * tools it exposes.
 *
 * @param serverUrl  MCP server URL. Falls back to MCP_SERVER_URL env var.
 * @param client     Optional pre-connected MCPClient (for testing/reuse).
 */
export async function createMCPToolAdapters(
  serverUrl?: string,
  client?: MCPClient,
): Promise<MCPToolAdapter[]> {
  const mcpClient = client ?? new MCPClient(serverUrl)

  if (!mcpClient.isConnected()) {
    await mcpClient.connect(serverUrl)
  }

  const tools = await mcpClient.listTools()
  return tools.map(t => new MCPToolAdapter(t, mcpClient))
}
