export type AgentRole = 'pm' | 'dev' | 'review'

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done' | 'completed' | 'failed'

export type GameTaskStatus = 'pending' | 'assigned' | 'working' | 'reviewing' | 'completed' | 'failed'

export type GameTaskType = 'coding' | 'testing' | 'review' | 'meeting'

export interface GameTaskMetadata {
  files?: string[]
  estimatedDuration?: number
  priority?: 'low' | 'medium' | 'high'
  dependencies?: string[]
}

export interface GameTask {
  id: string
  agentId: string
  description: string
  status: GameTaskStatus
  progress: number
  currentAction: string
  taskType: GameTaskType
  assignedAt: number
  completedAt: number | null
  parentTaskId: string | null
  metadata?: GameTaskMetadata
}

export interface GameTaskCreateInput {
  description: string
  taskType: GameTaskType
  currentAction?: string
  parentTaskId?: string | null
  metadata?: GameTaskMetadata
}

export type UnifiedTaskStatus = TaskStatus | GameTaskStatus

export const TASK_STATUS_VALUES: readonly TaskStatus[] = ['pending', 'in_progress', 'review', 'done', 'completed', 'failed']

export const GAME_STATUS_VALUES: readonly GameTaskStatus[] = ['pending', 'assigned', 'working', 'reviewing', 'completed', 'failed']

export const GAME_TO_LIB_STATUS: Readonly<Record<GameTaskStatus, TaskStatus>> = {
  pending: 'pending',
  assigned: 'pending',
  working: 'in_progress',
  reviewing: 'review',
  completed: 'completed',
  failed: 'failed',
}

export const LIB_TO_GAME_STATUS: Readonly<Record<TaskStatus, GameTaskStatus>> = {
  pending: 'pending',
  in_progress: 'working',
  review: 'reviewing',
  done: 'completed',
  completed: 'completed',
  failed: 'failed',
}

export function gameStatusToLib(status: GameTaskStatus): TaskStatus {
  return GAME_TO_LIB_STATUS[status]
}

export function libStatusToGame(status: TaskStatus): GameTaskStatus {
  return LIB_TO_GAME_STATUS[status]
}

export function isLibTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUS_VALUES as readonly string[]).includes(value)
}

export function isGameTaskStatus(value: string): value is GameTaskStatus {
  return (GAME_STATUS_VALUES as readonly string[]).includes(value)
}

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

export interface Message extends ChatMessage {
  id: string
  type: 'text' | 'code' | 'file' | 'task'
  timestamp: Date
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

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data }
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error }
}

export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success
}

export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success
}

export interface ParsedFileEntry {
  path: string
  content: string
  action: 'create' | 'modify' | 'delete'
}

export interface ParsedOpenClawResponse {
  files: ParsedFileEntry[]
  message: string
}

export interface RPCRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: Record<string, unknown>
}

export interface RPCError {
  code: number
  message: string
  data?: unknown
}

export interface RPCResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: RPCError
}

export interface PendingCall {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}
