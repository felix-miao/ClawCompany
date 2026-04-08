import { z } from 'zod'
import type { NextResponse } from 'next/server'

import { errorResponse } from './route-utils'

export const ChatRequestSchema = z.object({
  message: z.string()
    .refine(val => val.trim().length > 0, '消息不能为空')
    .max(10000, '消息不能超过 10000 字符'),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

export const AgentPostRequestSchema = z.object({
  agentId: z.string().regex(/^[a-z0-9-]+$/, 'Invalid agent ID'),
  userMessage: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long (max 10000 characters)'),
  conversationId: z.string().optional(),
})

export type AgentPostRequest = z.infer<typeof AgentPostRequestSchema>

const AgentUpdateFieldsSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['pm', 'dev', 'review', 'custom']).optional(),
  emoji: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  systemPrompt: z.string().min(1).optional(),
  runtime: z.enum(['subagent', 'acp']).optional(),
  thinking: z.enum(['low', 'medium', 'high']).optional(),
})

export const AgentPutRequestSchema = z.object({
  agentId: z.string().regex(/^[a-z0-9-]+$/, 'Invalid agent ID'),
}).merge(AgentUpdateFieldsSchema)

export type AgentPutRequest = z.infer<typeof AgentPutRequestSchema>

export function parseRequestBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): { data: T } | { error: NextResponse } {
  const result = schema.safeParse(body)
  if (result.success) {
    return { data: result.data }
  }
  const firstIssue = result.error.issues[0]
  const message = firstIssue?.message || '请求参数验证失败'
  return { error: errorResponse({ error: message }, 400) }
}
