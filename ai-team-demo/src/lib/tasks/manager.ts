import { Task, TaskStatus, AgentRole } from '../core/types'
import { generateId } from '../utils/id'
import { safeJsonParse } from '../utils/json-parser'
import { TaskStateMachine, InvalidTransitionError } from './state-machine'

export { TaskStateMachine, InvalidTransitionError } from './state-machine'

const VALID_STATUSES: readonly string[] = ['pending', 'in_progress', 'review', 'done', 'completed', 'failed']
const VALID_ROLES: readonly string[] = ['pm', 'dev', 'review']

export class TaskManager {
  private tasks: Map<string, Task> = new Map()
  private projectId: string

  constructor(projectId: string = 'default') {
    this.projectId = projectId
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

    const task: Task = {
      id: generateId('task_'),
      title: trimmedTitle,
      description: trimmedDesc,
      status: 'pending',
      assignedTo,
      dependencies,
      files,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.tasks.set(task.id, task)
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

    task.status = status
    task.updatedAt = new Date()
    this.tasks.set(taskId, task)
    return task
  }

  assignTask(taskId: string, agent: AgentRole): Task | undefined {
    const task = this.tasks.get(taskId)
    if (!task) return undefined

    task.assignedTo = agent
    task.updatedAt = new Date()
    this.tasks.set(taskId, task)
    return task
  }

  completeTask(taskId: string): Task | undefined {
    return this.updateTaskStatus(taskId, 'done')
  }

  getStats(): {
    total: number
    pending: number
    inProgress: number
    review: number
    done: number
    completed: number
    failed: number
  } {
    const tasks = this.getAllTasks()
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      done: tasks.filter(t => t.status === 'done').length,
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
      tasks: Array.from(this.tasks.entries())
    })
  }

  static fromJSON(json: string): TaskManager {
    const result = safeJsonParse<unknown>(json, 'TaskManager')
    if (!result.success) {
      throw new Error(result.error)
    }
    const data = result.data
    type TaskManagerData = { projectId: string; tasks: [string, Partial<Task>][] }
    if (typeof data !== 'object' || data === null || !('projectId' in data) || typeof (data as TaskManagerData).projectId !== 'string') {
      throw new Error('projectId is required')
    }
    if (!('tasks' in data) || !Array.isArray((data as TaskManagerData).tasks)) {
      throw new Error('tasks must be an array')
    }

    const manager = new TaskManager((data as TaskManagerData).projectId)
    for (const entry of (data as TaskManagerData).tasks) {
      if (!Array.isArray(entry) || entry.length < 2) continue
      const [id, task] = entry as [string, Partial<Task> & { title: string; description: string; status: string; assignedTo: string }]
      if (typeof task.title !== 'string' || typeof task.description !== 'string') {
        throw new Error('Task missing required fields: title and description')
      }
      if (!VALID_STATUSES.includes(task.status)) {
        throw new Error(`Invalid task status: ${task.status}`)
      }
      if (!VALID_ROLES.includes(task.assignedTo)) {
        throw new Error(`Invalid agent role: ${task.assignedTo}`)
      }
      manager.tasks.set(id, {
        id,
        ...task,
        status: task.status as TaskStatus,
        assignedTo: task.assignedTo as AgentRole,
        dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
        files: Array.isArray(task.files) ? task.files : [],
        createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date()
      })
    }
    return manager
  }
}

export const taskManager = new TaskManager()
