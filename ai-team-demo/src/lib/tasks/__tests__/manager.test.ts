import { TaskManager } from '../manager'
import { InvalidTransitionError } from '../state-machine'

describe('TaskManager', () => {
  let tm: TaskManager

  beforeEach(() => {
    tm = new TaskManager('test-project')
  })

  describe('constructor', () => {
    it('uses provided projectId', () => {
      const manager = new TaskManager('my-project')
      const json = JSON.parse(manager.toJSON())
      expect(json.projectId).toBe('my-project')
    })

    it('defaults to "default" projectId', () => {
      const manager = new TaskManager()
      const json = JSON.parse(manager.toJSON())
      expect(json.projectId).toBe('default')
    })
  })

  describe('createTask', () => {
    it('creates a task with required fields', () => {
      const task = tm.createTask('Fix bug', 'Fix the login bug', 'dev')

      expect(task.id).toMatch(/^task_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(task.title).toBe('Fix bug')
      expect(task.description).toBe('Fix the login bug')
      expect(task.status).toBe('pending')
      expect(task.assignedTo).toBe('dev')
      expect(task.dependencies).toEqual([])
      expect(task.files).toEqual([])
      expect(task.createdAt).toBeInstanceOf(Date)
      expect(task.updatedAt).toBeInstanceOf(Date)
    })

    it('creates a task with dependencies and files', () => {
      const dep = tm.createTask('Setup', 'Setup project', 'dev')
      const task = tm.createTask('Feature', 'Add feature', 'dev', [dep.id], ['src/foo.ts'])

      expect(task.dependencies).toEqual([dep.id])
      expect(task.files).toEqual(['src/foo.ts'])
    })

    it('stores the task internally', () => {
      const task = tm.createTask('Test', 'Test task', 'pm')
      expect(tm.getTask(task.id)).toBe(task)
    })

    it('generates unique IDs', () => {
      const t1 = tm.createTask('A', 'a', 'dev')
      const t2 = tm.createTask('B', 'b', 'dev')
      expect(t1.id).not.toBe(t2.id)
    })
  })

  describe('getTask', () => {
    it('returns task by id', () => {
      const task = tm.createTask('Find me', 'desc', 'dev')
      expect(tm.getTask(task.id)).toEqual(task)
    })

    it('returns undefined for non-existent id', () => {
      expect(tm.getTask('nonexistent')).toBeUndefined()
    })
  })

  describe('getAllTasks', () => {
    it('returns empty array when no tasks', () => {
      expect(tm.getAllTasks()).toEqual([])
    })

    it('returns all created tasks', () => {
      const t1 = tm.createTask('A', 'a', 'dev')
      const t2 = tm.createTask('B', 'b', 'pm')
      const all = tm.getAllTasks()
      expect(all).toHaveLength(2)
      expect(all).toContainEqual(t1)
      expect(all).toContainEqual(t2)
    })
  })

  describe('getTasksByStatus', () => {
    beforeEach(() => {
      tm.createTask('T1', 'd1', 'dev')
      tm.createTask('T2', 'd2', 'dev')
    })

    it('filters by pending status', () => {
      expect(tm.getTasksByStatus('pending')).toHaveLength(2)
    })

    it('filters by in_progress status', () => {
      const tasks = tm.getAllTasks()
      tm.updateTaskStatus(tasks[0].id, 'in_progress')
      expect(tm.getTasksByStatus('in_progress')).toHaveLength(1)
      expect(tm.getTasksByStatus('pending')).toHaveLength(1)
    })

    it('returns empty for status with no tasks', () => {
      expect(tm.getTasksByStatus('completed')).toHaveLength(0)
    })
  })

  describe('getTasksByAgent', () => {
    beforeEach(() => {
      tm.createTask('Dev task', 'd', 'dev')
      tm.createTask('PM task', 'd', 'pm')
      tm.createTask('Dev task 2', 'd', 'dev')
    })

    it('returns tasks for specific agent role', () => {
      expect(tm.getTasksByAgent('dev')).toHaveLength(2)
      expect(tm.getTasksByAgent('pm')).toHaveLength(1)
    })

    it('returns empty for role with no tasks', () => {
      expect(tm.getTasksByAgent('review')).toHaveLength(0)
    })
  })

  describe('updateTaskStatus', () => {
    it('updates status of existing task', () => {
      const task = tm.createTask('T', 'd', 'dev')
      const updated = tm.updateTaskStatus(task.id, 'in_progress')

      expect(updated!.status).toBe('in_progress')
      expect(updated!.updatedAt!.getTime()).toBeGreaterThanOrEqual(task.createdAt!.getTime())
    })

    it('updates updatedAt timestamp', () => {
      const task = tm.createTask('T', 'd', 'dev')
      const originalUpdatedAt = task.updatedAt
      tm.updateTaskStatus(task.id, 'in_progress')

      const updated = tm.updateTaskStatus(task.id, 'review')
      expect(updated!.updatedAt!.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt!.getTime())
    })

    it('cycles through valid statuses', () => {
      const task = tm.createTask('T', 'd', 'dev')

      tm.updateTaskStatus(task.id, 'in_progress')
      expect(tm.getTask(task.id)!.status).toBe('in_progress')

      tm.updateTaskStatus(task.id, 'review')
      expect(tm.getTask(task.id)!.status).toBe('review')

      tm.updateTaskStatus(task.id, 'completed')
      expect(tm.getTask(task.id)!.status).toBe('completed')

      tm.updateTaskStatus(task.id, 'in_progress')
      expect(tm.getTask(task.id)!.status).toBe('in_progress')
    })

    it('returns undefined for non-existent task', () => {
      expect(tm.updateTaskStatus('nope', 'completed')).toBeUndefined()
    })

    it('throws InvalidTransitionError for invalid transition', () => {
      const task = tm.createTask('T', 'd', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')
      tm.updateTaskStatus(task.id, 'completed')

      expect(() => tm.updateTaskStatus(task.id, 'pending')).toThrow(InvalidTransitionError)
    })

    it('throws InvalidTransitionError for pending → completed', () => {
      const task = tm.createTask('T', 'd', 'dev')

      expect(() => tm.updateTaskStatus(task.id, 'completed')).toThrow(InvalidTransitionError)
    })

    it('allows idempotent status update', () => {
      const task = tm.createTask('T', 'd', 'dev')
      const updated = tm.updateTaskStatus(task.id, 'pending')
      expect(updated!.status).toBe('pending')
    })
  })

  describe('assignTask', () => {
    it('reassigns task to another agent', () => {
      const task = tm.createTask('T', 'd', 'dev')
      const updated = tm.assignTask(task.id, 'pm')

      expect(updated!.assignedTo).toBe('pm')
      expect(updated!.updatedAt!.getTime()).toBeGreaterThanOrEqual(task.createdAt!.getTime())
    })

    it('returns undefined for non-existent task', () => {
      expect(tm.assignTask('nope', 'dev')).toBeUndefined()
    })
  })

  describe('completeTask', () => {
    it('marks task as completed', () => {
      const task = tm.createTask('T', 'd', 'dev')
      tm.updateTaskStatus(task.id, 'in_progress')
      tm.updateTaskStatus(task.id, 'review')
      const completed = tm.completeTask(task.id)

      expect(completed!.status).toBe('completed')
    })

    it('returns undefined for non-existent task', () => {
      expect(tm.completeTask('nope')).toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('returns zeros when no tasks', () => {
      expect(tm.getStats()).toEqual({
        total: 0,
        pending: 0,
        inProgress: 0,
        review: 0,
        completed: 0,
        failed: 0
      })
    })

    it('computes correct stats across statuses', () => {
      const t1 = tm.createTask('A', 'a', 'dev')
      const t2 = tm.createTask('B', 'b', 'dev')
      const t3 = tm.createTask('C', 'c', 'pm')
      tm.createTask('D', 'd', 'review')

      tm.updateTaskStatus(t1.id, 'in_progress')
      tm.updateTaskStatus(t2.id, 'in_progress')
      tm.updateTaskStatus(t2.id, 'review')
      tm.updateTaskStatus(t2.id, 'completed')
      tm.updateTaskStatus(t3.id, 'in_progress')
      tm.updateTaskStatus(t3.id, 'review')

      const stats = tm.getStats()
      expect(stats).toEqual({
        total: 4,
        pending: 1,
        inProgress: 1,
        review: 1,
        completed: 1,
        failed: 0
      })
    })
  })

  describe('clearTasks', () => {
    it('removes all tasks', () => {
      tm.createTask('A', 'a', 'dev')
      tm.createTask('B', 'b', 'pm')
      tm.clearTasks()

      expect(tm.getAllTasks()).toEqual([])
      expect(tm.getStats().total).toBe(0)
    })
  })

  describe('toJSON / fromJSON', () => {
    it('serializes and deserializes correctly', () => {
      tm.createTask('Task 1', 'desc 1', 'dev', [], ['a.ts'])
      tm.createTask('Task 2', 'desc 2', 'pm', ['dep1'])

      const json = tm.toJSON()
      const restored = TaskManager.fromJSON(json)

      expect(restored.getAllTasks()).toHaveLength(2)
      expect(restored.getStats().total).toBe(2)

      const tasks = restored.getAllTasks()
      expect(tasks[0].title).toBe('Task 1')
      expect(tasks[0].files).toEqual(['a.ts'])
      expect(tasks[0].createdAt).toBeInstanceOf(Date)
      expect(tasks[0].updatedAt).toBeInstanceOf(Date)
    })

    it('preserves projectId', () => {
      const original = new TaskManager('special-project')
      original.createTask('T', 'd', 'dev')

      const restored = TaskManager.fromJSON(original.toJSON())
      const data = JSON.parse(restored.toJSON())
      expect(data.projectId).toBe('special-project')
    })

    it('preserves task statuses', () => {
      const t1 = tm.createTask('A', 'a', 'dev')
      const t2 = tm.createTask('B', 'b', 'pm')
      tm.updateTaskStatus(t1.id, 'in_progress')
      tm.updateTaskStatus(t2.id, 'in_progress')
      tm.updateTaskStatus(t2.id, 'review')
      tm.updateTaskStatus(t2.id, 'completed')

      const restored = TaskManager.fromJSON(tm.toJSON())
      expect(restored.getTask(t1.id)!.status).toBe('in_progress')
      expect(restored.getTask(t2.id)!.status).toBe('completed')
    })

    it('preserves assignments and dependencies', () => {
      const t1 = tm.createTask('A', 'a', 'dev')
      const t2 = tm.createTask('B', 'b', 'pm', [t1.id], ['src/x.ts'])
      tm.assignTask(t1.id, 'review')

      const restored = TaskManager.fromJSON(tm.toJSON())
      expect(restored.getTask(t2.id)!.dependencies).toEqual([t1.id])
      expect(restored.getTask(t2.id)!.files).toEqual(['src/x.ts'])
      expect(restored.getTask(t1.id)!.assignedTo).toBe('review')
    })

    it('handles empty manager', () => {
      const empty = new TaskManager('empty')
      const restored = TaskManager.fromJSON(empty.toJSON())
      expect(restored.getAllTasks()).toEqual([])
    })
  })

  describe('getStats includes completed and failed', () => {
    it('counts completed tasks', () => {
      const t1 = tm.createTask('A', 'a', 'dev')
      tm.updateTaskStatus(t1.id, 'in_progress')
      tm.updateTaskStatus(t1.id, 'review')
      tm.updateTaskStatus(t1.id, 'completed')

      const stats = tm.getStats()
      expect(stats.completed).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('counts failed tasks', () => {
      const t1 = tm.createTask('A', 'a', 'dev')
      tm.updateTaskStatus(t1.id, 'in_progress')
      tm.updateTaskStatus(t1.id, 'failed')

      const stats = tm.getStats()
      expect(stats.failed).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('counts mixed statuses including completed and failed', () => {
      const t1 = tm.createTask('A', 'a', 'dev')
      const t2 = tm.createTask('B', 'b', 'dev')
      const t3 = tm.createTask('C', 'c', 'dev')
      const t4 = tm.createTask('D', 'd', 'dev')
      const t5 = tm.createTask('E', 'e', 'dev')
      const _t6 = tm.createTask('F', 'f', 'dev')

      tm.updateTaskStatus(t1.id, 'in_progress')
      tm.updateTaskStatus(t2.id, 'in_progress')
      tm.updateTaskStatus(t2.id, 'review')
      tm.updateTaskStatus(t3.id, 'in_progress')
      tm.updateTaskStatus(t3.id, 'review')
      tm.updateTaskStatus(t3.id, 'completed')
      tm.updateTaskStatus(t4.id, 'in_progress')
      tm.updateTaskStatus(t4.id, 'failed')
      tm.updateTaskStatus(t5.id, 'in_progress')
      tm.updateTaskStatus(t5.id, 'review')
      tm.updateTaskStatus(t5.id, 'completed')

      const stats = tm.getStats()
      expect(stats).toEqual({
        total: 6,
        pending: 1,
        inProgress: 1,
        review: 1,
        completed: 2,
        failed: 1,
      })
    })

    it('returns zeros for completed and failed when none exist', () => {
      tm.createTask('A', 'a', 'dev')
      const stats = tm.getStats()
      expect(stats.completed).toBe(0)
      expect(stats.failed).toBe(0)
    })
  })

  describe('createTask validation', () => {
    it('throws on empty title', () => {
      expect(() => tm.createTask('', 'desc', 'dev')).toThrow('title is required')
    })

    it('throws on whitespace-only title', () => {
      expect(() => tm.createTask('   ', 'desc', 'dev')).toThrow('title is required')
    })

    it('throws on empty description', () => {
      expect(() => tm.createTask('Title', '', 'dev')).toThrow('description is required')
    })

    it('throws on invalid agent role', () => {
      expect(() => tm.createTask('Title', 'desc', 'invalid' as unknown as import('@/lib/core/types').AgentRole)).toThrow('Invalid agent role')
    })

    it('accepts tester role without throwing', () => {
      const task = tm.createTask('Test task', 'Write unit tests', 'tester')
      expect(task.assignedTo).toBe('tester')
      expect(task.status).toBe('pending')
    })

    it('can reassign task to tester role', () => {
      const task = tm.createTask('T', 'd', 'dev')
      const updated = tm.assignTask(task.id, 'tester')
      expect(updated!.assignedTo).toBe('tester')
    })

    it('getTasksByAgent returns tester tasks', () => {
      tm.createTask('Test A', 'Test feature A', 'tester')
      tm.createTask('Test B', 'Test feature B', 'tester')
      tm.createTask('Dev task', 'Implement feature', 'dev')

      expect(tm.getTasksByAgent('tester')).toHaveLength(2)
      expect(tm.getTasksByAgent('dev')).toHaveLength(1)
    })

    it('serializes and deserializes tester-assigned tasks', () => {
      tm.createTask('Test task', 'Test everything', 'tester')
      const json = tm.toJSON()
      const restored = TaskManager.fromJSON(json)

      const tasks = restored.getAllTasks()
      expect(tasks).toHaveLength(1)
      expect(tasks[0].assignedTo).toBe('tester')
    })

    it('throws on self-referencing dependency', () => {
      const task = tm.createTask('A', 'a', 'dev')
      expect(() => tm.createTask('B', 'b', 'dev', [task.id], [])).not.toThrow()
    })

    it('trims title whitespace', () => {
      const task = tm.createTask('  Valid Title  ', 'desc', 'dev')
      expect(task.title).toBe('Valid Title')
    })
  })

  describe('fromJSON validation', () => {
    it('throws on invalid JSON', () => {
      expect(() => TaskManager.fromJSON('not json')).toThrow()
    })

    it('throws when projectId is missing', () => {
      const json = JSON.stringify({ tasks: [] })
      expect(() => TaskManager.fromJSON(json)).toThrow('projectId is required')
    })

    it('throws when tasks is not an array', () => {
      const json = JSON.stringify({ projectId: 'test', tasks: 'invalid' })
      expect(() => TaskManager.fromJSON(json)).toThrow('tasks must be an array')
    })

    it('throws when a task has invalid status', () => {
      const badTask = {
        id: 't1', title: 'T', description: 'd',
        status: 'invalid_status', assignedTo: 'dev',
        dependencies: [], files: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      const json = JSON.stringify({ projectId: 'test', tasks: [['t1', badTask]] })
      expect(() => TaskManager.fromJSON(json)).toThrow('Invalid task status')
    })

    it('throws when a task has invalid agent role', () => {
      const badTask = {
        id: 't1', title: 'T', description: 'd',
        status: 'pending', assignedTo: 'invalid_role',
        dependencies: [], files: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      const json = JSON.stringify({ projectId: 'test', tasks: [['t1', badTask]] })
      expect(() => TaskManager.fromJSON(json)).toThrow('Invalid agent role')
    })

    it('throws when a task is missing required fields', () => {
      const badTask = { id: 't1' }
      const json = JSON.stringify({ projectId: 'test', tasks: [['t1', badTask]] })
      expect(() => TaskManager.fromJSON(json)).toThrow()
    })

    it('handles valid JSON with all status types', () => {
      const tasks = [
        ['t1', {
          id: 't1', title: 'A', description: 'a', status: 'pending',
          assignedTo: 'dev', dependencies: [], files: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }],
        ['t2', {
          id: 't2', title: 'B', description: 'b', status: 'completed',
          assignedTo: 'pm', dependencies: [], files: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }],
        ['t3', {
          id: 't3', title: 'C', description: 'c', status: 'failed',
          assignedTo: 'review', dependencies: ['t1'], files: ['x.ts'],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }],
      ]
      const json = JSON.stringify({ projectId: 'test', tasks })
      const restored = TaskManager.fromJSON(json)
      expect(restored.getAllTasks()).toHaveLength(3)
      expect(restored.getTask('t3')!.status).toBe('failed')
      expect(restored.getTask('t3')!.dependencies).toEqual(['t1'])
    })
  })

  describe('edge cases', () => {
    it('handles multiple operations on same task', () => {
      const task = tm.createTask('T', 'd', 'dev')

      tm.updateTaskStatus(task.id, 'in_progress')
      tm.assignTask(task.id, 'pm')
      tm.updateTaskStatus(task.id, 'review')
      tm.completeTask(task.id)

      const final = tm.getTask(task.id)!
      expect(final.status).toBe('completed')
      expect(final.assignedTo).toBe('pm')
    })

    it('does not mutate returned task arrays', () => {
      tm.createTask('T', 'd', 'dev')
      const all = tm.getAllTasks()
      all.pop()
      expect(tm.getAllTasks()).toHaveLength(1)
    })

    it('getStats reflects real-time state', () => {
      const t = tm.createTask('T', 'd', 'dev')
      expect(tm.getStats().pending).toBe(1)

      tm.updateTaskStatus(t.id, 'in_progress')
      expect(tm.getStats().pending).toBe(0)
      expect(tm.getStats().inProgress).toBe(1)
    })
  })
})
