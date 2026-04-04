import { BaseLLMProvider } from '../base'
import { LLMConfig } from '../types'

global.fetch = jest.fn()

class TestProvider extends BaseLLMProvider {
  constructor(config: LLMConfig) {
    super(config, 'test-model-v1')
  }
  protected get apiUrl(): string { return 'https://test.api.com/v1/chat/completions' }
  protected get providerName(): string { return 'Test' }
  protected get defaultModel(): string { return 'test-model-v1' }
}

describe('BaseLLMProvider - response type handling', () => {
  let provider: TestProvider

  beforeEach(() => {
    provider = new TestProvider({ provider: 'openai', apiKey: 'test-key' })
    jest.clearAllMocks()
  })

  describe('chat - typed response parsing', () => {
    it('should extract content from well-formed API response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          choices: [{ message: { role: 'assistant', content: 'Hello from API' } }],
        }),
      })

      const result = await provider.chat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('Hello from API')
    })

    it('should handle response with null content', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: null } }],
        }),
      })

      const result = await provider.chat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('')
    })

    it('should return empty string when response has no choices property', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const result = await provider.chat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('')
    })

    it('should handle response with choices property as empty array', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      })

      const result = await provider.chat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('')
    })

    it('should handle response where choices is an empty array', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      })

      const result = await provider.chat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('')
    })

    it('should handle response with deeply nested content', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Line1\nLine2\nLine3' } }],
        }),
      })

      const result = await provider.chat([{ role: 'user', content: 'multi' }])
      expect(result).toBe('Line1\nLine2\nLine3')
    })
  })
})
