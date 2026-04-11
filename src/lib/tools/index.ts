/**
 * ClawCompany Tools Module - 统一导出
 */

export * from './types'
export * from './registry'
export * from './builtin-tools'
export * from './verify-tool'
export * from './openclaw-bridge'
export * from './agentic-loop'
export { createToolAwareDevAgent } from './tool-aware-dev-agent'
export * from './shadow-git'

// MCP Client - external tool server integration
export { MCPClient, MCPToolAdapter, createMCPToolAdapters, registerMCPTools } from '../mcp'
export type { MCPTool, MCPCallToolResult, MCPServerInfo, MCPClientOptions } from '../mcp'
