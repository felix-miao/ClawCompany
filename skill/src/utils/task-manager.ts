import type { Task } from '../core/types'
import { resolveTaskOrder } from '@ai-team-demo/lib/utils/task-resolver'

export interface TaskManagerConfig {
  tasks: Task[]
}

export class TaskManager {
  private tasks: Map<string, Task>

  constructor(config: TaskManagerConfig) {
    this.tasks = new Map(config.tasks.map(task => [task.id, task]))
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  updateTaskStatus(id: string, status: Task['status']): void {
    const task = this.tasks.get(id)
    if (task) {
      task.status = status
      this.tasks.set(id, task)
    }
  }

  getNextTask(): Task | undefined {
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        const dependenciesMet = task.dependencies.every(depId => {
          const dep = this.tasks.get(depId)
          return dep?.status === 'completed'
        })
        
        if (dependenciesMet) {
          return task
        }
      }
    }
    return undefined
  }

  getExecutableTasks(): Task[] {
    const executable: Task[] = []
    
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        const dependenciesMet = task.dependencies.every(depId => {
          const dep = this.tasks.get(depId)
          return dep?.status === 'completed'
        })
        
        if (dependenciesMet) {
          executable.push(task)
        }
      }
    }
    
    return executable
  }

  isAllCompleted(): boolean {
    for (const task of this.tasks.values()) {
      if (task.status !== 'completed') {
        return false
      }
    }
    return true
  }

  getStats(): {
    total: number
    pending: number
    inProgress: number
    completed: number
    failed: number
  } {
    let pending = 0
    let inProgress = 0
    let completed = 0
    let failed = 0

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'pending':
          pending++
          break
        case 'in_progress':
          inProgress++
          break
        case 'completed':
          completed++
          break
        case 'failed':
          failed++
          break
      }
    }

    return {
      total: this.tasks.size,
      pending,
      inProgress,
      completed,
      failed
    }
  }

  getSortedTasks(): Task[] {
    return resolveTaskOrder(this.getAllTasks())
  }

  toJSON(): string {
    return JSON.stringify(this.getAllTasks(), null, 2)
  }

  static fromJSON(json: string): TaskManager {
    const tasks = JSON.parse(json) as Task[]
    return new TaskManager({ tasks })
  }
}

export function createTaskManager(tasks: Task[]): TaskManager {
  return new TaskManager({ tasks })
}
