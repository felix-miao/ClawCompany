import { Task, TaskStatus, AgentRole, TASK_STATUS_VALUES } from '../core/types'
import { generateId } from '../utils/id'
import { safeJsonParse } from '../utils/json-parser'
import { TaskStateMachine, InvalidTransitionError } from './state-machine'

export { TaskStateMachine, InvalidTransitionError } from './state-machine'

const VALID_STATUSES: readonly string[] = [...TASK_STATUS_VALUES]
const VALID_ROLES: readonly string[] = ['pm', 'dev', 'review']

export interface TaskTransitionRecord {
  from: TaskStatus
  to: TaskStatus
  timestamp: Date
}

export type TaskLifecycleEvent =
  | {
      type: 'task:created'
      taskId: string
      timestamp: Date
      data: { title: string; status: TaskStatus; assignedTo: AgentRole }
    }
  | {
      type: 'task:status_changed'
      taskId: string
      timestamp: Date
      data: { from: TaskStatus; to: TaskStatus }
    }
  | {
      type: 'task:assigned'
      taskId: string
      timestamp: Date
      data: { from: AgentRole; to: AgentRole }
    }

export type TaskEventHandler = (event: TaskLifecycleEvent) => void

interface TaskWithHistory extends Task {
  _history: TaskTransitionRecord[]
}

export class TaskManager {
  private tasks: Map<string, TaskWithHistory> = new Map()
  private projectId: string
  private handlers: Set<TaskEventHandler> = new Set()

  constructor(projectId: string = 'default') {
    this.projectId = projectId
  }

  on(handler: TaskEventHandler): void {
    this.handlers.add(handler)
  }

  off(handler: TaskEventHandler): void {
    this.handlers.delete(handler)
  }

  private emit(event: TaskLifecycleEvent): void {
    Array.from(this.handlers).forEach(handler => {
      try {
        handler(event)
      } catch (error) {
        // Log error but continue execution - improved error handling
        console.error('[TaskManager] Handler error:', error instanceof Error ? error.message : String(error));
      }
    })
  }

  createTask(
    title: string,
    description: string,
    assignedTo: AgentRole,
    dependencies: string[] = [],
    files: string[] = []
  ): Task {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      throw new Error('title is required')
    }
    const trimmedDesc = description.trim()
    if (!trimmedDesc) {
      throw new Error('description is required')
    }
    if (!VALID_ROLES.includes(assignedTo)) {
      throw new Error(`Invalid agent role: ${assignedTo}`)
    }

    const now = new Date(Date.now())
    const task: TaskWithHistory = {
      id: generateId('task_'),
      title: trimmedTitle,
      description: trimmedDesc,
      status: 'pending',
      assignedTo,
      dependencies,
      files,
      createdAt: now,
      updatedAt: now,
      _history: []
    }

    this.tasks.set(task.id, task)

    this.emit({
      type: 'task:created',
      taskId: task.id,
      timestamp: now,
      data: { title: task.title, status: task.status, assignedTo: task.assignedTo }
    })

