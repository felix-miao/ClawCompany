/**
 * 类型安全的API响应验证工具
 * 用于确保API响应的正确性和类型安全
 */

import { z } from 'zod'

import { Message, Task, AgentRole } from '../core/types'

// 定义API响应的Zod Schema
export const ChatResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.enum(['pending', 'in_progress', 'review', 'completed', 'failed']),
    assignedTo: z.enum(['pm', 'dev', 'review', 'tester']),
    dependencies: z.array(z.string()),
    files: z.array(z.string()),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
  })).optional(),
  chatHistory: z.array(z.object({
    id: z.string(),
    agent: z.enum(['user', 'pm', 'dev', 'review', 'tester']),
    content: z.string(),
    type: z.enum(['text', 'code', 'file', 'task']),
    timestamp: z.coerce.date(),
    metadata: z.object({
      taskId: z.string().optional(),
      filePath: z.string().optional(),
      codeLanguage: z.string().optional(),
    }).optional(),
  })).optional(),
  error: z.string().optional(),
})

export const ChatHistoryResponseSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.enum(['pending', 'in_progress', 'review', 'completed', 'failed']),
    assignedTo: z.enum(['pm', 'dev', 'review', 'tester']),
    dependencies: z.array(z.string()),
    files: z.array(z.string()),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
  })),
  chatHistory: z.array(z.object({
    id: z.string(),
    agent: z.enum(['user', 'pm', 'dev', 'review', 'tester']),
    content: z.string(),
    type: z.enum(['text', 'code', 'file', 'task']),
    timestamp: z.coerce.date(),
    metadata: z.object({
      taskId: z.string().optional(),
      filePath: z.string().optional(),
      codeLanguage: z.string().optional(),
    }).optional(),
  })),
  agents: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    description: z.string(),
  })),
})

// 类型安全的响应验证函数
export function validateChatResponse(data: unknown): z.infer<typeof ChatResponseSchema> {
  try {
    return ChatResponseSchema.parse(data)
  } catch (error) {
    console.error('Chat response validation failed:', error)
    return {
      success: false,
      error: 'Invalid response format',
    }
  }
}

export function validateChatHistoryResponse(data: unknown): z.infer<typeof ChatHistoryResponseSchema> {
  try {
    return ChatHistoryResponseSchema.parse(data)
  } catch (error) {
    console.error('Chat history response validation failed:', error)
    return {
      tasks: [],
      chatHistory: [],
      agents: [],
    }
  }
}

// 错误处理工具
export class APIError extends Error {
  constructor(
    message: string,
    public code: string = 'API_ERROR',
    public statusCode?: number
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export class ValidationError extends APIError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}