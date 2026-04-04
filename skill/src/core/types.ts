export type {
  AgentRole,
  TaskStatus,
  GameTaskStatus,
  UnifiedTaskStatus,
  Task,
  PMResult,
  DevResult,
  ReviewResult,
  ExecutionResult,
  AgentConfig,
} from '@ai-team-demo/lib/core/types'

export {
  TASK_STATUS_VALUES,
  GAME_STATUS_VALUES,
  GAME_TO_LIB_STATUS,
  LIB_TO_GAME_STATUS,
  gameStatusToLib,
  libStatusToGame,
  isLibTaskStatus,
  isGameTaskStatus,
} from '@ai-team-demo/lib/core/types'

export interface OrchestratorConfig {
  projectPath?: string
  thinking?: 'low' | 'medium' | 'high'
  model?: string
}