    return task
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter(t => t.status === status)
  }

  getTasksByAgent(role: AgentRole): Task[] {
    return this.getAllTasks().filter(t => t.assignedTo === role)
  }

  updateTaskStatus(taskId: string, status: TaskStatus): Task | undefined {
    const task = this.tasks.get(taskId)
    if (!task) return undefined

    if (!TaskStateMachine.isValidTransition(task.status, status)) {
      throw new InvalidTransitionError(task.status, status)
    }

    const previousStatus = task.status
    if (previousStatus === status) return task

    task._history.push({
      from: previousStatus,
      to: status,
      timestamp: new Date(Date.now())
    })

    task.status = status
    task.updatedAt = new Date(Date.now())
    this.tasks.set(taskId, task)

    this.emit({
      type: 'task:status_changed',
      taskId,
      timestamp: task.updatedAt,
      data: { from: previousStatus, to: status }
    })

    return task
  }

  assignTask(taskId: string, agent: AgentRole): Task | undefined {
    const task = this.tasks.get(taskId)
    if (!task) return undefined

    const previousAgent = task.assignedTo
    if (previousAgent === agent) return task

    task.assignedTo = agent
    task.updatedAt = new Date(Date.now())
    this.tasks.set(taskId, task)

    this.emit({
      type: 'task:assigned',
      taskId,
      timestamp: task.updatedAt,
      data: { from: previousAgent, to: agent }
    })

    return task
  }

  completeTask(taskId: string): Task | undefined {
    return this.updateTaskStatus(taskId, 'completed')
  }

  getTaskHistory(taskId: string): TaskTransitionRecord[] {
    const task = this.tasks.get(taskId)
    if (!task) return []
    return [...task._history]
  }

  getTimeInStatus(taskId: string, status: TaskStatus): number {
    const task = this.tasks.get(taskId)
    if (!task) return 0

    const history = task._history
    let totalMs = 0

    // Handle initial status (pending) - time from creation to first transition
    if (status === 'pending' && task.createdAt) {
      const firstTransition = history.find(h => h.from === 'pending')
      if (firstTransition) {
        totalMs += firstTransition.timestamp.getTime() - task.createdAt.getTime()
      } else if (task.status === 'pending') {
        // Still in pending, no transitions yet
        totalMs += Date.now() - task.createdAt.getTime()
      }
    }

    // Handle other statuses - sum time spent in each visit
    for (let i = 0; i < history.length; i++) {
      if (history[i].to !== status) continue
      const enterTime = history[i].timestamp.getTime()
      const exitTime = i + 1 < history.length
        ? history[i + 1].timestamp.getTime()
        : Date.now()
      totalMs += exitTime - enterTime
    }

    return totalMs
  }

  getStats(): {
    total: number
    pending: number
    inProgress: number
    review: number
    completed: number
    failed: number
  } {
    const tasks = this.getAllTasks()
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length
    }
  }

  clearTasks(): void {
    this.tasks.clear()
  }

  toJSON(): string {
    return JSON.stringify({
      projectId: this.projectId,
      tasks: Array.from(this.tasks.entries()).map(([id, task]) => [
        id,
        {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          assignedTo: task.assignedTo,
          dependencies: task.dependencies,
          files: task.files,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          _history: task._history
        }
      ])
    })
  }

  static fromJSON(json: string): TaskManager {
    const result = safeJsonParse<unknown>(json, 'TaskManager')
    if (!result.success) {
      throw new Error((result as { success: false; error: string }).error)
    }
    const data = result.data
    type SerializedTask = {
      title: string; description: string; status: string; assignedTo: string
      dependencies?: string[]; files?: string[]
      createdAt?: string; updatedAt?: string
      _history?: Array<{ from: string; to: string; timestamp: string }>
    }
    type TaskManagerData = { projectId: string; tasks: [string, SerializedTask][] }
    if (typeof data !== 'object' || data === null || !('projectId' in data) || typeof (data as TaskManagerData).projectId !== 'string') {
      throw new Error('projectId is required')
    }
    if (!('tasks' in data) || !Array.isArray((data as TaskManagerData).tasks)) {
      throw new Error('tasks must be an array')
    }

    const manager = new TaskManager((data as TaskManagerData).projectId)
    for (const entry of (data as TaskManagerData).tasks) {
      if (!Array.isArray(entry) || entry.length < 2) continue
      const [id, task] = entry
      if (typeof task.title !== 'string' || typeof task.description !== 'string') {
        throw new Error('Task missing required fields: title and description')
      }
      if (!VALID_STATUSES.includes(task.status)) {
        throw new Error(`Invalid task status: ${task.status}`)
      }
      if (!VALID_ROLES.includes(task.assignedTo)) {
        throw new Error(`Invalid agent role: ${task.assignedTo}`)
      }

      const history: TaskTransitionRecord[] = Array.isArray(task._history)
        ? task._history.map(h => ({
            from: h.from as TaskStatus,
            to: h.to as TaskStatus,
            timestamp: new Date(h.timestamp)
          }))
        : []

      manager.tasks.set(id, {
        id,
        title: task.title,
        description: task.description,
        status: task.status as TaskStatus,
        assignedTo: task.assignedTo as AgentRole,
        dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
        files: Array.isArray(task.files) ? task.files : [],
        createdAt: task.createdAt ? new Date(new Date(task.createdAt).getTime()) : new Date(Date.now()),
        updatedAt: task.updatedAt ? new Date(new Date(task.updatedAt).getTime()) : new Date(Date.now()),
        _history: history
      })
    }
    return manager
  }
}

export const taskManager = new TaskManager()
