import { LLMProvider, ChatMessage, LLMConfig } from './types'

const DEFAULT_TIMEOUT_MS = 30_000

export abstract class BaseLLMProvider implements LLMProvider {
  protected apiKey: string
  protected model: string
  protected temperature: number
  protected maxTokens: number
  protected timeoutMs: number

  protected abstract get apiUrl(): string
  protected abstract get providerName(): string
  protected abstract get defaultModel(): string

  constructor(config: LLMConfig, fallbackModel: string) {
    if (!config.apiKey) {
      throw new Error('API key is required')
    }
    this.apiKey = config.apiKey
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens ?? 2000
    this.timeoutMs = config.timeout ?? DEFAULT_TIMEOUT_MS
    this.model = config.model ?? fallbackModel
  }

  private createAbortSignal(): AbortSignal {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), this.timeoutMs)
    return controller.signal
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      }),
      signal: this.createAbortSignal(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`${this.providerName} API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }

  async *stream(messages: ChatMessage[]): AsyncGenerator<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        stream: true,
      }),
      signal: this.createAbortSignal(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`${this.providerName} API error: ${error.error?.message || response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is null')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch {
          }
        }
      }
    }
  }
}
