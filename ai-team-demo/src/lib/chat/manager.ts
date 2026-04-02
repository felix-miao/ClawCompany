import { AgentRole, Message } from '../core/types'
import { generateId } from '../utils/id'
import { safeJsonParse } from '../utils/json-parser'

export class ChatManager {
  private messages: Message[] = []
  private sessionId: string

  constructor(sessionId: string = 'default') {
    this.sessionId = sessionId
  }

  addMessage(
    agent: 'user' | AgentRole,
    content: string,
    type: 'text' | 'code' | 'file' | 'task' = 'text',
    metadata?: Message['metadata']
  ): Message {
    const message: Message = {
      id: generateId('msg_'),
      agent,
      content,
      type,
      timestamp: new Date(),
      metadata
    }

    this.messages.push(message)
    return message
  }

  getMessage(messageId: string): Message | undefined {
    return this.messages.find(m => m.id === messageId)
  }

  getHistory(): Message[] {
    return [...this.messages]
  }

  getRecentMessages(count: number = 50): Message[] {
    return this.messages.slice(-count)
  }

  getMessagesByAgent(agent: 'user' | AgentRole): Message[] {
    return this.messages.filter(m => m.agent === agent)
  }

  clearHistory(): void {
    this.messages = []
  }

  broadcast(agent: AgentRole, content: string): Message {
    return this.addMessage(agent, content, 'text')
  }

  sendUserMessage(content: string): Message {
    return this.addMessage('user', content, 'text')
  }

  sendCodeMessage(agent: AgentRole, code: string, language: string = 'typescript'): Message {
    return this.addMessage(agent, code, 'code', { codeLanguage: language })
  }

  sendFileMessage(agent: AgentRole, filePath: string, content: string): Message {
    return this.addMessage(agent, content, 'file', { filePath })
  }

  sendTaskMessage(agent: AgentRole, taskId: string, content: string): Message {
    return this.addMessage(agent, content, 'task', { taskId })
  }

  toJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      messages: this.messages
    })
  }

  static fromJSON(json: string): ChatManager {
    const result = safeJsonParse<{ sessionId: string; messages: Message[] }>(json, 'ChatManager')
    if (!result.success) {
      throw new Error(result.error)
    }
    const manager = new ChatManager(result.data.sessionId)
    manager.messages = result.data.messages.map((m: Message) => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }))
    return manager
  }
}

export const chatManager = new ChatManager()
