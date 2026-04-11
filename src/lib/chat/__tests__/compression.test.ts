import {
  shouldCompress,
  compressHistory,
  COMPRESSION_TRIGGER_COUNT,
  RECENT_KEEP,
} from '../compression'
import { ChatMessage } from '../../core/types'

function makeMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg_${i}`,
    agent: (i % 2 === 0 ? 'user' : 'pm') as ChatMessage['agent'],
    content: `Message content ${i} — ${'x'.repeat(50)}`,
    type: 'text' as const,
    timestamp: new Date(Date.now() + i * 1000),
  }))
}

describe('shouldCompress', () => {
  it('returns false for small history', () => {
    expect(shouldCompress(makeMessages(5))).toBe(false)
  })

  it('returns true when count exceeds threshold', () => {
    expect(shouldCompress(makeMessages(COMPRESSION_TRIGGER_COUNT + 1))).toBe(true)
  })

  it('returns true when estimated tokens exceed threshold', () => {
    // ~50K tokens × 4 chars = 200K chars across 5 messages
    const bigMessages: ChatMessage[] = [
      {
        agent: 'user',
        content: 'x'.repeat(210_000),
        type: 'text',
      },
    ]
    expect(shouldCompress(bigMessages)).toBe(true)
  })
})

describe('compressHistory', () => {
  it('returns original array when below threshold', async () => {
    const messages = makeMessages(5)
    const result = await compressHistory(messages)
    expect(result).toBe(messages)
  })

  it('compresses to summary + RECENT_KEEP messages when above count threshold', async () => {
    const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5)
    const result = await compressHistory(messages)

    // Should have 1 summary + RECENT_KEEP recent
    expect(result.length).toBe(RECENT_KEEP + 1)
    expect(result[0].content).toContain('[历史摘要')
    // Recent messages should be the last RECENT_KEEP ones
    const origRecent = messages.slice(-RECENT_KEEP)
    for (let i = 0; i < RECENT_KEEP; i++) {
      expect(result[i + 1].id).toBe(origRecent[i].id)
    }
  })

  it('falls back gracefully when LLM is null', async () => {
    const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5)
    // Explicitly pass null as the LLM provider
    const result = await compressHistory(messages, null as unknown as undefined)
    expect(result.length).toBe(RECENT_KEEP + 1)
    expect(result[0].content).toContain('[历史摘要')
  })

  it('summary message has type=text and agent=pm', async () => {
    const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 1)
    const result = await compressHistory(messages)
    expect(result[0].type).toBe('text')
    expect(result[0].agent).toBe('pm')
  })

  // ── P1: isSummary metadata ────────────────────────────────────────────────

  it('summary message has isSummary=true in metadata', async () => {
    const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 1)
    const result = await compressHistory(messages)
    expect(result[0].metadata?.isSummary).toBe(true)
  })

  // ── P0: tool_call / tool_result pair preservation ─────────────────────────

  it('does not split a tool_call / tool_result pair across the boundary', async () => {
    // Build 25 regular messages so compression triggers
    const base = makeMessages(COMPRESSION_TRIGGER_COUNT + 5)

    // The "natural" split index would be messages.length - RECENT_KEEP = 20
    // Place a tool_call at index 19 (last message before the recent slice)
    // and its result at index 20 (first message of the recent slice).
    // After the fix the boundary must move to 19 so both stay in recentMessages.
    const toolCallId = 'tc_test_001'
    const toolCallMsg: ChatMessage = {
      id: toolCallId,
      agent: 'dev',
      content: 'Calling exec tool',
      type: 'text',
      timestamp: new Date(),
      metadata: { taskId: 'tool_call:exec' },
    }
    const toolResultMsg: ChatMessage = {
      id: 'tr_test_001',
      agent: 'dev',
      content: 'Tool result: success',
      type: 'text',
      timestamp: new Date(),
      metadata: { toolCallId },
    }

    // Replace positions 19 and 20 with the paired messages
    base[19] = toolCallMsg
    base[20] = toolResultMsg

    const result = await compressHistory(base)

    // Both the tool_call and tool_result must appear in the output (not summarised away)
    const ids = result.map(m => m.id)
    expect(ids).toContain(toolCallId)
    expect(ids).toContain('tr_test_001')

    // And they must be adjacent in the result
    const callIdx = ids.indexOf(toolCallId)
    const resIdx = ids.indexOf('tr_test_001')
    expect(resIdx).toBe(callIdx + 1)
  })

  // ── P1: incremental summary ───────────────────────────────────────────────

  it('uses incremental summarisation when an existing summary message is present', async () => {
    // Simulate a history that already has a prior summary at position 0
    const priorSummaryMsg: ChatMessage = {
      id: 'summary_old',
      agent: 'pm',
      content: '[历史摘要 - 已压缩 10 条消息]\n- 旧摘要内容',
      type: 'text',
      timestamp: new Date(Date.now() - 100_000),
      metadata: { taskId: 'context-compression-summary', isSummary: true },
    }

    // Add COMPRESSION_TRIGGER_COUNT + 5 new messages after the summary
    const newMessages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5)
    const history: ChatMessage[] = [priorSummaryMsg, ...newMessages]

    // Mock LLM that records the prompt it receives
    let capturedUserPrompt = ''
    const mockLLM = {
      chat: async (msgs: Array<{ role: string; content: string }>) => {
        capturedUserPrompt = msgs.find(m => m.role === 'user')?.content ?? ''
        return '- 增量摘要内容'
      },
    }

    const result = await compressHistory(
      history,
      mockLLM as unknown as ReturnType<typeof import('../../llm/factory').getLLMProvider>,
    )

    // Incremental prompt must reference the prior summary
    expect(capturedUserPrompt).toContain('已有摘要')
    expect(capturedUserPrompt).toContain('旧摘要内容')

    // Result still starts with a summary
    expect(result[0].metadata?.isSummary).toBe(true)
    expect(result[0].content).toContain('[历史摘要')
  })
})
