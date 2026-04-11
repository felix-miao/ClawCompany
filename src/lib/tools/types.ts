/**
 * AgentToolRegistry - ClawCompany Plugin SDK
 *
 * 让 ClawCompany 的 Agent 能调用真实工具（exec、文件读写、HTTP、git 等）。
 * 支持 OpenAI function calling / Anthropic tool_use 两种协议。
 */

// ---------------------------------------------------------------------------
// 核心接口
// ---------------------------------------------------------------------------

/**
 * 工具的 JSON Schema 参数描述，对应 OpenAI function_call.parameters
 */
export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description: string
    enum?: string[]
    default?: unknown
  }>
  required?: string[]
}

/**
 * 工具调用结果
 */
export interface ToolResult<TOutput = unknown> {
  success: boolean
  data?: TOutput
  error?: string
  /** 执行耗时（ms） */
  durationMs?: number
}

/**
 * 单个工具的核心抽象
 * TInput  - 工具入参类型
 * TOutput - 工具出参类型
 */
export interface AgentTool<TInput = Record<string, unknown>, TOutput = unknown> {
  /** 唯一工具名，LLM function_call 中使用 */
  readonly name: string
  /** 工具用途描述，注入 LLM system prompt */
  readonly description: string
  /** JSON Schema，用于生成 function_call.parameters */
  readonly parameters: ToolParameterSchema
  /** 执行工具逻辑 */
  execute(input: TInput): Promise<ToolResult<TOutput>>
  /** 将结果序列化为 LLM 可理解的文本 */
  formatResult(result: ToolResult<TOutput>): string
}

/**
 * LLM function_call / tool_use 消息中携带的调用信息
 */
export interface ToolCallRequest {
  id: string         // tool_call_id，用于关联 tool result
  name: string       // 对应 AgentTool.name
  arguments: Record<string, unknown>
}

/**
 * 工具执行完成后，用于回馈 LLM 的消息
 */
export interface ToolCallResult {
  toolCallId: string
  name: string
  content: string    // 工具执行结果的文本表示
}

// ---------------------------------------------------------------------------
// AgentToolRegistry
// ---------------------------------------------------------------------------

/**
 * 工具注册表：管理所有可用工具，提供 LLM schema 生成和工具分发执行
 */
export interface AgentToolRegistry {
  /** 注册工具 */
  register(tool: AgentTool): void
  /** 注销工具 */
  unregister(name: string): void
  /** 获取工具 */
  get(name: string): AgentTool | undefined
  /** 列出所有已注册工具 */
  listAll(): AgentTool[]
  /**
   * 生成 OpenAI 格式的 tools 数组，直接用于 API 请求
   * [{ type: 'function', function: { name, description, parameters } }]
   */
  toOpenAIFunctions(): OpenAIFunctionDef[]
  /**
   * 生成 Anthropic 格式的 tools 数组
   */
  toAnthropicTools(): AnthropicToolDef[]
  /**
   * 根据 LLM 返回的 ToolCallRequest 执行工具，返回可直接追加到消息历史的结果
   */
  dispatch(call: ToolCallRequest): Promise<ToolCallResult>
}

// ---------------------------------------------------------------------------
// LLM 协议辅助类型
// ---------------------------------------------------------------------------

export interface OpenAIFunctionDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: ToolParameterSchema
  }
}

export interface AnthropicToolDef {
  name: string
  description: string
  input_schema: ToolParameterSchema
}

/**
 * 扩展 LLMProvider 支持 function calling
 * 这是对现有 llm/types.ts 的增量扩展，保持向后兼容
 */
export interface ChatMessageWithTools {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string // 仅 role='tool' 时使用
  name?: string         // 仅 role='tool' 时使用（工具名）
}

export interface LLMToolCallResponse {
  content: string | null
  tool_calls?: ToolCallRequest[]
  finish_reason: 'stop' | 'tool_calls' | 'length'
}

export interface LLMProviderWithTools {
  chatWithTools(
    messages: ChatMessageWithTools[],
    tools: OpenAIFunctionDef[],
    options?: { maxTokens?: number }
  ): Promise<LLMToolCallResponse>
}
