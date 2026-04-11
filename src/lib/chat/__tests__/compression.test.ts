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
})
