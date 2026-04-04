import { TaskManager } from '../manager'

describe('TaskManager - typed fromJSON with id handling', () => {
  let tm: TaskManager

  beforeEach(() => {
    tm = new TaskManager('type-test')
  })

  describe('fromJSON - id field type safety', () => {
    it('should produce tasks with non-optional id field', () => {
      tm.createTask('Task A', 'desc a', 'dev')
      tm.createTask('Task B', 'desc b', 'pm', [], ['file.ts'])

      const json = tm.toJSON()
      const restored = TaskManager.fromJSON(json)

      for (const task of restored.getAllTasks()) {
        expect(typeof task.id).toBe('string')
        expect(task.id.length).toBeGreaterThan(0)
        expect(task.id).not.toBeUndefined()
      }
    })

    it('should preserve all required Task fields after deserialization', () => {
      const original = tm.createTask('Full Task', 'A task with all fields', 'dev', [], ['a.ts', 'b.ts'])
      tm.updateTaskStatus(original.id, 'in_progress')
      tm.updateTaskStatus(original.id, 'review')

      const restored = TaskManager.fromJSON(tm.toJSON())
      const task = restored.getTask(original.id)

      expect(task).toBeDefined()
      expect(task!.id).toBe(original.id)
      expect(task!.title).toBe('Full Task')
      expect(task!.description).toBe('A task with all fields')
      expect(task!.status).toBe('review')
      expect(task!.assignedTo).toBe('dev')
      expect(task!.dependencies).toEqual([])
      expect(task!.files).toEqual(['a.ts', 'b.ts'])
      expect(task!.createdAt).toBeInstanceOf(Date)
      expect(task!.updatedAt).toBeInstanceOf(Date)
    })

    it('should handle tasks with dependencies', () => {
      const t1 = tm.createTask('First', 'first task', 'dev')
      const t2 = tm.createTask('Second', 'second task', 'pm', [t1.id])

      const restored = TaskManager.fromJSON(tm.toJSON())
      const restoredT2 = restored.getTask(t2.id)

      expect(restoredT2!.dependencies).toEqual([t1.id])
      expect(restoredT2!.dependencies[0]).toBe(t1.id)
    })

    it('should handle deserialization of tasks in all valid statuses', () => {
      const statuses = ['pending', 'in_progress', 'review', 'done', 'completed', 'failed'] as const

      for (const status of statuses) {
        const localTm = new TaskManager('test')
        const task = localTm.createTask(`${status} task`, `task in ${status}`, 'dev')

        if (status === 'in_progress') {
          localTm.updateTaskStatus(task.id, 'in_progress')
        } else if (status === 'review') {
          localTm.updateTaskStatus(task.id, 'in_progress')
          localTm.updateTaskStatus(task.id, 'review')
        } else if (status === 'done') {
          localTm.updateTaskStatus(task.id, 'in_progress')
          localTm.updateTaskStatus(task.id, 'review')
          localTm.updateTaskStatus(task.id, 'done')
        } else if (status === 'completed') {
          localTm.updateTaskStatus(task.id, 'in_progress')
          localTm.updateTaskStatus(task.id, 'review')
          localTm.updateTaskStatus(task.id, 'completed')
        } else if (status === 'failed') {
          localTm.updateTaskStatus(task.id, 'in_progress')
          localTm.updateTaskStatus(task.id, 'failed')
        }

        const restored = TaskManager.fromJSON(localTm.toJSON())
        const restoredTask = restored.getTask(task.id)

        expect(restoredTask).toBeDefined()
        expect(restoredTask!.id).toBe(task.id)
        expect(restoredTask!.status).toBe(status)
      }
    })

    it('should default createdAt/updatedAt to Date when missing from JSON', () => {
      const rawJson = JSON.stringify({
        projectId: 'test',
        tasks: [[
          'manual-id',
          {
            title: 'Manual Task',
            description: 'A manually constructed task',
            status: 'pending',
            assignedTo: 'dev',
            dependencies: [],
            files: [],
          }
        ]]
      })

      const restored = TaskManager.fromJSON(rawJson)
      const task = restored.getTask('manual-id')

      expect(task).toBeDefined()
      expect(task!.createdAt).toBeInstanceOf(Date)
      expect(task!.updatedAt).toBeInstanceOf(Date)
    })

    it('should ensure every deserialized task satisfies Task interface', () => {
      tm.createTask('T1', 'd1', 'dev')
      tm.createTask('T2', 'd2', 'pm')
      tm.createTask('T3', 'd3', 'review')

      const restored = TaskManager.fromJSON(tm.toJSON())

      for (const task of restored.getAllTasks()) {
        expect(typeof task.id).toBe('string')
        expect(typeof task.title).toBe('string')
        expect(typeof task.description).toBe('string')
        expect(['pending', 'in_progress', 'review', 'done', 'completed', 'failed']).toContain(task.status)
        expect(['pm', 'dev', 'review']).toContain(task.assignedTo)
        expect(Array.isArray(task.dependencies)).toBe(true)
        expect(Array.isArray(task.files)).toBe(true)
      }
    })
  })
})
