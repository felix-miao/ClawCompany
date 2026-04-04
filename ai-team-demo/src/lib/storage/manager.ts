import * as fs from 'fs/promises'
import * as path from 'path'
import { z } from 'zod'

import { FileSystemManager } from '../filesystem/manager'
import { generateId } from '../utils/id'
import { safeJsonParse } from '../utils/json-parser'

import type { PersistedAgentConfig } from '@/types/agent-config'
import { PersistedAgentConfigSchema } from '@/types/agent-config'

/**
 * 持久化存储管理器
 * 
 * 负责管理 ClawCompany 的数据持久化，包括：
 * - 对话历史
 * - Agent 配置
 * - 项目设置
 * 
 * 存储结构：
 * ~/.clawcompany/
 * ├── conversations/    # 对话历史
 * │   └── {id}.json
 * ├── agents/          # Agent 配置
 * │   └── {id}.json
 * └── config.json      # 全局配置
 */

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  agentId: string
  agentName: string
  content: string
  timestamp: string
}

export type AgentConfig = PersistedAgentConfig

export { PersistedAgentConfigSchema as AgentConfigSchema } from '@/types/agent-config'

const ConversationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  messages: z.array(z.object({
    id: z.string(),
    agentId: z.string(),
    agentName: z.string(),
    content: z.string(),
    timestamp: z.string(),
  })),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

const INVALID_ID_PATTERN = /(\.\.|\/|\\|\x00)/

function validateId(id: string, context: string): void {
  if (!id || id.trim().length === 0) {
    throw new Error(`${context}: invalid ID - must not be empty`)
  }
  if (INVALID_ID_PATTERN.test(id)) {
    throw new Error(`${context}: invalid ID "${id}"`)
  }
}

export class StorageManager {
  private dataDir: string
  private fsManager: FileSystemManager

  constructor(dataDir?: string) {
    // 默认使用 ~/.clawcompany 目录
    this.dataDir = dataDir || path.join(process.env.HOME || '/tmp', '.clawcompany')
    this.fsManager = new FileSystemManager(this.dataDir)
  }

  /**
   * 初始化存储目录
   */
  async initialize(): Promise<void> {
    await this.fsManager.createFile('conversations/.gitkeep', '')
    await this.fsManager.createFile('agents/.gitkeep', '')
    await this.fsManager.createFile('config.json', JSON.stringify({
      version: '1.0.0',
      createdAt: new Date().toISOString()
    }, null, 2))
  }

  // ==================== 对话管理 ====================

  /**
   * 保存对话
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    validateId(conversation.id, 'StorageManager.saveConversation')
    const filePath = `conversations/${conversation.id}.json`
    await this.fsManager.createFile(
      filePath,
      JSON.stringify(conversation, null, 2)
    )
  }

  /**
   * 加载对话
   */
  async loadConversation(id: string): Promise<Conversation | null> {
    validateId(id, 'StorageManager.loadConversation')
    const filePath = `conversations/${id}.json`
    const result = await this.fsManager.readFile(filePath)
    
    if (!result.success || !result.content) {
      return null
    }

    const parsed = safeJsonParse<Conversation>(result.content, 'StorageManager.loadConversation')
    if (!parsed.success) return null

    const validated = ConversationSchema.safeParse(parsed.data)
    return validated.success ? validated.data : null
  }

  /**
   * 列出所有对话
   */
  async listConversations(): Promise<Conversation[]> {
    const result = await this.fsManager.listFiles('conversations')
    
    if (!result.success || !result.files) {
      return []
    }

    const conversations: Conversation[] = []
    
    for (const file of result.files) {
      if (file.endsWith('.json')) {
        const id = path.basename(file, '.json')
        const conv = await this.loadConversation(id)
        if (conv) {
          conversations.push(conv)
        }
      }
    }

    // 按更新时间倒序排列
    return conversations.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  /**
   * 删除对话
   */
  async deleteConversation(id: string): Promise<void> {
    validateId(id, 'StorageManager.deleteConversation')
    const filePath = `conversations/${id}.json`
    await this.fsManager.deleteFile(filePath)
  }

  // ==================== Agent 配置管理 ====================

  /**
   * 保存 Agent 配置
   */
  async saveAgent(agent: AgentConfig): Promise<void> {
    const validated = PersistedAgentConfigSchema.parse(agent)
    validateId(validated.id, 'StorageManager.saveAgent')
    const filePath = `agents/${validated.id}.json`
    await this.fsManager.createFile(
      filePath,
      JSON.stringify(validated, null, 2)
    )
  }

  /**
   * 加载 Agent 配置
   */
  async loadAgent(id: string): Promise<AgentConfig | null> {
    validateId(id, 'StorageManager.loadAgent')
    const filePath = `agents/${id}.json`
    const result = await this.fsManager.readFile(filePath)
    
    if (!result.success || !result.content) {
      return null
    }

    const parsed = safeJsonParse<AgentConfig>(result.content, 'StorageManager.loadAgent')
    if (!parsed.success) return null

    const validated = PersistedAgentConfigSchema.safeParse(parsed.data)
    return validated.success ? validated.data : null
  }

  /**
   * 列出所有 Agent 配置
   */
  async listAgents(): Promise<AgentConfig[]> {
    const result = await this.fsManager.listFiles('agents')
    
    if (!result.success || !result.files) {
      return []
    }

    const agents: AgentConfig[] = []
    
    for (const file of result.files) {
      if (file.endsWith('.json')) {
        const id = path.basename(file, '.json')
        const agent = await this.loadAgent(id)
        if (agent) {
          agents.push(agent)
        }
      }
    }

    return agents
  }

  /**
   * 删除 Agent 配置
   */
  async deleteAgent(id: string): Promise<void> {
    validateId(id, 'StorageManager.deleteAgent')
    const filePath = `agents/${id}.json`
    await this.fsManager.deleteFile(filePath)
  }

  // ==================== 工具方法 ====================

  /**
   * 生成唯一 ID
   */
  generateId(): string {
    return generateId()
  }

  /**
   * 创建新对话
   */
  createConversation(title: string): Conversation {
    return {
      id: this.generateId(),
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * 添加消息到对话
   */
  addMessageToConversation(
    conversation: Conversation,
    message: Omit<Message, 'id' | 'timestamp'>
  ): Conversation {
    const newMessage: Message = {
      ...message,
      id: this.generateId(),
      timestamp: new Date().toISOString()
    }

    return {
      ...conversation,
      messages: [...conversation.messages, newMessage],
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * 获取存储目录
   */
  getDataDir(): string {
    return this.dataDir
  }
}
