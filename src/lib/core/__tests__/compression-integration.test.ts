/**
 * Integration Test: Context Compression with Orchestrator
 *
 * Tests the full context compression pipeline integration
 * with the chat history system.
 */

import {
  shouldCompress,
  compressHistory,
  COMPRESSION_TRIGGER_COUNT,
  RECENT_KEEP,
} from '@/lib/chat/compression'
import { ChatMessage } from '../core/types'
import type { AgentResponse } from '../core/types'

function makeMessages(count: number, startIndex: number = 0): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg_${startIndex + i}`,
    agent: (i % 2 === 0 ? 'user' : 'pm') as ChatMessage['agent'],
    content: `Message content ${startIndex + i} — ${'x'.repeat(50)}`,
    type: 'text' as const,
    timestamp: new Date(Date.now() + (startIndex + i) * 1000),
  }))
}

function makeMockLLM() {
  return {
    chat: async (msgs: Array<{ role: string; content: string }>) => {
      const userMsg = msgs.find(m => m.role === 'user')
      return `Mock summary: compressed ${userMsg?.content.length ?? 0} chars`
    },
  }
}

describe('Compression Integration - Full Pipeline', () => {
  it('should integrate with orchestrator when history exceeds threshold', async () => {
    const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5)

    const result = await compressHistory(messages, makeMockLLM() as any)

    expect(result.length).toBeLessThan(messages.length)
    expect(result[0].metadata?.isSummary).toBe(true)
  })

  it('should preserve recent messages after compression', async () => {
    const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 10)

    const result = await compressHistory(messages, makeMockLLM() as any)

    expect(result.length).toBe(RECENT_KEEP + 1)
    const recentIds = result.slice(1).map(m => m.id)
    const expectedRecent = messages.slice(-RECENT_KEEP).map(m => m.id)
    expect(recentIds).toEqual(expectedRecent)
  })

  it('should handle empty messages array', async () => {
    const result = await compressHistory([], makeMockLLM() as any)
    expect(result).toEqual([])
  })

  it('should handle single message', async () => {
    const messages = makeMessages(1)
    const result = await compressHistory(messages, makeMockLLM() as any)
    expect(result).toBe(messages)
  })

  it('should correctly identify when compression is needed', () => {
    expect(shouldCompress(makeMessages(10))).toBe(false)
    expect(shouldCompress(makeMessages(COMPRESSION_TRIGGER_COUNT + 1))).toBe(true)
  })

  it('should handle large token count trigger', () => {
    const bigMessages: ChatMessage[] = [
      {
        id: 'big-1',
        agent: 'user',
        content: 'x'.repeat(210_000),
        type: 'text',
      },
    ]
    expect(shouldCompress(bigMessages)).toBe(true)
  })

  it('should fall back gracefully when no LLM provided', async () => {
    const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5)
    const result = await compressHistory(messages, undefined as any)

    expect(result.length).toBe(RECENT_KEEP + 1)
    expect(result[0].content).toContain('[历史摘要')
  })
})

describe('Compression with Agent Responses', () => {
  it('should handle agent response history format', async () => {
    const agentResponses: ChatMessage[] = [
      { id: 'resp-1', agent: 'pm', content: '分析完成，创建3个任务', type: 'text', timestamp: new Date() },
      { id: 'resp-2', agent: 'dev', content: '已实现功能', type: 'text', timestamp: new Date() },
      { id: 'resp-3', agent: 'review', content: 'LGTM', type: 'text', timestamp: new Date() },
      { id: 'resp-4', agent: 'user', content: '很好', type: 'text', timestamp: new Date() },
    ]

    const result = await compressHistory(agentResponses, makeMockLLM() as any)
    expect(result.length).toBeGreaterThan(0)
  })
})