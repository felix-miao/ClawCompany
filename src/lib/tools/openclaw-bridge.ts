/**
 * OpenClawBridgeTool
 *
 * 通过 OpenClaw Gateway WebSocket 调用 OpenClaw 宿主内置工具。
 * 当 ClawCompany 作为 OpenClaw Plugin 运行时，借助已建立的 WS 连接
 * 将 exec / read / write / fetch 等操作委托给 OpenClaw 执行，
 * 从而获得沙箱权限、日志追踪和审计能力。
 *
 * 协议格式（JSON-RPC 2.0）：
 *   请求: { jsonrpc: '2.0', id: N, method: 'tool.invoke', params: { tool, input, auth } }
 *   响应: { jsonrpc: '2.0', id: N, result: { success, data, error } }
 */

import { OpenClawGatewayClient } from '../gateway/client'
import { AgentTool, ToolResult, ToolParameterSchema } from './types'

// ---------------------------------------------------------------------------
// 支持的 OpenClaw 内置工具名
// ---------------------------------------------------------------------------
export type OpenClawBuiltinTool =
  | 'exec'
  | 'read'
  | 'write'
  | 'web_search'
  | 'web_fetch'
  | 'browser'

export interface BridgeInput {
  /** 要调用的 OpenClaw 原生工具名 */
  tool: OpenClawBuiltinTool
  /** 传递给该工具的参数（与 OpenClaw 工具的参数格式完全一致） */
  params: Record<string, unknown>
}

export interface BridgeOutput {
  raw: unknown
}

// ---------------------------------------------------------------------------
// OpenClawBridgeTool
// ---------------------------------------------------------------------------

export class OpenClawBridgeTool implements AgentTool<BridgeInput, BridgeOutput> {
  readonly name = 'openclaw_bridge'
  readonly description =
    '通过 OpenClaw Gateway 调用 OpenClaw 宿主内置工具（exec/read/write/web_search/web_fetch/browser）。' +
    '用于需要真实系统权限的操作。调用前确认 tool 参数合法。'

  readonly parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        enum: ['exec', 'read', 'write', 'web_search', 'web_fetch', 'browser'],
        description: 'OpenClaw 内置工具名',
      },
      params: {
        type: 'object',
        description: '传递给该工具的参数对象，与 OpenClaw 工具签名一致',
      },
    },
    required: ['tool', 'params'],
  } as ToolParameterSchema

  constructor(private readonly client: OpenClawGatewayClient) {}

  async execute(input: BridgeInput): Promise<ToolResult<BridgeOutput>> {
    const start = Date.now()

    if (!this.client.isConnected()) {
      try {
        await this.client.connect()
      } catch (err) {
        return { success: false, error: `Cannot connect to OpenClaw Gateway: ${err}` }
      }
    }

    try {
      const result = await this.client.call<{ success: boolean; data?: unknown; error?: string }>(
        'tool.invoke',
        { tool: input.tool, input: input.params }
      )

      return {
        success: result.success,
        data: { raw: result.data },
        error: result.error,
        durationMs: Date.now() - start,
      }
    } catch (err: unknown) {
      const e = err as Error
      return { success: false, error: e.message, durationMs: Date.now() - start }
    }
  }

  formatResult(result: ToolResult<BridgeOutput>): string {
    if (!result.success || !result.data) {
      return `[openclaw_bridge error] ${result.error}`
    }
    const raw = result.data.raw
    if (typeof raw === 'string') return raw
    return JSON.stringify(raw, null, 2)
  }
}

// ---------------------------------------------------------------------------
// 便捷工厂：为常用的 OpenClaw 工具创建专门的 AgentTool
// 语义更清晰，LLM 更容易选择正确工具
// ---------------------------------------------------------------------------

function makeBridgedTool(
  toolName: OpenClawBuiltinTool,
  agentToolName: string,
  description: string,
  parameters: ToolParameterSchema,
  client: OpenClawGatewayClient,
): AgentTool {
  const bridge = new OpenClawBridgeTool(client)
  return {
    name: agentToolName,
    description,
    parameters,
    async execute(input: Record<string, unknown>) {
      return bridge.execute({ tool: toolName, params: input })
    },
    formatResult(result) {
      return bridge.formatResult(result)
    },
  }
}

export function createOpenClawExecTool(client: OpenClawGatewayClient): AgentTool {
  return makeBridgedTool(
    'exec',
    'oc_exec',
    '通过 OpenClaw 宿主执行 Shell 命令，获得完整系统权限和审计日志',
    {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell 命令字符串' },
        timeout: { type: 'number', description: '超时秒数' },
        workdir: { type: 'string', description: '工作目录' },
      },
      required: ['command'],
    } as ToolParameterSchema,
    client,
  )
}

export function createOpenClawReadTool(client: OpenClawGatewayClient): AgentTool {
  return makeBridgedTool(
    'read',
    'oc_read',
    '通过 OpenClaw 宿主读取文件内容',
    {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件绝对路径' },
        offset: { type: 'number', description: '起始行号（1-indexed）' },
        limit: { type: 'number', description: '最多读取行数' },
      },
      required: ['path'],
    } as ToolParameterSchema,
    client,
  )
}

export function createOpenClawWriteTool(client: OpenClawGatewayClient): AgentTool {
  return makeBridgedTool(
    'write',
    'oc_write',
    '通过 OpenClaw 宿主写入文件内容（覆盖写入）',
    {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件绝对路径' },
        content: { type: 'string', description: '写入内容' },
      },
      required: ['path', 'content'],
    } as ToolParameterSchema,
    client,
  )
}

export function createOpenClawSearchTool(client: OpenClawGatewayClient): AgentTool {
  return makeBridgedTool(
    'web_search',
    'oc_web_search',
    '通过 OpenClaw 宿主进行网络搜索（Brave Search API）',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        count: { type: 'number', description: '返回结果数量，默认 5' },
      },
      required: ['query'],
    } as ToolParameterSchema,
    client,
  )
}
