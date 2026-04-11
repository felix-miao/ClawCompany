import { applyAnthropicCacheControl, buildAnthropicRequestWithCaching } from '../prompt-cache'

describe('applyAnthropicCacheControl', () => {
  it('returns empty array for empty input', () => {
    expect(applyAnthropicCacheControl([])).toEqual([])
  })

  it('adds cache_control to system prompt (string content)', () => {
    const messages = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
    ]
    const result = applyAnthropicCacheControl(messages)
    // System message content becomes array with cache_control
    expect(Array.isArray(result[0].content)).toBe(true)
    const sysContent = result[0].content as Array<{ type: string; cache_control?: { type: string } }>
    expect(sysContent[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('adds cache_control to last message', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
    ]
    const result = applyAnthropicCacheControl(messages)
    const content = result[0].content as Array<{ type: string; cache_control?: { type: string } }>
    expect(Array.isArray(content)).toBe(true)
    expect(content[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('does not mutate original messages', () => {
    const messages = [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'user' },
    ]
    applyAnthropicCacheControl(messages)
    // originals unchanged
    expect(messages[0].content).toBe('system')
    expect(messages[1].content).toBe('user')
  })

  it('applies ttl=1h when specified', () => {
    const messages = [{ role: 'system', content: 'sys' }]
    const result = applyAnthropicCacheControl(messages, '1h')
    const sysContent = result[0].content as Array<{ cache_control?: { type: string; ttl?: string } }>
    expect(sysContent[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
  })

  it('marks up to 4 breakpoints: 1 system + 3 messages', () => {
    const messages = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'msg1' },
      { role: 'assistant', content: 'msg2' },
      { role: 'user', content: 'msg3' },
      { role: 'assistant', content: 'msg4' },
      { role: 'user', content: 'msg5' },
    ]
    const result = applyAnthropicCacheControl(messages)
    // Count how many messages have cache_control
    let count = 0
    for (const msg of result) {
      const content = msg.content
      if (Array.isArray(content)) {
        const last = content[content.length - 1] as { cache_control?: unknown }
        if (last?.cache_control) count++
      } else if (msg.cache_control) {
        count++
      }
    }
    expect(count).toBe(4) // system + last 3 non-system
  })
})

describe('buildAnthropicRequestWithCaching', () => {
  it('separates system and user messages', () => {
    const messages = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
    ]
    const { system, messages: apiMessages } = buildAnthropicRequestWithCaching(messages)
    expect(system).toBeDefined()
    expect(system![0].type).toBe('text')
    expect(system![0].text).toBe('You are helpful.')
    expect(system![0].cache_control).toEqual({ type: 'ephemeral' })
    expect(apiMessages).toHaveLength(1)
    expect(apiMessages[0].role).toBe('user')
  })

  it('returns undefined system when no system messages', () => {
    const messages = [{ role: 'user', content: 'Hello' }]
    const { system } = buildAnthropicRequestWithCaching(messages)
    expect(system).toBeUndefined()
  })

  it('applies cache_control to last user message', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
    ]
    const { messages: apiMessages } = buildAnthropicRequestWithCaching(messages)
    const content = apiMessages[0].content as Array<{ cache_control?: { type: string } }>
    expect(Array.isArray(content)).toBe(true)
    expect(content[0].cache_control).toEqual({ type: 'ephemeral' })
  })
})
