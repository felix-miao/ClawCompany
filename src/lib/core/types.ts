export type AgentRole = 'pm' | 'dev' | 'review' | 'tester' | 'devil-advocate' | 'arbiter'

export interface AgentRoleDefinition {
  name: string
  profile: string
  goal: string
  capabilities: string[]
  constraints?: string[]
}

export const DEFAULT_ROLE_DEFINITIONS: Record<AgentRole, AgentRoleDefinition> = {
  pm: {
    name: 'PM Claw',
    profile: '经验丰富的产品经理，负责需求分析、任务拆分和团队协调',
    goal: '将用户需求转化为可执行的子任务',
    capabilities: ['需求分析', '任务拆分', '依赖管理', '优先级排序'],
    constraints: ['不直接编写代码', '不进行代码审查'],
  },
  dev: {
    name: 'Dev Claw',
    profile: '资深全栈开发者，负责代码实现和功能开发',
    goal: '生成完整、可运行的代码',
    capabilities: ['前端开发', '后端开发', 'API设计', '代码生成'],
    constraints: ['不进行代码审查', '不写测试用例'],
  },
  review: {
    name: 'Reviewer Claw',
    profile: '资深代码审查员，负责代码质量检查',
    goal: '确保代码质量并提出改进建议',
    capabilities: ['代码审查', '质量检查', '最佳实践建议', '问题识别'],
    constraints: ['不直接修改代码', '不实现功能'],
  },
  tester: {
    name: 'Tester Claw',
    profile: 'QA工程师，负责测试用例编写和执行',
    goal: '确保功能质量和稳定性',
    capabilities: ['测试用例编写', '单元测试', '集成测试', '缺陷报告'],
    constraints: ['不实现新功能', '不修改生产代码'],
  },
  'devil-advocate': {
    name: "Devil's Advocate Claw",
    profile: '对抗性审查专家，专门寻找方案中的假设漏洞、极端情况和灾难性失败模式',
    goal: '通过对抗性质疑确保方案的健壮性，防止未受挑战的共识导致灾难性失败',
    capabilities: [
      '假设攻击',
      '安全漏洞挖掘',
      '边缘情况构造',
      '性能陷阱识别',
      '可维护性质疑',
      '一致性检查',
      'Challenge Ledger 管理',
    ],
    constraints: [
      '不直接修改代码',
      '不实现功能',
      '不重复已被封闭(SEALED)的挑战',
      '每个挑战必须是可证伪的',
    ],
  },
  arbiter: {
    name: 'Arbiter Claw',
    profile: '最终裁决者，在 Critic 和 Devil\'s Advocate 对抗性评估之后综合证据做出终局判决',
    goal: '消除 Critic/DA 分歧，给出明确可执行的最终判决（ACCEPT/REVISE/REJECT）和 DP Score',
    capabilities: [
      '证据综合',
      '分歧仲裁',
      'DP Score 计算',
      '终局判决',
      '必修改项提炼',
      '流程质量评注',
    ],
    constraints: [
      '不提出新问题（只处理已有证据）',
      '不偏袒 Critic 或 DA',
      '判决必须可直接执行',
      '必须解释分歧处理逻辑',
    ],
  },
}

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'failed' | 'awaiting_human_review' | 'cancelled'

export type GameTaskStatus = 'pending' | 'assigned' | 'working' | 'reviewing' | 'completed' | 'failed'

export type GameTaskType = 'coding' | 'testing' | 'review' | 'meeting'

export interface TaskArtifact {
  type: 'html' | 'code' | 'image' | 'file'
  name: string
  path: string
  preview?: string
}

export interface GameTaskMetadata {
  files?: string[]
  estimatedDuration?: number
  priority?: 'low' | 'medium' | 'high'
  dependencies?: string[]
  artifacts?: TaskArtifact[]
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

export const TASK_STATUS_VALUES: readonly TaskStatus[] = ['pending', 'in_progress', 'review', 'completed', 'failed', 'awaiting_human_review', 'cancelled']

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
  completed: 'completed',
  failed: 'failed',
  awaiting_human_review: 'failed',
  cancelled: 'failed',
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
  assignedTo: AgentRole
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
  agent?: AgentRole
  message: string
  tasks?: (Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: TaskStatus })[]
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
  pmAnalysis?: string
  reviewFeedback?: string
  /** Devil's Advocate 评估反馈（Challenge Ledger JSON 字符串） */
  daFeedback?: string
  /**
   * Short-term memory hints injected from WorkingMemory.
   * Each entry is a formatted string: "[role/key]: value"
   * Agents can optionally include these in their prompts for continuity.
   */
  memoryHints?: string[]
  /**
   * Historical review context block (Markdown) injected from ReviewMemoryStore.
   * Prepended to the Reviewer's user prompt to surface recurring issues from
   * past reviews across tasks.
   */
  reviewHistoryContext?: string
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
    /**
     * For tool_result messages: the id of the corresponding tool_call message.
     * Used by context compression to keep tool_call/result pairs together.
     */
    toolCallId?: string
    /**
     * True when this message is a compression summary produced by compressHistory().
     * Enables incremental summarisation: instead of re-summarising from scratch,
     * subsequent compressions update the existing summary.
     */
    isSummary?: boolean
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

export type RPCResponse =
  | { jsonrpc: '2.0'; id: number; result: unknown; error?: undefined }
  | { jsonrpc: '2.0'; id: number; result?: undefined; error: RPCError }

export interface PendingCall {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}
