import { TaskManager, TaskEventHandler, TaskLifecycleEvent, TaskTransitionRecord } from '../manager'
import { TaskStatus, AgentRole } from '../../core/types'

describe('Task Lifecycle Events', () => {
  let tm: TaskManager
  let events: TaskLifecycleEvent[]

  const handler: TaskEventHandler = (event) => {
    events.push(event)
  }

  beforeEach(() => {
    tm = new TaskManager('test-events')
    events = []
  })

  describe('event subscription', () => {
    it('allows subscribing to task events', () => {
      expect(() => tm.on(handler)).not.toThrow()
    })

    it('allows unsubscribing from task events', () => {
      tm.on(handler)
      expect(() => tm.off(handler)).not.toThrow()
    })

    it('supports multiple subscribers', () => {
      const events2: TaskLifecycleEvent[] = []
      const handler2: TaskEventHandler = (event) => events2.push(event)

      tm.on(handler)
      tm.on(handler2)
      tm.createTask('Test', 'desc', 'dev')

      expect(events).toHaveLength(1)
      expect(events2).toHaveLength(1)
    })

    it('stops receiving events after unsubscribe', () => {
      tm.on(handler)
      tm.createTask('First', 'desc', 'dev')

      tm.off(handler)
      tm.createTask('Second', 'desc', 'dev')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('task:created')
    })
  })

  describe('task:created event', () => {
    it('emits when a task is created', () => {
      tm.on(handler)
      const task = tm.createTask('New Task', 'A task description', 'dev')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('task:created')
      expect(events[0].taskId).toBe(task.id)
      expect(events[0].data.title).toBe('New Task')
      expect(events[0].data.status).toBe('pending')
      expect(events[0].data.assignedTo).toBe('dev')
      expect(events[0].timestamp).toBeInstanceOf(Date)
    })
  })

  describe('task:status_changed event', () => {
    it('emits when task status changes', () => {
      tm.on(handler)
      const task = tm.createTask('Task', 'desc', 'dev')
      events.length = 0

      tm.updateTaskStatus(task.id, 'in_progress')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('task:status_changed')
      expect(events[0].taskId).toBe(task.id)
      expect(events[0].data.from).toBe('pending')
      expect(events[0].data.to).toBe('in_progress')
    })

    it('emits for each step in a multi-step transition', () => {
      tm.on(handler)
      const task = tm.createTask('Task', 'desc', 'dev')
      events.length = 0

      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')
      tm.updateTaskStatus(task.id, 'completed')

      expect(events).toHaveLength(3)
      expect(events[0].data.from).toBe('pending')
      expect(events[0].data.to).toBe('in_progress')
      expect(events[1].data.from).toBe('in_progress')
      expect(events[1].data.to).toBe('review')
      expect(events[2].data.from).toBe('review')
      expect(events[2].data.to).toBe('completed')
    })

    it('does NOT emit for idempotent status updates (same status)', () => {
      tm.on(handler)
      const task = tm.createTask('Task', 'desc', 'dev')
      events.length = 0

      tm.updateTaskStatus(task.id, 'pending')

      expect(events).toHaveLength(0)
    })

    it('does not emit for invalid transition attempts', () => {
      tm.on(handler)
      const task = tm.createTask('Task', 'desc', 'dev')
      events.length = 0

      expect(() => tm.updateTaskStatus(task.id, 'completed')).toThrow()
      expect(events).toHaveLength(0)
    })
  })

  describe('task:assigned event', () => {
    it('emits when task is reassigned', () => {
      tm.on(handler)
      const task = tm.createTask('Task', 'desc', 'dev')
      events.length = 0

      tm.assignTask(task.id, 'pm')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('task:assigned')
      expect(events[0].taskId).toBe(task.id)
      expect(events[0].data.from).toBe('dev')
      expect(events[0].data.to).toBe('pm')
    })

    it('does NOT emit when assigning to same agent', () => {
      tm.on(handler)
      const task = tm.createTask('Task', 'desc', 'dev')
      events.length = 0

      tm.assignTask(task.id, 'dev')

      expect(events).toHaveLength(0)
    })
  })

  describe('task:completed event', () => {
    it('emits when task is completed via completeTask()', () => {
      tm.on(handler)
      const task = tm.createTask('Task', 'desc', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')
      events.length = 0

      tm.completeTask(task.id)

      const statusEvents = events.filter(e => e.type === 'task:status_changed')
      expect(statusEvents).toHaveLength(1)
      expect(statusEvents[0].data.from).toBe('review')
      expect(statusEvents[0].data.to).toBe('completed')
    })
  })

  describe('transition history', () => {
    it('records transition history for each task', () => {
      const task = tm.createTask('Task', 'desc', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')

      const history = tm.getTaskHistory(task.id)

      expect(history).toHaveLength(2)
      expect(history[0]).toEqual({
        from: 'pending',
        to: 'in_progress',
        timestamp: expect.any(Date),
      })
      expect(history[1]).toEqual({
        from: 'in_progress',
        to: 'review',
        timestamp: expect.any(Date),
      })
    })

    it('returns empty array for non-existent task', () => {
      expect(tm.getTaskHistory('nonexistent')).toEqual([])
    })

    it('returns empty array for task with no transitions', () => {
      const task = tm.createTask('Task', 'desc', 'dev')
      expect(tm.getTaskHistory(task.id)).toEqual([])
    })

    it('preserves history order chronologically', () => {
      const task = tm.createTask('Task', 'desc', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')
      tm.updateTaskStatus(task.id, 'completed')

      const history = tm.getTaskHistory(task.id)
      expect(history).toHaveLength(5)
      const transitions = history.map(h => `${h.from}->${h.to}`)
      expect(transitions).toEqual([
        'pending->in_progress',
        'in_progress->review',
        'review->in_progress',
        'in_progress->review',
        'review->completed',
      ])
    })
  })

  describe('time in status', () => {
    it('calculates total time spent in a specific status', () => {
      const task = tm.createTask('Task', 'desc', 'dev')
      const created = task.createdAt!

      const fakeNow = new Date(created.getTime() + 5000)
      jest.spyOn(Date, 'now').mockReturnValue(fakeNow.getTime())
      tm.updateTaskStatus(task.id, 'in_progress')

      const fakeNow2 = new Date(created.getTime() + 10000)
      jest.spyOn(Date, 'now').mockReturnValue(fakeNow2.getTime())
      tm.updateTaskStatus(task.id, 'review')

      const timeInPending = tm.getTimeInStatus(task.id, 'pending')
      expect(timeInPending).toBe(5000)

      const timeInProgress = tm.getTimeInStatus(task.id, 'in_progress')
      expect(timeInProgress).toBe(5000)
    })

    it('returns 0 for non-existent task', () => {
      expect(tm.getTimeInStatus('nonexistent', 'pending')).toBe(0)
    })

    it('returns 0 for status never visited', () => {
      const task = tm.createTask('Task', 'desc', 'dev')
      expect(tm.getTimeInStatus(task.id, 'completed')).toBe(0)
    })
  })

  describe('serialization with history', () => {
    it('preserves transition history through toJSON/fromJSON', () => {
      tm.on(handler)
      const task = tm.createTask('Task', 'desc', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')
      tm.updateTaskStatus(task.id, 'completed')

      const json = tm.toJSON()
      const restored = TaskManager.fromJSON(json)

      const history = restored.getTaskHistory(task.id)
      expect(history).toHaveLength(3)
      expect(history[0].from).toBe('pending')
      expect(history[0].to).toBe('in_progress')
      expect(history[2].from).toBe('review')
      expect(history[2].to).toBe('completed')
    })

    it('preserves time tracking through toJSON/fromJSON', () => {
      const task = tm.createTask('Task', 'desc', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')

      const json = tm.toJSON()
      const restored = TaskManager.fromJSON(json)

      const history = restored.getTaskHistory(task.id)
      expect(history).toHaveLength(1)
      expect(history[0].timestamp).toBeInstanceOf(Date)
    })
  })

  describe('clearTasks clears history', () => {
    it('removes all transition histories', () => {
      const task = tm.createTask('Task', 'desc', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')

      expect(tm.getTaskHistory(task.id)).toHaveLength(1)

      tm.clearTasks()

      expect(tm.getTaskHistory(task.id)).toEqual([])
    })
  })

  describe('event handler errors', () => {
    it('does not break task operations when a handler throws', () => {
      const badHandler: TaskEventHandler = () => {
        throw new Error('Handler error')
      }
      const goodEvents: TaskLifecycleEvent[] = []
      const goodHandler: TaskEventHandler = (event) => goodEvents.push(event)

      tm.on(badHandler)
      tm.on(goodHandler)

      expect(() => tm.createTask('Task', 'desc', 'dev')).not.toThrow()
      expect(goodEvents).toHaveLength(1)
    })
  })

  describe('complete workflow event trace', () => {
    it('produces correct event trace for PM->Dev->Review workflow', () => {
      tm.on(handler)

      const task = tm.createTask('Implement feature', 'User login', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')
      tm.updateTaskStatus(task.id, 'completed')

      expect(events.map(e => e.type)).toEqual([
        'task:created',
        'task:status_changed',
        'task:status_changed',
        'task:status_changed',
      ])

      const history = tm.getTaskHistory(task.id)
      expect(history).toHaveLength(3)
    })

    it('produces events for failure and retry workflow', () => {
      tm.on(handler)

      const task = tm.createTask('Fix bug', 'Bug description', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'failed')
      tm.updateTaskStatus(task.id, 'pending')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')
      tm.updateTaskStatus(task.id, 'completed')

      expect(events.filter(e => e.type === 'task:status_changed')).toHaveLength(6)
      expect(tm.getTaskHistory(task.id)).toHaveLength(6)
    })
  })
})
