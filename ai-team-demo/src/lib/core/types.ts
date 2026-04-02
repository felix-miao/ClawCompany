export type AgentRole = 'pm' | 'dev' | 'review'

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done' | 'completed' | 'failed'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  assignedTo: AgentRole | 'dev'
  dependencies: string[]
  files: string[]
  createdAt?: Date
  updatedAt?: Date
}

export interface FileChange {
  path: string
  content: string
  action: 'create' | 'modify' | 'delete'
}

export interface AgentResponse {
  agent: AgentRole
  message: string
  tasks?: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]
  files?: FileChange[]
  nextAgent?: AgentRole
  status: 'success' | 'error' | 'need_input'
  metadata?: Record<string, unknown>
}

export interface AgentContext {
  projectId: string
  tasks: Task[]
  files: Record<string, string>
  chatHistory: ChatMessage[]
}

export interface ChatMessage {
  id?: string
  agent: 'user' | AgentRole
  content: string
  type?: 'text' | 'code' | 'file' | 'task'
  timestamp?: Date
  metadata?: {
    taskId?: string
    filePath?: string
    codeLanguage?: string
  }
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

export interface WorkflowError {
  message: string
  code?: string
  task?: string
  timestamp: Date
  retryCount?: number
}

export interface FailedTask {
  taskId: string
  taskTitle: string
  error: string
  retryCount: number
  timestamp: Date
}

export interface WorkflowStats {
  totalTasks: number
  successfulTasks: number
  failedTasks: number
  totalRetries: number
  executionTime: number
}

export interface WorkflowResult {
  success: boolean
  messages: Array<{
    agent: AgentRole | 'user'
    content: string
    timestamp?: Date
  }>
  tasks: Task[]
  files?: FileChange[]
  error?: WorkflowError
  failedTasks?: FailedTask[]
  stats?: WorkflowStats
}

export interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export interface AgentConfig {
  thinking?: 'low' | 'medium' | 'high'
  model?: string
}
