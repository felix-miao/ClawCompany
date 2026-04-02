// API 客户端 - 与后端交互

import { Message, Task } from '../core/types'

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
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
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
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get chat history:', error)
    return {
      tasks: [],
      chatHistory: [],
      agents: [],
    }
  }
}
