import { BaseLLMProvider } from './base'
import { LLMConfig } from './types'

export class GLMProvider extends BaseLLMProvider {
  private baseUrl: string

  constructor(config: LLMConfig) {
    super(config, 'glm-5')
    this.baseUrl = 'https://api.z.ai/api/coding/paas/v4'
  }

  protected get apiUrl(): string {
    return `${this.baseUrl}/chat/completions`
  }

  protected get providerName(): string {
    return 'GLM'
  }

  protected get defaultModel(): string {
    return 'glm-5'
  }
}
