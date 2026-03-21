/**
 * Task State Machine - 任务状态机
 * 
 * 基于三省六部架构的任务状态管理系统
 * 
 * 功能：
 * - 9 种任务状态
 * - 状态转移规则
 * - 权限矩阵
 * - 流转记录（flow_log）
 */

import * as fs from 'fs'
import * as path from 'path'

// ============ 类型定义 ============

/**
 * 任务状态
 */
export enum TaskState {
  PENDING = 'Pending',       // 待处理
  PLANNING = 'Planning',     // 规划中（PM Agent）
  REVIEW = 'Review',         // 审核中（Reviewer Agent）
  ASSIGNED = 'Assigned',     // 已派发
  DOING = 'Doing',           // 执行中（Developer Agent）
  TESTING = 'Testing',       // 测试中（Tester Agent）
  DONE = 'Done',             // 已完成
  CANCELLED = 'Cancelled',   // 已取消
  BLOCKED = 'Blocked'        // 被阻塞
}

/**
 * Agent 角色
 */
export enum AgentRole {
  PM = 'pm',
  REVIEWER = 'reviewer',
  ARCHITECT = 'architect',
  DEVELOPER = 'developer',
  TESTER = 'tester',
  DEVOPS = 'devops'
}

/**
 * 流转记录
 */
export interface FlowLogEntry {
  id: string
  taskId: string
  fromState: TaskState
  toState: TaskState
  agent: AgentRole
  timestamp: string
  reason?: string
  metadata?: Record<string, any>
}

/**
 * 任务定义
 */
export interface Task {
  id: string
  title: string
  description: string
  state: TaskState
  assignedTo?: AgentRole
  createdBy: AgentRole
  createdAt: string
  updatedAt: string
  retryCount: number
  escalationLevel: number
  flowLog: FlowLogEntry[]
  metadata?: Record<string, any>
}

/**
 * 状态转移结果
 */
export interface TransitionResult {
  success: boolean
  task?: Task
  error?: string
  flowLogEntry?: FlowLogEntry
}

// ============ 状态转移规则 ============

/**
 * 状态转移映射表
 */
export const STATE_TRANSITIONS: Record<TaskState, TaskState[]> = {
  [TaskState.PENDING]: [TaskState.PLANNING, TaskState.CANCELLED],
  [TaskState.PLANNING]: [TaskState.REVIEW, TaskState.BLOCKED],
  [TaskState.REVIEW]: [TaskState.PLANNING, TaskState.ASSIGNED],  // Reviewer 可以打回或批准
  [TaskState.ASSIGNED]: [TaskState.DOING, TaskState.TESTING],
  [TaskState.DOING]: [TaskState.TESTING, TaskState.REVIEW, TaskState.BLOCKED],
  [TaskState.TESTING]: [TaskState.DOING, TaskState.DONE, TaskState.BLOCKED],
  [TaskState.DONE]: [],  // 终态
  [TaskState.CANCELLED]: [],  // 终态
  [TaskState.BLOCKED]: [TaskState.PLANNING, TaskState.CANCELLED]
}

// ============ 权限矩阵 ============

/**
 * 权限定义
 */
export interface Permission {
  canCreate: boolean
  canEdit: TaskState[]  // 可以编辑哪些状态的任务
  canApprove: boolean
  canReject: boolean
  canDispatch: AgentRole[]  // 可以派发给哪些角色
}

/**
 * 权限矩阵
 */
