import { TaskStatus } from '../core/types'

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['pending', 'in_progress', 'failed'],
  in_progress: ['in_progress', 'pending', 'review', 'failed'],
  review: ['review', 'pending', 'in_progress', 'done', 'completed', 'failed'],
  done: ['done', 'in_progress'],
  completed: ['completed'],
  failed: ['failed', 'pending', 'in_progress'],
}

export interface TransitionResult {
  valid: boolean
  error?: string
}

export class InvalidTransitionError extends Error {
  readonly from: TaskStatus
  readonly to: TaskStatus

  constructor(from: TaskStatus, to: TaskStatus) {
    const allowed = VALID_TRANSITIONS[from].join(', ')
    super(`Invalid task transition: ${from} → ${to}. Allowed: ${allowed}`)
    this.name = 'InvalidTransitionError'
    this.from = from
    this.to = to
  }
}

export class TaskStateMachine {
  static isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
  }

  static validateTransition(from: TaskStatus, to: TaskStatus): TransitionResult {
    if (TaskStateMachine.isValidTransition(from, to)) {
      return { valid: true }
    }
    const allowed = VALID_TRANSITIONS[from]?.join(', ') ?? 'none'
    return {
      valid: false,
      error: `Invalid task transition: ${from} → ${to}. Allowed: ${allowed}`,
    }
  }

  static getValidTransitions(from: TaskStatus): TaskStatus[] {
    return [...(VALID_TRANSITIONS[from] ?? [])]
  }

  static getAllowedTargetStatuses(): TaskStatus[] {
    return Object.keys(VALID_TRANSITIONS) as TaskStatus[]
  }
}
