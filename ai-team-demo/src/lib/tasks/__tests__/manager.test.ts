import { TaskManager } from '../manager'

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
      expect(tm.getTasksByStatus('done')).toHaveLength(0)
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
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(task.createdAt.getTime())
    })

    it('updates updatedAt timestamp', () => {
      const task = tm.createTask('T', 'd', 'dev')
      const originalUpdatedAt = task.updatedAt
      const updated = tm.updateTaskStatus(task.id, 'done')

      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
    })

    it('cycles through all statuses', () => {
      const task = tm.createTask('T', 'd', 'dev')

      tm.updateTaskStatus(task.id, 'in_progress')
      expect(tm.getTask(task.id)!.status).toBe('in_progress')

      tm.updateTaskStatus(task.id, 'review')
      expect(tm.getTask(task.id)!.status).toBe('review')

      tm.updateTaskStatus(task.id, 'done')
      expect(tm.getTask(task.id)!.status).toBe('done')

      tm.updateTaskStatus(task.id, 'pending')
      expect(tm.getTask(task.id)!.status).toBe('pending')
    })

    it('returns undefined for non-existent task', () => {
      expect(tm.updateTaskStatus('nope', 'done')).toBeUndefined()
    })
  })

  describe('assignTask', () => {
    it('reassigns task to another agent', () => {
      const task = tm.createTask('T', 'd', 'dev')
      const updated = tm.assignTask(task.id, 'pm')

      expect(updated!.assignedTo).toBe('pm')
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(task.createdAt.getTime())
    })

    it('returns undefined for non-existent task', () => {
      expect(tm.assignTask('nope', 'dev')).toBeUndefined()
    })
  })

  describe('completeTask', () => {
    it('marks task as done', () => {
      const task = tm.createTask('T', 'd', 'dev')
      const completed = tm.completeTask(task.id)

      expect(completed!.status).toBe('done')
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
        done: 0
      })
    })

    it('computes correct stats across statuses', () => {
      const t1 = tm.createTask('A', 'a', 'dev')
      const t2 = tm.createTask('B', 'b', 'dev')
      const t3 = tm.createTask('C', 'c', 'pm')
      tm.createTask('D', 'd', 'review')

      tm.updateTaskStatus(t1.id, 'in_progress')
      tm.updateTaskStatus(t2.id, 'done')
      tm.updateTaskStatus(t3.id, 'review')

      const stats = tm.getStats()
      expect(stats).toEqual({
        total: 4,
        pending: 1,
        inProgress: 1,
        review: 1,
        done: 1
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
      tm.updateTaskStatus(t2.id, 'done')

      const restored = TaskManager.fromJSON(tm.toJSON())
      expect(restored.getTask(t1.id)!.status).toBe('in_progress')
      expect(restored.getTask(t2.id)!.status).toBe('done')
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

  describe('edge cases', () => {
    it('handles multiple operations on same task', () => {
      const task = tm.createTask('T', 'd', 'dev')

      tm.updateTaskStatus(task.id, 'in_progress')
      tm.assignTask(task.id, 'pm')
      tm.updateTaskStatus(task.id, 'review')
      tm.completeTask(task.id)

      const final = tm.getTask(task.id)!
      expect(final.status).toBe('done')
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
