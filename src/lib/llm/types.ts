// LLM Provider - 大语言模型提供者接口

export interface LLMProvider {
  chat(messages: ChatMessage[], options?: LLMCallOptions): Promise<string>
  stream?(messages: ChatMessage[], options?: LLMCallOptions): AsyncGenerator<string>
}

export interface LLMCallOptions {
  maxTokens?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'glm'
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
}
