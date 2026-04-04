import {
  TaskStateMachine,
  InvalidTransitionError,
} from '../state-machine'
import { TaskStatus } from '../../core/types'

describe('TaskStateMachine', () => {
  describe('valid transitions', () => {
    it('allows pending → in_progress', () => {
      expect(TaskStateMachine.isValidTransition('pending', 'in_progress')).toBe(true)
    })

    it('allows pending → failed', () => {
      expect(TaskStateMachine.isValidTransition('pending', 'failed')).toBe(true)
    })

    it('allows in_progress → review', () => {
      expect(TaskStateMachine.isValidTransition('in_progress', 'review')).toBe(true)
    })

    it('allows in_progress → failed', () => {
      expect(TaskStateMachine.isValidTransition('in_progress', 'failed')).toBe(true)
    })

    it('allows in_progress → pending', () => {
      expect(TaskStateMachine.isValidTransition('in_progress', 'pending')).toBe(true)
    })

    it('allows review → completed', () => {
      expect(TaskStateMachine.isValidTransition('review', 'completed')).toBe(true)
    })

    it('allows review → failed', () => {
      expect(TaskStateMachine.isValidTransition('review', 'failed')).toBe(true)
    })

    it('allows review → in_progress', () => {
      expect(TaskStateMachine.isValidTransition('review', 'in_progress')).toBe(true)
    })

    it('allows review → pending', () => {
      expect(TaskStateMachine.isValidTransition('review', 'pending')).toBe(true)
    })

    it('allows completed → in_progress', () => {
      expect(TaskStateMachine.isValidTransition('completed', 'in_progress')).toBe(true)
    })

    it('allows failed → pending', () => {
      expect(TaskStateMachine.isValidTransition('failed', 'pending')).toBe(true)
    })

    it('allows failed → in_progress', () => {
      expect(TaskStateMachine.isValidTransition('failed', 'in_progress')).toBe(true)
    })

    it('allows same status (idempotent)', () => {
      const statuses: TaskStatus[] = ['pending', 'in_progress', 'review', 'completed', 'failed']
      for (const status of statuses) {
        expect(TaskStateMachine.isValidTransition(status, status)).toBe(true)
      }
    })
  })

  describe('invalid transitions', () => {
    it('rejects pending → completed', () => {
      expect(TaskStateMachine.isValidTransition('pending', 'completed')).toBe(false)
    })

    it('rejects pending → review', () => {
      expect(TaskStateMachine.isValidTransition('pending', 'review')).toBe(false)
    })

    it('rejects completed → pending', () => {
      expect(TaskStateMachine.isValidTransition('completed', 'pending')).toBe(false)
    })

    it('rejects completed → review', () => {
      expect(TaskStateMachine.isValidTransition('completed', 'review')).toBe(false)
    })

    it('rejects completed → failed', () => {
      expect(TaskStateMachine.isValidTransition('completed', 'failed')).toBe(false)
    })

    it('rejects in_progress → completed', () => {
      expect(TaskStateMachine.isValidTransition('in_progress', 'completed')).toBe(false)
    })

    it('rejects failed → completed', () => {
      expect(TaskStateMachine.isValidTransition('failed', 'completed')).toBe(false)
    })

    it('rejects failed → review', () => {
      expect(TaskStateMachine.isValidTransition('failed', 'review')).toBe(false)
    })
  })

  describe('validateTransition', () => {
    it('returns success for valid transition', () => {
      const result = TaskStateMachine.validateTransition('pending', 'in_progress')
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns error for invalid transition', () => {
      const result = TaskStateMachine.validateTransition('completed', 'pending')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('completed')
      expect(result.error).toContain('pending')
    })
  })

  describe('getValidTransitions', () => {
    it('returns correct transitions from pending', () => {
      const transitions = TaskStateMachine.getValidTransitions('pending')
      expect(transitions).toContain('in_progress')
      expect(transitions).toContain('failed')
      expect(transitions).toContain('pending')
      expect(transitions).toHaveLength(3)
    })

    it('returns correct transitions from in_progress', () => {
      const transitions = TaskStateMachine.getValidTransitions('in_progress')
      expect(transitions).toContain('review')
      expect(transitions).toContain('failed')
      expect(transitions).toContain('pending')
      expect(transitions).toContain('in_progress')
      expect(transitions).toHaveLength(4)
    })

    it('returns correct transitions from review', () => {
      const transitions = TaskStateMachine.getValidTransitions('review')
      expect(transitions).toContain('completed')
      expect(transitions).toContain('failed')
      expect(transitions).toContain('in_progress')
      expect(transitions).toContain('pending')
      expect(transitions).toContain('review')
      expect(transitions).toHaveLength(5)
    })

    it('returns correct transitions from completed', () => {
      const transitions = TaskStateMachine.getValidTransitions('completed')
      expect(transitions).toContain('in_progress')
      expect(transitions).toContain('completed')
      expect(transitions).toHaveLength(2)
    })

    it('returns correct transitions from failed', () => {
      const transitions = TaskStateMachine.getValidTransitions('failed')
      expect(transitions).toContain('pending')
      expect(transitions).toContain('in_progress')
      expect(transitions).toContain('failed')
      expect(transitions).toHaveLength(3)
    })
  })

  describe('InvalidTransitionError', () => {
    it('creates error with from and to status', () => {
      const error = new InvalidTransitionError('completed', 'pending')
      expect(error.message).toContain('completed')
      expect(error.message).toContain('pending')
      expect(error.from).toBe('completed')
      expect(error.to).toBe('pending')
      expect(error.name).toBe('InvalidTransitionError')
    })

    it('lists valid transitions in error message', () => {
      const error = new InvalidTransitionError('completed', 'pending')
      expect(error.message).toContain('in_progress')
    })

    it('is instanceof Error', () => {
      const error = new InvalidTransitionError('pending', 'completed')
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('typical workflow', () => {
    it('supports happy path: pending → in_progress → review → completed', () => {
      const path: TaskStatus[] = ['pending', 'in_progress', 'review', 'completed']
      for (let i = 0; i < path.length - 1; i++) {
        expect(TaskStateMachine.isValidTransition(path[i], path[i + 1])).toBe(true)
      }
    })

    it('supports review failure path: pending → in_progress → review → in_progress → review → completed', () => {
      const path: TaskStatus[] = ['pending', 'in_progress', 'review', 'in_progress', 'review', 'completed']
      for (let i = 0; i < path.length - 1; i++) {
        expect(TaskStateMachine.isValidTransition(path[i], path[i + 1])).toBe(true)
      }
    })

    it('supports failure path: pending → in_progress → failed → pending → in_progress → review → completed', () => {
      const path: TaskStatus[] = ['pending', 'in_progress', 'failed', 'pending', 'in_progress', 'review', 'completed']
      for (let i = 0; i < path.length - 1; i++) {
        expect(TaskStateMachine.isValidTransition(path[i], path[i + 1])).toBe(true)
      }
    })

    it('supports reopen path: pending → in_progress → review → completed → in_progress', () => {
      const path: TaskStatus[] = ['pending', 'in_progress', 'review', 'completed', 'in_progress']
      for (let i = 0; i < path.length - 1; i++) {
        expect(TaskStateMachine.isValidTransition(path[i], path[i + 1])).toBe(true)
      }
    })

    it('blocks skipping steps: pending → completed is invalid', () => {
      expect(TaskStateMachine.isValidTransition('pending', 'completed')).toBe(false)
    })
  })

  describe('getAllowedTargetStatuses', () => {
    it('returns all statuses in the system', () => {
      const statuses = TaskStateMachine.getAllowedTargetStatuses()
      expect(statuses).toContain('pending')
      expect(statuses).toContain('in_progress')
      expect(statuses).toContain('review')
      expect(statuses).toContain('completed')
      expect(statuses).toContain('failed')
    })
  })
})
