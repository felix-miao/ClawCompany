// API 客户端 - 与后端交互

import { Message, Task } from '../core/types'
import { 
  validateChatResponse, 
  validateChatHistoryResponse, 
  APIError 
} from './type-utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

export interface ChatResponse {
  success: boolean
  message?: string
  tasks?: Task[]
  chatHistory?: Message[]
  error?: string
}

export interface ChatHistoryResponse {
  tasks: Task[]
  chatHistory: Message[]
  agents: Array<{
    id: string
    name: string
    role: string
    description: string
  }>
}

export async function sendMessage(message: string): Promise<ChatResponse> {
  try {
    // 验证输入
    if (!message || typeof message !== 'string') {
      return {
        success: false,
        error: 'Message must be a non-empty string',
      }
    }

    if (message.length > 10000) {
      return {
        success: false,
        error: 'Message too long (max 10000 characters)',
      }
    }

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      throw new APIError(`API error: ${response.status}`, 'HTTP_ERROR', response.status)
    }

    const data = await response.json()
    return validateChatResponse(data)
  } catch (error) {
    console.error('Failed to send message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getChatHistory(): Promise<ChatHistoryResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new APIError(`API error: ${response.status}`, 'HTTP_ERROR', response.status)
    }

    const data = await response.json()
    return validateChatHistoryResponse(data)
  } catch (error) {
    console.error('Failed to get chat history:', error)
    return {
      tasks: [],
      chatHistory: [],
      agents: [],
    }
  }
}
