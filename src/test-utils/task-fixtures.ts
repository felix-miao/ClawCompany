import type { Task, TaskStatus, AgentRole } from '@/lib/core/types'

export const DEFAULT_TASK_STATUS: TaskStatus = 'pending'

export type TaskWithoutId = Omit<Task, 'id'>

export function createTestTask(data: {
  title: string
  description: string
  assignedTo: AgentRole
}): TaskWithoutId {
  return {
    ...data,
    status: DEFAULT_TASK_STATUS,
    dependencies: [],
    files: [],
  }
}

export function createTestTaskWithStatus(data: {
  title: string
  description: string
  assignedTo: AgentRole
  status: TaskStatus
}): TaskWithoutId {
  return {
    ...data,
    dependencies: [],
    files: [],
  }
}