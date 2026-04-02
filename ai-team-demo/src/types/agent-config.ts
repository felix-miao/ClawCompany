import { z } from 'zod'

export const APP_AGENT_ROLES = ['pm', 'dev', 'review', 'custom'] as const
export type AppAgentRole = (typeof APP_AGENT_ROLES)[number]

export const AgentConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  emoji: z.string().optional().default('🤖'),
  color: z.string().optional().default('#6B7280'),
  systemPrompt: z.string().optional().default(''),
  runtime: z.enum(['subagent', 'acp']).optional().default('subagent'),
  agentId: z.string().optional(),
  thinking: z.enum(['low', 'medium', 'high']).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>

export const AppAgentConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(APP_AGENT_ROLES),
  emoji: z.string().min(1),
  color: z.string().min(1),
  systemPrompt: z.string().min(1),
  runtime: z.enum(['subagent', 'acp']),
  agentId: z.string().optional(),
  thinking: z.enum(['low', 'medium', 'high']).optional(),
})

export type AppAgentConfig = z.infer<typeof AppAgentConfigSchema>

export const PersistedAgentConfigSchema = AppAgentConfigSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export type PersistedAgentConfig = z.infer<typeof PersistedAgentConfigSchema>

export function validateAgentConfig(data: unknown): AgentConfig {
  return AgentConfigSchema.parse(data)
}
