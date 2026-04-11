/**
 * Anthropic Prompt Caching - system_and_3 strategy
 *
 * Ported from Hermes agent/prompt_caching.py
 *
 * Reduces input token costs by ~75% on multi-turn conversations by caching
 * the conversation prefix. Uses up to 4 cache_control breakpoints (Anthropic max):
 *   1. System prompt (stable across all turns)
 *   2-4. Last 3 non-system messages (rolling window)
 *
 * Pure functions — no class state, no side effects.
 */

export type CacheTTL = '5m' | '1h'

export interface CacheControlMarker {
  type: 'ephemeral'
  ttl?: CacheTTL
}

export interface TextBlock {
  type: 'text'
  text: string
  cache_control?: CacheControlMarker
}

export interface ContentBlock {
  type: string
  [key: string]: unknown
  cache_control?: CacheControlMarker
}

export interface CacheableMessage {
  role: string
  content: string | ContentBlock[] | null
  cache_control?: CacheControlMarker
}

/**
 * Apply cache_control to a single message's last content block.
 * Converts string content to array format when needed (Anthropic native format).
 */
function applyCacheMarker(msg: CacheableMessage, marker: CacheControlMarker): void {
  const { content } = msg

  if (content === null || content === undefined || content === '') {
    msg.cache_control = marker
    return
  }

  if (typeof content === 'string') {
    // Convert string to Anthropic block array format with cache_control on the text block
    ;(msg as CacheableMessage & { content: ContentBlock[] }).content = [
      { type: 'text', text: content, cache_control: marker },
    ]
    return
  }

  if (Array.isArray(content) && content.length > 0) {
    // Add cache_control to the last block in the array
    const last = content[content.length - 1]
    if (last && typeof last === 'object') {
      last.cache_control = marker
    }
  }
}

/**
 * Apply the system_and_3 caching strategy to a message list.
 *
 * Places up to 4 cache_control breakpoints:
 *   - System prompt (index 0 if role === 'system')
 *   - Last 3 non-system messages (rolling window for conversations)
 *
 * Returns a deep copy of the messages with cache_control injected.
 */
export function applyAnthropicCacheControl(
  messages: CacheableMessage[],
  ttl: CacheTTL = '5m',
): CacheableMessage[] {
  if (!messages.length) return []

  // Deep copy to avoid mutating originals
  const result: CacheableMessage[] = JSON.parse(JSON.stringify(messages))

  const marker: CacheControlMarker = { type: 'ephemeral' }
  if (ttl === '1h') {
    marker.ttl = '1h'
  }

  let breakpointsUsed = 0

  // 1. Cache the system prompt if first message
  if (result[0]?.role === 'system') {
    applyCacheMarker(result[0], marker)
    breakpointsUsed++
  }

  // 2-4. Cache last 3 non-system messages
  const remaining = 4 - breakpointsUsed
  const nonSysIndexes = result
    .map((m, i) => ({ role: m.role, i }))
    .filter(({ role }) => role !== 'system')
    .map(({ i }) => i)

  for (const idx of nonSysIndexes.slice(-remaining)) {
    applyCacheMarker(result[idx], marker)
  }

  return result
}

/**
 * For native Anthropic API format: separate system from messages,
 * and apply cache_control to the system content block + last N messages.
 *
 * Returns { system, messages } ready for the Anthropic Messages API.
 */
export function buildAnthropicRequestWithCaching(
  inputMessages: Array<{ role: string; content: string }>,
  ttl: CacheTTL = '5m',
): {
  system: TextBlock[] | undefined
  messages: CacheableMessage[]
} {
  const marker: CacheControlMarker = { type: 'ephemeral' }
  if (ttl === '1h') {
    marker.ttl = '1h'
  }

  // Extract system prompt(s)
  const systemMessages = inputMessages.filter(m => m.role === 'system')
  const nonSystemMessages = inputMessages.filter(m => m.role !== 'system')

  // Build system block array with cache_control on last system block
  let system: TextBlock[] | undefined
  if (systemMessages.length > 0) {
    system = systemMessages.map((m, i) => {
      const block: TextBlock = { type: 'text', text: m.content }
      // Apply cache_control to the last system block only
      if (i === systemMessages.length - 1) {
        block.cache_control = marker
      }
      return block
    })
  }

  // Build messages with cache_control on last 3 (up to 3 breakpoints remain after system)
  const messages: CacheableMessage[] = nonSystemMessages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  const toCache = Math.min(3, messages.length)
  for (let i = messages.length - toCache; i < messages.length; i++) {
    applyCacheMarker(messages[i], marker)
  }

  return { system, messages }
}
