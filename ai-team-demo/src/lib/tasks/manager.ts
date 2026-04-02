import { Task, TaskStatus, AgentRole } from '../core/types'
import { generateId } from '../utils/id'
import { safeJsonParse } from '../utils/json-parser'

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
    const task: Task = {
      id: generateId('task_'),
      title,
      description,
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
  } {
    const tasks = this.getAllTasks()
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      done: tasks.filter(t => t.status === 'done').length
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
    const result = safeJsonParse<{ projectId: string; tasks: [string, Task][] }>(json, 'TaskManager')
    if (!result.success) {
      throw new Error(result.error)
    }
    const manager = new TaskManager(result.data.projectId)
    result.data.tasks.forEach(([id, task]: [string, Task]) => {
      manager.tasks.set(id, {
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt)
      })
    })
    return manager
  }
}

export const taskManager = new TaskManager()
