import { BaseLLMProvider } from './base'
import { LLMConfig } from './types'

export class GLMProvider extends BaseLLMProvider {
  private baseUrl: string

  constructor(config: LLMConfig) {
    super(config, 'glm-5')
    this.baseUrl = 'https://api.z.ai/api/coding/paas/v4'
  }

  getApiUrl(): string {
    return `${this.baseUrl}/chat/completions`
  }

  getProviderName(): string {
    return 'GLM'
  }

  getDefaultModel(): string {
    return 'glm-5'
  }

  protected get apiUrl(): string {
    return this.getApiUrl()
  }

  protected get providerName(): string {
    return this.getProviderName()
  }

  protected get defaultModel(): string {
    return this.getDefaultModel()
  }
}
