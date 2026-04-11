/**
 * Anthropic Claude Provider with Prompt Caching
 *
 * Uses the native Anthropic Messages API (not OpenAI-compatible) so we can
 * attach cache_control breakpoints to system prompts and message blocks.
 *
 * Implements system_and_3 caching strategy (ported from Hermes):
 *   - System prompt: always cached (ephemeral, 5-minute TTL by default)
 *   - Last 3 messages: cached with rolling window
 *
 * Cache metrics (hit/miss tokens) are recorded via the cacheMetrics singleton.
 */

import { LLMProvider, ChatMessage, LLMConfig } from './types'
import { buildAnthropicRequestWithCaching, CacheTTL } from './prompt-cache'
import { cacheMetrics } from './cache-metrics'

const DEFAULT_TIMEOUT_MS = 60_000
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
// Prompt caching is currently in beta
const ANTHROPIC_BETA_HEADERS = 'prompt-caching-2024-07-31'

interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

interface AnthropicContentBlock {
  type: 'text' | string
  text?: string
}

interface AnthropicMessageResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: AnthropicContentBlock[]
  model: string
  stop_reason: string | null
  usage: AnthropicUsage
}

interface AnthropicErrorResponse {
  type: 'error'
  error: {
    type: string
    message: string
  }
}

export class AnthropicProvider implements LLMProvider {
  private apiKey: string
  private model: string
  private temperature: number
  private maxTokens: number
  private timeoutMs: number
  private cacheTTL: CacheTTL

  constructor(config: LLMConfig, cacheTTL: CacheTTL = '5m') {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required')
    }
    this.apiKey = config.apiKey
    this.model = config.model ?? 'claude-3-5-haiku-20241022'
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens ?? 2000
    this.timeoutMs = config.timeout ?? DEFAULT_TIMEOUT_MS
    this.cacheTTL = cacheTTL
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const { system, messages: apiMessages } = buildAnthropicRequestWithCaching(
        messages,
        this.cacheTTL,
      )

      const requestBody: Record<string, unknown> = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: apiMessages,
      }

      if (system) {
        requestBody.system = system
      }

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-beta': ANTHROPIC_BETA_HEADERS,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      if (!response.ok) {
        let errorMsg = response.statusText
        try {
          const errBody = (await response.json()) as AnthropicErrorResponse
          errorMsg = errBody.error?.message ?? errorMsg
        } catch {
          // ignore parse errors
        }
        throw new Error(`Anthropic API error (${response.status}): ${errorMsg}`)
      }

      const data = (await response.json()) as AnthropicMessageResponse

      // Record cache metrics from usage
      if (data.usage) {
        cacheMetrics.record({
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
          cache_creation_input_tokens: data.usage.cache_creation_input_tokens,
          cache_read_input_tokens: data.usage.cache_read_input_tokens,
        })
      }

      // Extract text from content blocks
      const text = data.content
        .filter((b): b is AnthropicContentBlock & { type: 'text'; text: string } =>
          b.type === 'text' && typeof b.text === 'string',
        )
        .map(b => b.text)
        .join('')

      return text
    } finally {
      clearTimeout(timer)
    }
  }
}
