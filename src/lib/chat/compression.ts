/**
 * Context Compression — lightweight Hermes-style history compressor
 *
 * Trigger conditions (either):
 *   - message count > COMPRESSION_TRIGGER_COUNT (20)
 *   - estimated token count > COMPRESSION_TRIGGER_TOKENS (50K)
 *
 * Compression strategy:
 *   1. Keep last RECENT_KEEP (5) messages verbatim
 *   2. Adjust compression boundary to avoid orphaned tool_call messages
 *      (P0 fix: a tool_call without its tool_result causes API errors)
 *   3. Summarise older messages via LLM (≤ SUMMARY_MAX_CHARS chars)
 *      - Incremental summary: if a prior summary already exists, update it
 *        rather than re-generating from scratch (P1 fix)
 *   4. Return: [summaryMessage] + [last-N messages]
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

/**
 * P0 fix: Find a safe split index so that no tool_call is left without its
 * corresponding tool_result inside the "older" (to-be-summarised) slice.
 *
 * A tool_call message is identified by `metadata.toolCallId` being absent but
 * a follow-up message having `metadata.toolCallId` set (conventional pairing).
 *
 * Because ClawCompany uses a simple role-based ChatMessage schema (not OpenAI's
 * multi-part message format), tool pairing is tracked via metadata:
 *   - tool_call message: `metadata.taskId` prefixed with "tool_call:" OR
 *     message whose immediately following message has `metadata.toolCallId`
 *   - tool_result message: `metadata.toolCallId` set to id of its tool_call
 *
 * Strategy: scan from the proposed splitIndex backward until we land on a
 * boundary where no orphaned tool_call is stranded.
 *
 * @param messages   Full history array
 * @param splitIndex Proposed index: messages[0..splitIndex-1] will be summarised
 * @returns          Safe split index (may be equal to or less than splitIndex)
 */
function findSafeSplitIndex(messages: ChatMessage[], splitIndex: number): number {
  // Walk backward from splitIndex-1 to find any orphaned tool_call
  // An orphaned tool_call is one whose result falls at index >= splitIndex
  let safe = splitIndex

  for (let i = 0; i < safe; i++) {
    const msg = messages[i]
    // Detect a tool_call by: next message has toolCallId pointing to this msg's id
    const msgId = msg.id
    if (!msgId) continue

    // Check if any message inside the "recent" slice (index >= safe) is the
    // result of this tool_call
    for (let j = safe; j < messages.length; j++) {
      if (messages[j].metadata?.toolCallId === msgId) {
        // This tool_call at i has its result at j (which is in the recent slice).
        // We must include BOTH in the recent slice → move safe boundary to i
        safe = i
        break
      }
    }
  }

  return safe
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Compress chat history if it exceeds configured thresholds.
 *
 * Returns the original array unchanged when compression is not needed.
 * When compression is triggered:
 *   - P0: Adjusts the compression boundary to prevent orphaned tool_call messages
 *   - P1: Uses incremental summarisation if a prior summary message exists
 *   - Returns [summaryMessage, ...last-N messages]
 *
 * @param messages  Full chat history from ChatManager.getHistory()
 * @param llm       Optional LLM provider override (defaults to getLLMProvider())
 */
export async function compressHistory(
  messages: ChatMessage[],
  llm?: ReturnType<typeof getLLMProvider>,
): Promise<ChatMessage[]> {
  if (!shouldCompress(messages)) return messages

  // ── Determine raw split boundary (recent vs. older) ──────────────────────
  const rawSplitIndex = Math.max(0, messages.length - RECENT_KEEP)

  // P0: adjust boundary so no tool_call/result pair is split across slices
  const splitIndex = findSafeSplitIndex(messages, rawSplitIndex)

  const olderMessages = messages.slice(0, splitIndex)
  const recentMessages = messages.slice(splitIndex)

  // Edge case: nothing old enough to summarise
  if (olderMessages.length === 0) return messages

  // ── P1: Find existing summary to update incrementally ────────────────────
  // The previous summary (if any) is the first message and carries isSummary=true
  const existingSummaryMsg =
    olderMessages.length > 0 && olderMessages[0].metadata?.isSummary === true
      ? olderMessages[0]
      : null

  // Messages that need to be newly summarised (exclude the existing summary)
  const messagesToSummarise = existingSummaryMsg
    ? olderMessages.slice(1)
    : olderMessages

  let summaryContent: string

  const provider = llm ?? getLLMProvider()
  if (provider) {
    try {
      const historyText = messagesToSummarise
        .map(m => `[${m.agent}]: ${m.content}`)
        .join('\n')
        // Guard: don't feed absurdly large text to the LLM
        .slice(0, 60_000)

      let systemPrompt: string
      let userPrompt: string

      if (existingSummaryMsg) {
        // P1: incremental — update existing summary with new information
        systemPrompt = `你是对话历史压缩助手。你有一份已有的历史摘要，以及一批新对话记录。
请在已有摘要的基础上，补充新内容，更新为最新的结构化摘要。
要求：
1. 保留原摘要中仍然相关的关键决策、任务分配、代码方案、重要结论
2. 将新对话中的重要信息补充到摘要中
3. 摘要总长度控制在 ${SUMMARY_MAX_CHARS} 字符以内
4. 使用清晰的中文按时间顺序描述关键事件
5. 输出格式：纯文本，每条事件一行，以"- "开头`

        userPrompt =
          `已有摘要：\n${existingSummaryMsg.content}\n\n` +
          `新增 ${messagesToSummarise.length} 条对话：\n\n${historyText}\n\n` +
          `请更新摘要，整合以上新内容：`
      } else {
        // First-time full summary
        systemPrompt = `你是对话历史压缩助手。请将用户提供的对话历史压缩为结构化摘要。
要求：
1. 保留关键决策、任务分配、代码方案、重要结论
2. 摘要总长度控制在 ${SUMMARY_MAX_CHARS} 字符以内
3. 使用清晰的中文按时间顺序描述关键事件
4. 输出格式：纯文本，每条事件一行，以"- "开头`

        userPrompt =
          `请将以下 ${messagesToSummarise.length} 条对话历史压缩为摘要：\n\n${historyText}`
      }

      const response = await provider.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ])

      const totalCount = existingSummaryMsg
        ? (olderMessages.length - 1) + (messagesToSummarise.length)
        : olderMessages.length

      summaryContent = response
        ? `[历史摘要 - 已压缩 ${totalCount} 条消息]\n${response}`
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
      // P1: mark this message as a summary so subsequent compressions can
      // update it incrementally rather than re-generating from scratch
      isSummary: true,
    },
  }

  return [summaryMessage, ...recentMessages]
}
