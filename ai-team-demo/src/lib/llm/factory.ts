// LLM Factory - 创建 LLM 提供者

import { LLMProvider, LLMConfig } from './types'
import { OpenAIProvider } from './openai'
import { GLMProvider } from './glm'
import { MockProvider } from './mock'

export class LLMFactory {
  static createProvider(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(config)
      
      case 'glm':
        return new GLMProvider(config)
      
      case 'anthropic':
        throw new Error('Anthropic provider not implemented yet')
      
      default:
        throw new Error(`Unknown LLM provider: ${config.provider}`)
    }
  }

  static createFromEnv(): LLMProvider | null {
    // 优先检查是否使用 Mock 模式（用于 Demo）
    const useMock = process.env.USE_MOCK_LLM === 'true'
    if (useMock) {
      console.log('[LLM Factory] Using Mock Provider for demo')
      return new MockProvider()
    }

    // 优先使用 GLM
    const glmKey = process.env.GLM_API_KEY
    if (glmKey) {
      const model = process.env.GLM_MODEL || 'glm-4'
      const temperature = parseFloat(process.env.LLM_TEMPERATURE || '0.7')
      const maxTokens = parseInt(process.env.LLM_MAX_TOKENS || '2000', 10)

      return LLMFactory.createProvider({
        provider: 'glm',
        apiKey: glmKey,
        model,
        temperature,
        maxTokens,
      })
    }

    // 备选 OpenAI
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey) {
      const provider = (process.env.LLM_PROVIDER as LLMConfig['provider']) || 'openai'
      const model = process.env.LLM_MODEL || 'gpt-4o-mini'
      const temperature = parseFloat(process.env.LLM_TEMPERATURE || '0.7')
      const maxTokens = parseInt(process.env.LLM_MAX_TOKENS || '2000', 10)

      return LLMFactory.createProvider({
        provider,
        apiKey: openaiKey,
        model,
        temperature,
        maxTokens,
      })
    }

    console.warn('No LLM API key found in environment')
    return null
  }
}

// 单例实例
let llmProvider: LLMProvider | null = null

export function getLLMProvider(): LLMProvider | null {
  if (!llmProvider) {
    llmProvider = LLMFactory.createFromEnv()
  }
  return llmProvider
}

export function setLLMProvider(provider: LLMProvider): void {
  llmProvider = provider
}
