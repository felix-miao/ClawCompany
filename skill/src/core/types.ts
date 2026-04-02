export type AgentRole = 'pm' | 'dev' | 'review'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'review' | 'done'

export interface Task {
  id: string
  title: string
  description: string
  assignedTo: AgentRole | 'dev'
  dependencies: string[]
  status: TaskStatus
}

export interface PMResult {
  analysis: string
  tasks: Task[]
}

export interface DevResult {
  success: boolean
  files: string[]
  summary: string
}

export interface ReviewResult {
  approved: boolean
  issues: string[]
  suggestions: string[]
  summary: string
}

export interface ExecutionResult {
  success: boolean
  tasks: Task[]
  results: Array<{
    task: Task
    files: string[]
    review: ReviewResult
  }>
  summary: string
}

export interface AgentConfig {
  thinking?: 'low' | 'medium' | 'high'
  model?: string
}

export interface OrchestratorConfig {
  projectPath?: string
  thinking?: 'low' | 'medium' | 'high'
  model?: string
}
