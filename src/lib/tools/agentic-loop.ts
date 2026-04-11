/**
 * ToolAwareBaseAgent - 支持 function calling / tool use 的 BaseAgent 扩展
 *
 * 设计原则：
 * 1. 对现有 BaseAgent 零破坏性改动 —— 通过组合而非继承扩展
 * 2. 同时支持 OpenAI（function_calling）和 Anthropic（tool_use）协议
 * 3. Agentic Loop：LLM 可多轮调用工具，直到返回 finish_reason='stop'
 */

import {
  AgentToolRegistry,
  ChatMessageWithTools,
  LLMProviderWithTools,
  ToolCallRequest,
  OpenAIFunctionDef,
} from './types'

export interface AgenticLoopOptions {
  /** 最大工具调用轮次，防止死循环，默认 10 */
  maxRounds?: number
  /** 调用工具前的钩子，返回 false 则跳过该工具 */
  onBeforeToolCall?: (call: ToolCallRequest) => boolean | Promise<boolean>
  /** 工具执行后的钩子 */
  onAfterToolCall?: (call: ToolCallRequest, result: string) => void
}

export interface AgenticLoopResult {
  finalAnswer: string
  rounds: number
  toolCallsExecuted: number
}

/**
 * 核心 Agentic Loop 实现
 *
 * 流程：
 *   system prompt（含工具列表描述）
 *   + user prompt
 *   → LLM 响应
 *   → 若含 tool_calls → 执行工具 → 追加 tool 消息 → 再次调用 LLM
 *   → 直到 finish_reason='stop' 或超过 maxRounds
 */
export async function runAgenticLoop(
  llm: LLMProviderWithTools,
  registry: AgentToolRegistry,
  systemPrompt: string,
  userPrompt: string,
  options: AgenticLoopOptions = {},
): Promise<AgenticLoopResult> {
  const { maxRounds = 10, onBeforeToolCall, onAfterToolCall } = options

  // 将工具描述注入 system prompt（供不支持 native function_call 的模型使用）
  const toolDescriptions = registry.listAll()
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n')

  const enrichedSystemPrompt = toolDescriptions.length > 0
    ? `${systemPrompt}\n\n## 可用工具\n${toolDescriptions}`
    : systemPrompt

  const tools: OpenAIFunctionDef[] = registry.toOpenAIFunctions()

  const messages: ChatMessageWithTools[] = [
    { role: 'system', content: enrichedSystemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let rounds = 0
  let toolCallsExecuted = 0

  while (rounds < maxRounds) {
    rounds++
    const response = await llm.chatWithTools(messages, tools)

    // 无工具调用 → 返回最终答案
    if (response.finish_reason === 'stop' || !response.tool_calls?.length) {
      return {
        finalAnswer: response.content ?? '',
        rounds,
        toolCallsExecuted,
      }
    }

    // 将 assistant 的 tool_calls 消息加入历史
    messages.push({
      role: 'assistant',
      content: response.content ?? '',
      tool_calls: response.tool_calls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    })

    // 依次执行所有工具（串行，保证顺序一致性）
    for (const toolCall of response.tool_calls) {
      // 调用前钩子
      if (onBeforeToolCall) {
        const allowed = await onBeforeToolCall(toolCall)
        if (!allowed) {
          messages.push({
            role: 'tool',
            content: `[skipped by policy]`,
            tool_call_id: toolCall.id,
            name: toolCall.name,
          })
          continue
        }
      }

      const result = await registry.dispatch(toolCall)
      toolCallsExecuted++

      if (onAfterToolCall) {
        onAfterToolCall(toolCall, result.content)
      }

      // 将工具结果追加到消息历史
      messages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.toolCallId,
        name: result.name,
      })
    }
    // 继续下一轮 LLM 调用
  }

  return {
    finalAnswer: '[max rounds reached] 工具调用轮次超出限制',
    rounds,
    toolCallsExecuted,
  }
}

// ---------------------------------------------------------------------------
// 将现有 LLMProvider.chat() 适配为 LLMProviderWithTools
// 通过 system prompt 注入工具说明，解析 LLM 文本输出中的工具调用
// （适用于不支持 native function_call 的模型，如 GLM）
// ---------------------------------------------------------------------------

import { LLMProvider, ChatMessage } from '../llm/types'

/**
 * 文本协议格式（当 LLM 不支持 native function_call 时）：
 *
 * LLM 回复格式：
 * ```
 * TOOL_CALL: {"tool": "exec", "args": {"command": "ls", "args": ["-la"]}}
 * ```
 * 或直接回复最终答案（不含 TOOL_CALL）
 */
export function adaptLLMProviderToTools(provider: LLMProvider): LLMProviderWithTools {
  return {
    async chatWithTools(messages, _tools) {
      // 将 tool 角色消息转换为 user 消息（文本协议兼容）
      const adapted: ChatMessage[] = messages.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: `[Tool Result: ${m.name}]\n${m.content}`,
          }
        }
        return { role: m.role as 'system' | 'user' | 'assistant', content: m.content }
      })

      const raw = await provider.chat(adapted)
      if (!raw) return { content: '', finish_reason: 'stop' }

      // 尝试解析 TOOL_CALL 指令
      const toolCallMatch = raw.match(/TOOL_CALL:\s*(\{[\s\S]*?\})/m)
      if (toolCallMatch) {
        try {
          const parsed = JSON.parse(toolCallMatch[1]) as { tool: string; args: Record<string, unknown> }
          return {
            content: raw.replace(/TOOL_CALL:[\s\S]*$/, '').trim(),
            finish_reason: 'tool_calls',
            tool_calls: [{
              id: `call_${Date.now()}`,
              name: parsed.tool,
              arguments: parsed.args ?? {},
            }],
          }
        } catch {
          // 解析失败则作为普通文本返回
        }
      }

      return { content: raw, finish_reason: 'stop' }
    },
  }
}
