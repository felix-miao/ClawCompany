// LLM Provider - 大语言模型提供者接口

import { ChatMessage } from './types'

export interface LLMProvider {
  chat(messages: ChatMessage[]): Promise<string>
  stream?(messages: ChatMessage[]): AsyncGenerator<string>
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
}
