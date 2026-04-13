import { z } from 'zod'

export const APP_AGENT_ROLES = ['pm', 'dev', 'review', 'tester', 'custom'] as const
export type AppAgentRole = (typeof APP_AGENT_ROLES)[number]

const DEFAULT_AGENT_EMOJI = '🤖'
const DEFAULT_AGENT_COLOR = '#6B7280'
const DEFAULT_AGENT_SYSTEM_PROMPT = ''
const DEFAULT_AGENT_RUNTIME = 'subagent' as const

export const AgentConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  emoji: z.string().optional(),
  color: z.string().optional(),
  systemPrompt: z.string().optional(),
  runtime: z.enum(['subagent', 'acp']).optional(),
  agentId: z.string().optional(),
  thinking: z.enum(['low', 'medium', 'high']).optional(),
  maxTokens: z.number().int().positive().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>

export type ResolvedAgentConfig = Required<Pick<AgentConfig, 'id' | 'name' | 'role' | 'emoji' | 'color' | 'systemPrompt' | 'runtime'>> & Omit<AgentConfig, 'emoji' | 'color' | 'systemPrompt' | 'runtime'>

export const AGENT_DEFAULTS = {
  emoji: DEFAULT_AGENT_EMOJI,
  color: DEFAULT_AGENT_COLOR,
  systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT,
  runtime: DEFAULT_AGENT_RUNTIME,
} as const

export function resolveAgentConfig(config: AgentConfig): ResolvedAgentConfig {
  return {
    ...config,
    emoji: config.emoji ?? AGENT_DEFAULTS.emoji,
    color: config.color ?? AGENT_DEFAULTS.color,
    systemPrompt: config.systemPrompt ?? AGENT_DEFAULTS.systemPrompt,
    runtime: config.runtime ?? AGENT_DEFAULTS.runtime,
  }
}

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

export function validateAgentConfig(data: unknown): ResolvedAgentConfig {
  const parsed = AgentConfigSchema.parse(data)
  return resolveAgentConfig(parsed)
}
