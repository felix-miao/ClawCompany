/**
 * Context Compression — lightweight Hermes-style history compressor
 *
 * Trigger conditions (either):
 *   - message count > COMPRESSION_TRIGGER_COUNT (20)
 *   - estimated token count > COMPRESSION_TRIGGER_TOKENS (50K)
 *
 * Compression strategy:
 *   1. Keep last RECENT_KEEP (5) messages verbatim
 *   2. Summarise older messages via LLM (≤ SUMMARY_MAX_CHARS chars)
 *   3. Return: [summary message] + [last 5 messages]
 *
 * Falls back to a simple tail-truncation summary when no LLM is available.
 */

import { ChatMessage } from '../core/types'
import { getLLMProvider } from '../llm/factory'

// ─── Thresholds ────────────────────────────────────────────────────────────────

/** Trigger compression when stored message count exceeds this. */
export const COMPRESSION_TRIGGER_COUNT = 20

/**
 * Trigger compression when estimated token count exceeds this.
 * Token estimate: characters / 4 (rough but safe for mixed CJK+Latin text).
 */
export const COMPRESSION_TRIGGER_TOKENS = 50_000

/** Number of most-recent messages to keep verbatim after compression. */
export const RECENT_KEEP = 5

/**
 * Maximum character budget for the LLM-generated summary
 * (~2000 tokens × 4 chars/token for mixed CJK).
 */
export const SUMMARY_MAX_CHARS = 8_000

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Rough token estimate: 1 token ≈ 4 chars (safe for CJK + English mix). */
function estimateTokens(messages: ChatMessage[]): number {
  return Math.ceil(
    messages.reduce((sum, m) => sum + m.content.length, 0) / 4,
  )
}

/** Returns true when the history is large enough to warrant compression. */
export function shouldCompress(messages: ChatMessage[]): boolean {
  return (
    messages.length > COMPRESSION_TRIGGER_COUNT ||
    estimateTokens(messages) > COMPRESSION_TRIGGER_TOKENS
  )
}

/** Simple fallback summary when LLM is unavailable. */
function buildFallbackSummary(messages: ChatMessage[]): string {
  const lines = messages
    .slice(-10)
    .map(m => `[${m.agent}]: ${m.content.slice(0, 200)}`)
    .join('\n')
  return (
    `[历史摘要 - 共 ${messages.length} 条消息，以下为最近 10 条摘录]\n${lines}`
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Compress chat history if it exceeds configured thresholds.
 *
 * Returns the original array unchanged when compression is not needed.
 * When compression is triggered:
 *   - Calls the LLM to summarise older messages (or uses fallback)
 *   - Returns [summaryMessage, ...last-5-messages]
 *
 * @param messages  Full chat history from ChatManager.getHistory()
 * @param llm       Optional LLM provider override (defaults to getLLMProvider())
 */
export async function compressHistory(
  messages: ChatMessage[],
  llm?: ReturnType<typeof getLLMProvider>,
): Promise<ChatMessage[]> {
  if (!shouldCompress(messages)) return messages

  const recentMessages = messages.slice(-RECENT_KEEP)
  const olderMessages = messages.slice(0, -RECENT_KEEP)

  // Edge case: nothing old enough to summarise
  if (olderMessages.length === 0) return messages

  let summaryContent: string

  const provider = llm ?? getLLMProvider()
  if (provider) {
    try {
      const historyText = olderMessages
        .map(m => `[${m.agent}]: ${m.content}`)
        .join('\n')
        // Guard: don't feed absurdly large text to the LLM
        .slice(0, 60_000)

      const systemPrompt = `你是对话历史压缩助手。请将用户提供的对话历史压缩为结构化摘要。
要求：
1. 保留关键决策、任务分配、代码方案、重要结论
2. 摘要总长度控制在 ${SUMMARY_MAX_CHARS} 字符以内
3. 使用清晰的中文按时间顺序描述关键事件
4. 输出格式：纯文本，每条事件一行，以"- "开头`

      const userPrompt = `请将以下 ${olderMessages.length} 条对话历史压缩为摘要：\n\n${historyText}`

      const response = await provider.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ])

      summaryContent = response
        ? `[历史摘要 - 已压缩 ${olderMessages.length} 条消息]\n${response}`
        : buildFallbackSummary(olderMessages)
    } catch {
      summaryContent = buildFallbackSummary(olderMessages)
    }
  } else {
    summaryContent = buildFallbackSummary(olderMessages)
  }

  // Clamp summary to character budget
  if (summaryContent.length > SUMMARY_MAX_CHARS) {
    summaryContent = summaryContent.slice(0, SUMMARY_MAX_CHARS) + '\n[摘要已截断]'
  }

  const summaryMessage: ChatMessage = {
    agent: 'pm' as const,
    content: summaryContent,
    type: 'text',
    // Use oldest message's timestamp so ordering is preserved
    timestamp: olderMessages[0]?.timestamp ?? new Date(),
    metadata: {
      taskId: 'context-compression-summary',
    },
  }

  return [summaryMessage, ...recentMessages]
}
