// Chat Manager - 对话管理器

import { AgentRole, Message } from '../agents/types'

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
      id: this.generateId(),
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

  // 模拟 Agent 发送消息
  broadcast(agent: AgentRole, content: string): Message {
    return this.addMessage(agent, content, 'text')
  }

  // 用户发送消息
  sendUserMessage(content: string): Message {
    return this.addMessage('user', content, 'text')
  }

  // 代码消息
  sendCodeMessage(agent: AgentRole, code: string, language: string = 'typescript'): Message {
    return this.addMessage(agent, code, 'code', { codeLanguage: language })
  }

  // 文件消息
  sendFileMessage(agent: AgentRole, filePath: string, content: string): Message {
    return this.addMessage(agent, content, 'file', { filePath })
  }

  // 任务消息
  sendTaskMessage(agent: AgentRole, taskId: string, content: string): Message {
    return this.addMessage(agent, content, 'task', { taskId })
  }

  // 序列化/反序列化
  toJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      messages: this.messages
    })
  }

  static fromJSON(json: string): ChatManager {
    const data = JSON.parse(json)
    const manager = new ChatManager(data.sessionId)
    manager.messages = data.messages.map((m: Message) => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }))
    return manager
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }
}

// 全局聊天管理器实例
export const chatManager = new ChatManager()
