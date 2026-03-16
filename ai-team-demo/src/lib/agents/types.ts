// Agent 类型定义

export type AgentRole = 'pm' | 'dev' | 'review'

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  assignedTo: AgentRole
  dependencies: string[]
  files: string[]
  createdAt: Date
  updatedAt: Date
}

export interface AgentResponse {
  agent: AgentRole
  message: string
  tasks?: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]
  files?: {
    path: string
    content: string
    action: 'create' | 'modify' | 'delete'
  }[]
  nextAgent?: AgentRole
  status: 'success' | 'error' | 'need_input'
  metadata?: Record<string, any>
}

export interface AgentContext {
  projectId: string
  tasks: Task[]
  files: Record<string, string>
  chatHistory: Message[]
}

export interface Message {
  id: string
  agent: 'user' | AgentRole
  content: string
  type: 'text' | 'code' | 'file' | 'task'
  timestamp: Date
  metadata?: {
    taskId?: string
    filePath?: string
    codeLanguage?: string
  }
}
