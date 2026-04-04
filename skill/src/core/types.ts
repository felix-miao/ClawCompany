export type {
  AgentRole,
  TaskStatus,
  Task,
  PMResult,
  DevResult,
  ReviewResult,
  ExecutionResult,
  AgentConfig,
} from '@ai-team-demo/lib/core/types'

export interface OrchestratorConfig {
  projectPath?: string
  thinking?: 'low' | 'medium' | 'high'
  model?: string
}
