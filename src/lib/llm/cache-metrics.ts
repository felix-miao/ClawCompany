/**
 * Cache Metrics Tracker
 *
 * Tracks Anthropic prompt cache hit/miss statistics per session.
 * Thread-safe singleton — updated from API response usage fields.
 */

export interface CacheUsageSnapshot {
  cacheCreationInputTokens: number   // tokens written to cache (cache MISS)
  cacheReadInputTokens: number       // tokens served from cache (cache HIT)
  inputTokens: number                // uncached input tokens
  outputTokens: number               // output tokens (unchanged)
  totalRequests: number
  hitRate: number                    // 0-1, cacheRead / (cacheRead + cacheCreation)
}

export interface AnthropicUsageFields {
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  input_tokens?: number
  output_tokens?: number
}

class CacheMetricsTracker {
  private cacheCreationTokens = 0
  private cacheReadTokens = 0
  private inputTokens = 0
  private outputTokens = 0
  private totalRequests = 0

  /**
   * Record usage from a single Anthropic API response.
   */
  record(usage: AnthropicUsageFields): void {
    this.cacheCreationTokens += usage.cache_creation_input_tokens ?? 0
    this.cacheReadTokens += usage.cache_read_input_tokens ?? 0
    this.inputTokens += usage.input_tokens ?? 0
    this.outputTokens += usage.output_tokens ?? 0
    this.totalRequests++

    if (process.env.NODE_ENV !== 'test') {
      const cacheHit = usage.cache_read_input_tokens ?? 0
      const cacheMiss = usage.cache_creation_input_tokens ?? 0
      const status = cacheHit > 0 ? '✅ HIT' : cacheMiss > 0 ? '⚡ MISS (writing)' : '—'
      console.log(
        `[PromptCache] ${status} | hit=${cacheHit} miss=${cacheMiss} input=${usage.input_tokens ?? 0} output=${usage.output_tokens ?? 0}`,
      )
    }
  }

  /**
   * Return a snapshot of accumulated cache statistics.
   */
  snapshot(): CacheUsageSnapshot {
    const total = this.cacheCreationTokens + this.cacheReadTokens
    return {
      cacheCreationInputTokens: this.cacheCreationTokens,
      cacheReadInputTokens: this.cacheReadTokens,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalRequests: this.totalRequests,
      hitRate: total > 0 ? this.cacheReadTokens / total : 0,
    }
  }

  reset(): void {
    this.cacheCreationTokens = 0
    this.cacheReadTokens = 0
    this.inputTokens = 0
    this.outputTokens = 0
    this.totalRequests = 0
  }
}

// Module-level singleton
export const cacheMetrics = new CacheMetricsTracker()
