import { LLMProvider, ChatMessage } from './types'

import { OpenClawGatewayClient, getGatewayClient } from '@/lib/gateway/client'

export interface GatewayProviderConfig {
  client?: OpenClawGatewayClient
  maxRetries?: number
  retryDelay?: number
}

export class GatewayProvider implements LLMProvider {
  private client: OpenClawGatewayClient
  private connected: boolean = false
  private maxRetries: number
  private retryDelay: number

  constructor(config: GatewayProviderConfig = {}) {
    this.client = config.client || getGatewayClient()
    this.maxRetries = config.maxRetries || 3
    this.retryDelay = config.retryDelay || 1000
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    await this.ensureConnection()

    const task = this.buildTask(messages)

    const result = await this.client.sessions_spawn({
      task,
      runtime: 'subagent',
      thinking: 'medium',
      runTimeoutSeconds: 60
    })

    if (result.status !== 'accepted') {
      throw new Error(result.error || 'Gateway spawn failed')
    }

    if (!result.childSessionKey) {
      throw new Error('Spawn accepted but no childSessionKey returned')
    }

    const completion = await this.client.waitForCompletion(
      result.childSessionKey,
      60000
    )

    return completion
  }

  private buildTask(messages: ChatMessage[]): string {
    const parts: string[] = []

    for (const message of messages) {
      if (message.role === 'system') {
        parts.push(`System: ${message.content}`)
      } else if (message.role === 'user') {
        parts.push(`User: ${message.content}`)
      } else if (message.role === 'assistant') {
        parts.push(`Assistant: ${message.content}`)
      }
    }

    return parts.join('\n\n')
  }

  private async ensureConnection(): Promise<void> {
    if (this.connected && this.client.isConnected()) {
      return
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.client.connect()
        this.connected = true
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Connection failed')
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt)
        }
      }
    }

    throw lastError || new Error('Failed to connect to Gateway')
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
