import { AgentRole, Message, ChatMessage, TaskInbox } from '../core/types'
import { generateId } from '../utils/id'
import { safeJsonParse } from '../utils/json-parser'

export type { Message }

export class ChatManager {
  private messages: Message[] = []
  private messageMap: Map<string, Message> = new Map()
  private sessionId: string
  private maxMessages: number


  constructor(sessionId: string = 'default', maxMessages: number = 500) {
    this.sessionId = sessionId
    this.maxMessages = maxMessages
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

    // Evict oldest message when cap is reached (P0-fix #069: unbounded growth)
    if (this.maxMessages > 0 && this.messages.length >= this.maxMessages) {
      const removed = this.messages.shift()
      if (removed) {
        this.messageMap.delete(removed.id)
      }
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

  getMessagesByTaskId(taskId: string): Message[] {
    return this.messages.filter(m => m.metadata?.taskId === taskId)
  }

  getInbox(taskId: string): TaskInbox {
    const messages = this.getMessagesByTaskId(taskId)
    return {
      taskId,
      messages,
      unreadCount: messages.length,
      lastUpdated: messages.length > 0 
        ? messages[messages.length - 1].timestamp 
        : new Date()
    }
  }

  getAllInboxes(): TaskInbox[] {
    const taskIds = new Set<string>()
    for (const msg of this.messages) {
      if (msg.metadata?.taskId) {
        taskIds.add(msg.metadata.taskId)
      }
    }
    return Array.from(taskIds).map(taskId => this.getInbox(taskId))
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

export function createChatManager(sessionId?: string, maxMessages?: number): ChatManager {
  return new ChatManager(sessionId, maxMessages)
}

/** @deprecated Use DI container or createChatManager() instead */
export const chatManager = new ChatManager()