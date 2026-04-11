/**
 * context-compression.e2e.test.ts
 * E2E 测试：Context Compression 集成验证
 * 
 * 覆盖场景：
 * CC-001: 压缩在消息阈值触发
 * CC-002: compressHistory 生成摘要
 * CC-004: Token 超过 50K 触发压缩
 * CC-005: 压缩后保留最近消息
 */

import { shouldCompress, compressHistory, COMPRESSION_TRIGGER_COUNT, RECENT_KEEP } from '@/lib/chat/compression'
import type { ChatMessage } from '@/lib/core/types'

function makeMessages(count: number, agentType: 'user' | 'pm' = 'user'): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg_${i}`,
    agent: (i % 2 === 0 ? agentType : (agentType === 'user' ? 'pm' : 'user')) as ChatMessage['agent'],
    content: `Message content ${i} — ${'x'.repeat(50)}`,
    type: 'text' as const,
    timestamp: new Date(Date.now() + i * 1000),
  }))
}

describe('E2E: Context Compression Integration', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // CC-001: Compression triggers at message threshold
  // ─────────────────────────────────────────────────────────────────────────

  describe('CC-001: Message count threshold triggers compression', () => {
    it('shouldCompress returns true when message count exceeds threshold', () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 1)
      expect(shouldCompress(messages)).toBe(true)
    })

    it('shouldCompress returns false when below threshold', () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT - 1)
      expect(shouldCompress(messages)).toBe(false)
    })

    it('shouldCompress returns false when exactly at threshold', () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT)
      expect(shouldCompress(messages)).toBe(false)
    })

    it('shouldCompress returns true when one over threshold', () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 1)
      expect(shouldCompress(messages)).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // CC-002: compressHistory generates summary
  // ─────────────────────────────────────────────────────────────────────────

  describe('CC-002: compressHistory generates summary', () => {
    it('should generate summary + recent messages when above count threshold', async () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5, 'user')
      const result = await compressHistory(messages)

      // Should have 1 summary + RECENT_KEEP recent
      expect(result.length).toBe(RECENT_KEEP + 1)
      expect(result[0].content).toContain('[历史摘要')
      expect(result[0].agent).toBe('pm')
    })

    it('should preserve recent message IDs after compression', async () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 10, 'user')
      const result = await compressHistory(messages)

      // Recent messages should be the last RECENT_KEEP ones
      const origRecent = messages.slice(-RECENT_KEEP)
      for (let i = 0; i < RECENT_KEEP; i++) {
        expect(result[i + 1].id).toBe(origRecent[i].id)
      }
    })

    it('should return original array when below threshold', async () => {
      const messages = makeMessages(5)
      const result = await compressHistory(messages)
      expect(result).toBe(messages)
    })

    it('summary message has type=text and agent=pm', async () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 1, 'user')
      const result = await compressHistory(messages)
      expect(result[0].type).toBe('text')
      expect(result[0].agent).toBe('pm')
    })

    it('falls back gracefully when LLM is null', async () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5, 'user')
      const result = await compressHistory(messages, null as unknown as undefined)
      expect(result.length).toBe(RECENT_KEEP + 1)
      expect(result[0].content).toContain('[历史摘要')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // CC-004: Token-based compression
  // ─────────────────────────────────────────────────────────────────────────

  describe('CC-004: Token-based compression triggers', () => {
    it('should trigger compression when tokens exceed 50K', () => {
      // ~50K tokens × 4 chars = 200K chars
      const bigMessages: ChatMessage[] = [
        {
          id: 'msg_1',
          agent: 'user',
          content: 'x'.repeat(210_000),
          type: 'text',
          timestamp: new Date(),
        },
      ]
      expect(shouldCompress(bigMessages)).toBe(true)
    })

    it('should trigger compression with multiple large messages exceeding 50K tokens', () => {
      // 50,000 tokens * 4 chars/token = 200,000 chars minimum
      // Use 210,000 chars to ensure we exceed the threshold
      const messages: ChatMessage[] = [
        {
          id: 'msg_1',
          agent: 'user',
          content: 'x'.repeat(110_000), // ~27.5K tokens
          type: 'text',
          timestamp: new Date(),
        },
        {
          id: 'msg_2',
          agent: 'user',
          content: 'x'.repeat(110_000), // ~27.5K tokens
          type: 'text',
          timestamp: new Date(),
        },
      ]
      // Total: 220,000 chars / 4 = 55,000 tokens > 50,000 threshold
      expect(shouldCompress(messages)).toBe(true)
    })

    it('should not trigger compression with small messages below token threshold', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg_1',
          agent: 'user',
          content: 'Hello world',
          type: 'text',
          timestamp: new Date(),
        },
      ]
      expect(shouldCompress(messages)).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // CC-005: Compression preserves recent messages
  // ─────────────────────────────────────────────────────────────────────────

  describe('CC-005: Compression preserves recent messages', () => {
    it('should keep exactly 5 recent messages after compression', async () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 10, 'user')
      const result = await compressHistory(messages)

      // Verify length: 1 summary + 5 recent = 6
      expect(result.length).toBe(6)
    })

    it('should preserve message order (summary first, then recent)', async () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5, 'user')
      const result = await compressHistory(messages)

      // First message should be summary
      expect(result[0].content).toContain('[历史摘要')
      
      // Recent messages should follow in order
      const origRecent = messages.slice(-RECENT_KEEP)
      for (let i = 0; i < RECENT_KEEP - 1; i++) {
        expect(result[i + 1].id).toBe(origRecent[i].id)
        expect((result[i + 1] as any).timestamp.getTime()).toBeLessThanOrEqual(
          (result[i + 2] as any).timestamp.getTime()
        )
      }
    })

    it('should preserve agent types of recent messages', async () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5, 'user')
      const result = await compressHistory(messages)

      const origRecent = messages.slice(-RECENT_KEEP)
      for (let i = 0; i < RECENT_KEEP; i++) {
        expect(result[i + 1].agent).toBe(origRecent[i].agent)
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should handle empty message array', async () => {
      const messages: ChatMessage[] = []
      const result = await compressHistory(messages)
      expect(result).toEqual([])
    })

    it('should handle single message', async () => {
      const messages = makeMessages(1, 'user')
      const result = await compressHistory(messages)
      expect(result).toBe(messages) // Below threshold, returns original
    })

    it('should handle messages with very old timestamps', async () => {
      const messages = makeMessages(COMPRESSION_TRIGGER_COUNT + 5, 'user')
      // Make timestamps very old
      messages.forEach((msg, i) => {
        msg.timestamp = new Date(Date.now() - (1000 * 60 * 60 * 24 * (i + 1))) // Days ago
      })

      const result = await compressHistory(messages)
      expect(result.length).toBe(RECENT_KEEP + 1)
      // Recent messages should still be the last ones (most recent)
      expect(result[result.length - 1].id).toBe(messages[messages.length - 1].id)
    })

    it('should handle messages with special characters', async () => {
      const messages: ChatMessage[] = Array.from({ length: COMPRESSION_TRIGGER_COUNT + 5 }, (_, i) => ({
        id: `msg_${i}`,
        agent: 'user' as const,
        content: `Message with special chars: <>&"'\`$测试中文 🎉`,
        type: 'text' as const,
        timestamp: new Date(Date.now() + i * 1000),
      }))

      const result = await compressHistory(messages)
      expect(result.length).toBe(RECENT_KEEP + 1)
      expect(result[0].content).toContain('[历史摘要')
    })
  })
})
