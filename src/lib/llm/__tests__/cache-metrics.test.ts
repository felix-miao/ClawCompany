import { cacheMetrics } from '../cache-metrics'

describe('CacheMetricsTracker', () => {
  beforeEach(() => {
    cacheMetrics.reset()
  })

  it('starts with zero counts', () => {
    const snap = cacheMetrics.snapshot()
    expect(snap.cacheCreationInputTokens).toBe(0)
    expect(snap.cacheReadInputTokens).toBe(0)
    expect(snap.inputTokens).toBe(0)
    expect(snap.outputTokens).toBe(0)
    expect(snap.totalRequests).toBe(0)
    expect(snap.hitRate).toBe(0)
  })

  it('records a cache miss (creation tokens only)', () => {
    cacheMetrics.record({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 0,
    })
    const snap = cacheMetrics.snapshot()
    expect(snap.cacheCreationInputTokens).toBe(200)
    expect(snap.cacheReadInputTokens).toBe(0)
    expect(snap.totalRequests).toBe(1)
    expect(snap.hitRate).toBe(0)
  })

  it('records a cache hit (read tokens)', () => {
    // First request: miss (creation)
    cacheMetrics.record({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 0,
    })
    // Second request: hit (read)
    cacheMetrics.record({
      input_tokens: 10,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 200,
    })
    const snap = cacheMetrics.snapshot()
    expect(snap.cacheCreationInputTokens).toBe(200)
    expect(snap.cacheReadInputTokens).toBe(200)
    expect(snap.totalRequests).toBe(2)
    expect(snap.hitRate).toBe(0.5)  // 200 / (200 + 200)
  })

  it('handles missing fields gracefully', () => {
    cacheMetrics.record({})
    const snap = cacheMetrics.snapshot()
    expect(snap.totalRequests).toBe(1)
    expect(snap.hitRate).toBe(0)
  })

  it('resets all counters', () => {
    cacheMetrics.record({ input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 200 })
    cacheMetrics.reset()
    const snap = cacheMetrics.snapshot()
    expect(snap.totalRequests).toBe(0)
    expect(snap.cacheCreationInputTokens).toBe(0)
  })
})
