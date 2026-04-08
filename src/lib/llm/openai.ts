import { BaseLLMProvider } from './base'
import { LLMConfig } from './types'

export class OpenAIProvider extends BaseLLMProvider {
  constructor(config: LLMConfig) {
    super(config, 'gpt-4o-mini')
  }

  protected get apiUrl(): string {
    return 'https://api.openai.com/v1/chat/completions'
  }

  protected get providerName(): string {
    return 'OpenAI'
  }

  protected get defaultModel(): string {
    return 'gpt-4o-mini'
  }
}
