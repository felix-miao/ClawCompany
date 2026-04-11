import { Message, Task } from '../core/types'
import {
  validateChatResponse,
  validateChatHistoryResponse,
  APIError,
} from './type-utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''
export const REQUEST_TIMEOUT_MS = 10000

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

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`)
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function sendMessage(message: string): Promise<ChatResponse> {
  try {
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

    const response = await fetchWithTimeout(`${API_BASE}/api/chat`, {
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
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: `Request timeout (${REQUEST_TIMEOUT_MS / 1000}s)`,
      }
    }
    console.error('Failed to send message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getChatHistory(): Promise<ChatHistoryResponse> {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/chat`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new APIError(`API error: ${response.status}`, 'HTTP_ERROR', response.status)
    }

    const data = await response.json()
    return validateChatHistoryResponse(data)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('getChatHistory: request timeout')
      return {
        tasks: [],
        chatHistory: [],
        agents: [],
      }
    }
    console.error('Failed to get chat history:', error)
    return {
      tasks: [],
      chatHistory: [],
      agents: [],
    }
  }
}
