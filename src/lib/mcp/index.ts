/**
 * MCP Registry Integration
 *
 * Registers MCP tools from a remote server into the global AgentToolRegistry.
 * Called at application startup or when MCP_SERVER_URL is configured.
 *
 * Usage (in app startup or an API route):
 *   import { registerMCPTools } from '@/lib/mcp'
 *   await registerMCPTools()   // uses MCP_SERVER_URL env var
 *
 * Or with an explicit URL:
 *   await registerMCPTools('http://localhost:3001/mcp')
 */

import { getToolRegistry } from '../tools/registry'
import { AgentToolRegistry } from '../tools/types'
import { MCPClient } from './mcp-client'
import { createMCPToolAdapters } from './mcp-tool-adapter'

export interface MCPRegistrationResult {
  serverName: string
  serverVersion: string
  toolsRegistered: string[]
  toolsSkipped: string[]
}

/**
 * Connect to the MCP server at `serverUrl` (or MCP_SERVER_URL),
 * discover all tools, and register them into the tool registry.
 *
 * Tools are registered with a `mcp__` prefix to avoid collisions.
 * If the same MCP tool name was already registered, it's overwritten.
 *
 * @param serverUrl  Optional override for MCP_SERVER_URL
 * @param registry   Optional registry (defaults to global singleton)
 */
export async function registerMCPTools(
  serverUrl?: string,
  registry?: AgentToolRegistry,
): Promise<MCPRegistrationResult> {
  const url = serverUrl ?? process.env.MCP_SERVER_URL
  if (!url) {
    throw new Error(
      'No MCP server URL provided. Set the MCP_SERVER_URL environment variable ' +
      'or pass a URL to registerMCPTools().',
    )
  }

  const reg = registry ?? getToolRegistry()
  const client = new MCPClient(url)
  const serverInfo = await client.connect()
  const adapters = await createMCPToolAdapters(url, client)

  const existingNames = new Set(reg.listAll().map(t => t.name))
  const registered: string[] = []
  const skipped: string[] = []

  for (const adapter of adapters) {
    if (existingNames.has(adapter.name)) {
      // Overwrite is allowed (registry.register warns but proceeds)
      skipped.push(adapter.name)
    }
    reg.register(adapter)
    registered.push(adapter.name)
  }

  return {
    serverName: serverInfo.name,
    serverVersion: serverInfo.version,
    toolsRegistered: registered,
    toolsSkipped: skipped,
  }
}

// Re-export everything for convenient imports
export { MCPClient } from './mcp-client'
export type { MCPTool, MCPCallToolResult, MCPServerInfo, MCPClientOptions } from './mcp-client'
export { MCPToolAdapter, createMCPToolAdapters } from './mcp-tool-adapter'
