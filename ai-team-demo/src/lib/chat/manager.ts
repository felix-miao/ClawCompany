import { AgentRole, Message, ChatMessage } from '../core/types'
import { generateId } from '../utils/id'
import { safeJsonParse } from '../utils/json-parser'

export type { Message }

export class ChatManager {
  private messages: Message[] = []
  private messageMap: Map<string, Message> = new Map()
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
    this.messageMap.set(message.id, message)
    return message
  }

  getMessage(messageId: string): Message | undefined {
    return this.messageMap.get(messageId)
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
    this.messageMap.clear()
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
    const result = safeJsonParse<{ sessionId: string; messages: ChatMessage[] }>(json, 'ChatManager')
    if (!result.success) {
      throw new Error(result.error)
    }
    const data = result.data
    if (data.sessionId === undefined || data.sessionId === null) {
      throw new Error('ChatManager: sessionId is required')
    }
    if (!Array.isArray(data.messages)) {
      throw new Error('ChatManager: messages must be an array')
    }
    const manager = new ChatManager(data.sessionId)
    manager.messages = data.messages.map((m: ChatMessage): Message => ({
      ...m,
      id: m.id ?? generateId('msg_'),
      type: m.type ?? 'text',
      timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp ?? Date.now())
    }))
    manager.messageMap = new Map(manager.messages.map(m => [m.id, m]))
    return manager
  }
}

export function createChatManager(sessionId?: string): ChatManager {
  return new ChatManager(sessionId)
}

/** @deprecated Use DI container or createChatManager() instead */
export const chatManager = new ChatManager()