export const PERMISSION_MATRIX: Record<AgentRole, Permission> = {
  [AgentRole.PM]: {
    canCreate: true,
    canEdit: [TaskState.PLANNING],
    canApprove: false,
    canReject: false,
    canDispatch: [AgentRole.ARCHITECT, AgentRole.DEVELOPER, AgentRole.TESTER, AgentRole.DEVOPS]
  },
  [AgentRole.REVIEWER]: {
    canCreate: false,
    canEdit: [],
    canApprove: true,  // 可以批准或打回
    canReject: true,   // 可以封驳
    canDispatch: []
  },
  [AgentRole.ARCHITECT]: {
    canCreate: false,
    canEdit: [],
    canApprove: false,
    canReject: false,
    canDispatch: [AgentRole.DEVELOPER, AgentRole.DEVOPS]
  },
  [AgentRole.DEVELOPER]: {
    canCreate: false,
    canEdit: [TaskState.DOING],
    canApprove: false,
    canReject: false,
    canDispatch: [AgentRole.TESTER]
  },
  [AgentRole.TESTER]: {
    canCreate: false,
    canEdit: [TaskState.TESTING],
    canApprove: false,
    canReject: false,
    canDispatch: [AgentRole.DEVELOPER]
  },
  [AgentRole.DEVOPS]: {
    canCreate: false,
    canEdit: [],
    canApprove: false,
    canReject: false,
    canDispatch: []
  }
}

// ============ 任务状态机 ============

/**
 * 任务状态机配置
 */
export interface TaskStateMachineOptions {
  /** 流转日志存储路径 */
  flowLogPath?: string
  /** 任务存储路径 */
  taskStoragePath?: string
  /** 最大重试次数 */
  maxRetryCount?: number
  /** 最大升级次数 */
  maxEscalationLevel?: number
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<TaskStateMachineOptions> = {
  flowLogPath: './flow-logs',
  taskStoragePath: './tasks',
  maxRetryCount: 3,
  maxEscalationLevel: 2
}

/**
 * 任务状态机
 */
export class TaskStateMachine {
  private options: Required<TaskStateMachineOptions>
  private tasks: Map<string, Task> = new Map()

  constructor(options: TaskStateMachineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.ensureDirectories()
    this.loadTasks()
  }

  /**
   * 创建任务
   */
  createTask(
    title: string,
    description: string,
    createdBy: AgentRole,
    metadata?: Record<string, any>
  ): Task {
    const task: Task = {
      id: this.generateTaskId(),
      title,
      description,
      state: TaskState.PENDING,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      escalationLevel: 0,
      flowLog: [],
      metadata
    }

    // 检查创建权限
    if (!this.hasPermission(createdBy, 'canCreate')) {
      throw new Error(`Agent ${createdBy} 没有创建任务的权限`)
    }

    this.tasks.set(task.id, task)
    this.saveTask(task)
    
    console.log(`✅ 创建任务: ${task.id} - ${title}`)
    return task
  }

