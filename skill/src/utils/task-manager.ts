/**
 * Task Manager - 任务管理工具
 * 
 * 管理任务状态、依赖关系和执行顺序
 */

import type { Task } from '../core/types'

export interface TaskManagerConfig {
  tasks: Task[]
}

export class TaskManager {
  private tasks: Map<string, Task>

  constructor(config: TaskManagerConfig) {
    this.tasks = new Map(config.tasks.map(task => [task.id, task]))
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 获取任务
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(id: string, status: Task['status']): void {
    const task = this.tasks.get(id)
    if (task) {
      task.status = status
      this.tasks.set(id, task)
    }
  }

  /**
   * 获取下一个可执行的任务
   * (没有未完成的依赖项)
   */
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

  /**
   * 获取所有可执行的任务
   */
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

  /**
   * 检查所有任务是否完成
   */
  isAllCompleted(): boolean {
    for (const task of this.tasks.values()) {
      if (task.status !== 'completed') {
        return false
      }
    }
    return true
  }

  /**
   * 获取任务统计
   */
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

  /**
   * 按依赖顺序排序任务（拓扑排序）
   */
  getSortedTasks(): Task[] {
    const sorted: Task[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (id: string) => {
      if (visited.has(id)) return
      if (visiting.has(id)) {
        // 检测到循环依赖
        console.warn(`⚠ 检测到循环依赖: ${id}`)
        return
      }

      visiting.add(id)
      const task = this.tasks.get(id)
      
      if (task) {
        // 先访问依赖项
        for (const depId of task.dependencies) {
          visit(depId)
        }
        sorted.push(task)
      }

      visiting.delete(id)
      visited.add(id)
    }

    // 访问所有任务
    for (const id of this.tasks.keys()) {
      visit(id)
    }

    return sorted
  }

  /**
   * 导出任务列表（JSON）
   */
  toJSON(): string {
    return JSON.stringify(this.getAllTasks(), null, 2)
  }

  /**
   * 从 JSON 导入任务
   */
  static fromJSON(json: string): TaskManager {
    const tasks = JSON.parse(json) as Task[]
    return new TaskManager({ tasks })
  }
}

/**
 * 便捷函数：创建任务管理器
 */
export function createTaskManager(tasks: Task[]): TaskManager {
  return new TaskManager({ tasks })
}