  /**
   * 状态转移
   */
  transition(
    taskId: string,
    toState: TaskState,
    agent: AgentRole,
    reason?: string,
    metadata?: Record<string, any>
  ): TransitionResult {
    const task = this.tasks.get(taskId)
    if (!task) {
      return {
        success: false,
        error: `任务不存在: ${taskId}`
      }
    }

    const fromState = task.state

    // 检查状态转移是否合法
    if (!this.isValidTransition(fromState, toState)) {
      return {
        success: false,
        error: `非法状态转移: ${fromState} → ${toState}`
      }
    }

    // 检查权限
    if (!this.canTransition(agent, fromState, toState, task)) {
      return {
        success: false,
        error: `Agent ${agent} 没有权限执行 ${fromState} → ${toState} 转移`
      }
    }

    // 创建流转记录
    const flowLogEntry: FlowLogEntry = {
      id: this.generateFlowLogId(),
      taskId,
      fromState,
      toState,
      agent,
      timestamp: new Date().toISOString(),
      reason,
      metadata
    }

    // 更新任务状态
    task.state = toState
    task.updatedAt = new Date().toISOString()
    task.flowLog.push(flowLogEntry)

    // 保存
    this.saveTask(task)
    this.saveFlowLog(flowLogEntry)

    console.log(`✅ 状态转移: ${taskId} ${fromState} → ${toState} (by ${agent})`)

    return {
      success: true,
      task,
      flowLogEntry
    }
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 按状态获取任务
   */
  getTasksByState(state: TaskState): Task[] {
    return this.getAllTasks().filter(task => task.state === state)
  }

  /**
   * 按角色获取任务
   */
  getTasksByAgent(agent: AgentRole): Task[] {
    return this.getAllTasks().filter(task => task.assignedTo === agent)
  }

  /**
   * 检查状态转移是否合法
   */
  isValidTransition(fromState: TaskState, toState: TaskState): boolean {
    const allowedTransitions = STATE_TRANSITIONS[fromState]
    return allowedTransitions.includes(toState)
  }

  /**
   * 检查 Agent 是否有权限执行状态转移
   */
  canTransition(agent: AgentRole, fromState: TaskState, toState: TaskState, task?: Task): boolean {
    const permission = PERMISSION_MATRIX[agent]

    // 特殊情况 1：任务创建者可以启动任务（Pending → Planning）
    if (fromState === TaskState.PENDING && toState === TaskState.PLANNING && task?.createdBy === agent) {
      return true
    }

    // 特殊情况 2：PM 可以规划任务（Pending → Planning）
    if (fromState === TaskState.PENDING && toState === TaskState.PLANNING && agent === AgentRole.PM) {
      return true
    }

    // 特殊情况 3：Reviewer 审核任务
    if (fromState === TaskState.REVIEW && agent === AgentRole.REVIEWER) {
      return true
    }

    // 特殊情况 4：PM 可以提交审核（Planning → Review）
    if (fromState === TaskState.PLANNING && toState === TaskState.REVIEW && agent === AgentRole.PM) {
      return true
    }

    // 特殊情况 5：Architect 可以派发任务（Assigned → Doing）
    if (fromState === TaskState.ASSIGNED && toState === TaskState.DOING && agent === AgentRole.ARCHITECT) {
      return true
    }

    // 特殊情况 6：Developer 可以提交测试（Doing → Testing）
    if (fromState === TaskState.DOING && toState === TaskState.TESTING && agent === AgentRole.DEVELOPER) {
      return true
    }

    // 特殊情况 7：Tester 可以完成测试（Testing → Done）
    if (fromState === TaskState.TESTING && toState === TaskState.DONE && agent === AgentRole.TESTER) {
      return true
    }

    // 检查编辑权限
    if (permission.canEdit.includes(fromState)) {
      return true
    }

    // 检查派发权限
    if (toState === TaskState.ASSIGNED || toState === TaskState.DOING || toState === TaskState.TESTING) {
      return permission.canDispatch.length > 0
    }

    return false
  }

  /**
   * 检查权限
   */
  hasPermission(agent: AgentRole, permissionKey: keyof Permission): boolean {
    return PERMISSION_MATRIX[agent][permissionKey] as boolean
  }

  /**
   * 获取任务的流转历史
   */
  getTaskFlowLog(taskId: string): FlowLogEntry[] {
    const task = this.tasks.get(taskId)
    return task?.flowLog || []
  }

  /**
   * 处理停滞任务
   */
  handleStalledTask(taskId: string): TransitionResult {
    const task = this.tasks.get(taskId)
    if (!task) {
      return {
        success: false,
        error: `任务不存在: ${taskId}`
      }
    }

    const elapsed = Date.now() - new Date(task.updatedAt).getTime()

    // 3 分钟内不处理
    if (elapsed < 180000) {
      return {
        success: false,
        error: '任务未停滞（3分钟内）'
      }
    }

    // 重试逻辑
    if (task.retryCount < this.options.maxRetryCount) {
      task.retryCount++
      task.updatedAt = new Date().toISOString()
      this.saveTask(task)
      
      console.log(`⚠️ 任务停滞，自动重试第 ${task.retryCount} 次`)
      
      // 创建重试记录（不改变状态）
      const flowLogEntry: FlowLogEntry = {
        id: this.generateFlowLogId(),
        taskId,
        fromState: task.state,
        toState: task.state,
        agent: AgentRole.PM,
        timestamp: new Date().toISOString(),
        reason: `自动重试（第 ${task.retryCount} 次）`,
        metadata: { type: 'retry' }
      }
      task.flowLog.push(flowLogEntry)
      this.saveFlowLog(flowLogEntry)
      
      return {
        success: true,
        task,
        flowLogEntry
      }
    }

    // 升级逻辑
    if (task.escalationLevel < this.options.maxEscalationLevel) {
      task.escalationLevel++
      const agent = task.escalationLevel === 1 ? AgentRole.REVIEWER : AgentRole.PM
      console.log(`⚠️ 任务升级至 ${agent} 协调`)
      
      // 直接更新状态（绕过权限检查）
      const fromState = task.state
      task.state = TaskState.BLOCKED
      task.updatedAt = new Date().toISOString()
      
      const flowLogEntry: FlowLogEntry = {
        id: this.generateFlowLogId(),
        taskId,
        fromState,
        toState: TaskState.BLOCKED,
        agent,
        timestamp: new Date().toISOString(),
        reason: `升级协调（Level ${task.escalationLevel}）`,
        metadata: { type: 'escalation' }
      }
      task.flowLog.push(flowLogEntry)
      this.saveTask(task)
      this.saveFlowLog(flowLogEntry)
      
      return {
        success: true,
        task,
        flowLogEntry
      }
    }

    // 自动回滚
    const snapshot = this.getLatestSnapshot(task)
    if (snapshot) {
      const fromState = task.state
      task.state = snapshot.state
      task.retryCount = 0
      task.escalationLevel = 0
      task.updatedAt = new Date().toISOString()
      
      console.log(`⚠️ 连续停滞，自动回滚到 ${snapshot.state}`)
      
      const flowLogEntry: FlowLogEntry = {
        id: this.generateFlowLogId(),
        taskId,
        fromState,
        toState: snapshot.state,
        agent: AgentRole.PM,
        timestamp: new Date().toISOString(),
        reason: '自动回滚',
        metadata: { type: 'rollback' }
      }
      task.flowLog.push(flowLogEntry)
      this.saveTask(task)
      this.saveFlowLog(flowLogEntry)
      
      return {
        success: true,
        task,
        flowLogEntry
      }
    }

    return {
      success: false,
      error: '无法处理停滞任务'
    }
  }

  // ============ 私有方法 ============

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateFlowLogId(): string {
    return `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.options.flowLogPath)) {
      fs.mkdirSync(this.options.flowLogPath, { recursive: true })
    }
    if (!fs.existsSync(this.options.taskStoragePath)) {
      fs.mkdirSync(this.options.taskStoragePath, { recursive: true })
    }
  }

  private loadTasks(): void {
    try {
      const files = fs.readdirSync(this.options.taskStoragePath)
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.options.taskStoragePath, file)
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          this.tasks.set(data.id, data)
        }
      })
      console.log(`📂 加载任务: ${this.tasks.size} 个`)
    } catch (error) {
      console.error('❌ 加载任务失败:', error)
    }
  }

  private saveTask(task: Task): void {
    try {
      const filePath = path.join(this.options.taskStoragePath, `${task.id}.json`)
      fs.writeFileSync(filePath, JSON.stringify(task, null, 2))
    } catch (error) {
      console.error('❌ 保存任务失败:', error)
    }
  }

  private saveFlowLog(entry: FlowLogEntry): void {
    try {
      const date = new Date().toISOString().split('T')[0]
      const filePath = path.join(this.options.flowLogPath, `flow-${date}.jsonl`)
      fs.appendFileSync(filePath, JSON.stringify(entry) + '\n')
    } catch (error) {
      console.error('❌ 保存流转记录失败:', error)
    }
  }

  private getLatestSnapshot(task: Task): { state: TaskState } | null {
    // 从流转记录中获取最新的非阻塞状态
    for (let i = task.flowLog.length - 1; i >= 0; i--) {
      const entry = task.flowLog[i]
      if (entry.toState !== TaskState.BLOCKED) {
        return { state: entry.toState }
      }
    }
    return null
  }
}

// 导出
export default TaskStateMachine
