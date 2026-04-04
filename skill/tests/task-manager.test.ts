import { TaskManager, createTaskManager } from '../src/utils/task-manager'
import type { Task } from '../src/core/types'

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Test Task',
  description: 'A test task',
  assignedTo: 'dev',
  dependencies: [],
  files: [],
  status: 'pending',
  ...overrides,
})

describe('TaskManager', () => {
  let manager: TaskManager

  beforeEach(() => {
    const tasks = [
      createTask({ id: 'task-1', title: 'First' }),
      createTask({ id: 'task-2', title: 'Second', dependencies: ['task-1'] }),
      createTask({ id: 'task-3', title: 'Third', dependencies: ['task-2'] }),
    ]
    manager = new TaskManager({ tasks })
  })

  describe('constructor', () => {
    test('应该初始化任务列表', () => {
      expect(manager.getAllTasks()).toHaveLength(3)
    })

    test('应该处理空任务列表', () => {
      const empty = new TaskManager({ tasks: [] })
      expect(empty.getAllTasks()).toHaveLength(0)
    })
  })

  describe('getTask', () => {
    test('应该返回存在的任务', () => {
      const task = manager.getTask('task-1')
      expect(task).toBeDefined()
      expect(task!.id).toBe('task-1')
    })

    test('应该返回 undefined 对于不存在的任务', () => {
      expect(manager.getTask('nonexistent')).toBeUndefined()
    })
  })

  describe('updateTaskStatus', () => {
    test('应该更新任务状态', () => {
      manager.updateTaskStatus('task-1', 'in_progress')
      expect(manager.getTask('task-1')!.status).toBe('in_progress')
    })

    test('不应该影响不存在的任务', () => {
      manager.updateTaskStatus('nonexistent', 'completed')
      expect(manager.getAllTasks()).toHaveLength(3)
    })
  })

  describe('getNextTask', () => {
    test('应该返回第一个无依赖的 pending 任务', () => {
      const next = manager.getNextTask()
      expect(next).toBeDefined()
      expect(next!.id).toBe('task-1')
    })

    test('应该跳过有未完成依赖的任务', () => {
      manager.updateTaskStatus('task-1', 'in_progress')
      expect(manager.getNextTask()).toBeUndefined()
    })

    test('应该在依赖完成后返回下一个任务', () => {
      manager.updateTaskStatus('task-1', 'completed')
      const next = manager.getNextTask()
      expect(next!.id).toBe('task-2')
    })

    test('应该在没有可执行任务时返回 undefined', () => {
      manager.updateTaskStatus('task-1', 'in_progress')
      manager.updateTaskStatus('task-2', 'in_progress')
      manager.updateTaskStatus('task-3', 'in_progress')
      expect(manager.getNextTask()).toBeUndefined()
    })
  })

  describe('getExecutableTasks', () => {
    test('应该返回所有无未完成依赖的 pending 任务', () => {
      const executable = manager.getExecutableTasks()
      expect(executable).toHaveLength(1)
      expect(executable[0].id).toBe('task-1')
    })

    test('应该在第一个任务完成后返回依赖的任务', () => {
      manager.updateTaskStatus('task-1', 'completed')
      const executable = manager.getExecutableTasks()
      expect(executable).toHaveLength(1)
      expect(executable[0].id).toBe('task-2')
    })

    test('应该返回空数组当没有可执行任务时', () => {
      manager.updateTaskStatus('task-1', 'in_progress')
      expect(manager.getExecutableTasks()).toHaveLength(0)
    })
  })

  describe('isAllCompleted', () => {
    test('应该返回 false 当有未完成任务时', () => {
      expect(manager.isAllCompleted()).toBe(false)
    })

    test('应该返回 true 当所有任务完成时', () => {
      manager.updateTaskStatus('task-1', 'completed')
      manager.updateTaskStatus('task-2', 'completed')
      manager.updateTaskStatus('task-3', 'completed')
      expect(manager.isAllCompleted()).toBe(true)
    })

    test('应该忽略 failed 状态', () => {
      manager.updateTaskStatus('task-1', 'completed')
      manager.updateTaskStatus('task-2', 'failed')
      manager.updateTaskStatus('task-3', 'completed')
      expect(manager.isAllCompleted()).toBe(false)
    })

    test('应该将 done 视为已完成状态', () => {
      manager.updateTaskStatus('task-1', 'done')
      manager.updateTaskStatus('task-2', 'done')
      manager.updateTaskStatus('task-3', 'done')
      expect(manager.isAllCompleted()).toBe(true)
    })

    test('应该将 done 和 completed 混合视为全部完成', () => {
      manager.updateTaskStatus('task-1', 'completed')
      manager.updateTaskStatus('task-2', 'done')
      manager.updateTaskStatus('task-3', 'completed')
      expect(manager.isAllCompleted()).toBe(true)
    })
  })

  describe('getNextTask - done 状态依赖', () => {
    test('应该在依赖为 done 时返回下一个任务', () => {
      manager.updateTaskStatus('task-1', 'done')
      const next = manager.getNextTask()
      expect(next!.id).toBe('task-2')
    })
  })

  describe('getExecutableTasks - done 状态依赖', () => {
    test('应该在依赖为 done 时返回可执行任务', () => {
      manager.updateTaskStatus('task-1', 'done')
      const executable = manager.getExecutableTasks()
      expect(executable).toHaveLength(1)
      expect(executable[0].id).toBe('task-2')
    })
  })

  describe('getStats', () => {
    test('应该返回正确的初始统计', () => {
      const stats = manager.getStats()
      expect(stats).toEqual({
        total: 3,
        pending: 3,
        inProgress: 0,
        completed: 0,
        failed: 0,
      })
    })

    test('应该正确统计各状态', () => {
      manager.updateTaskStatus('task-1', 'in_progress')
      manager.updateTaskStatus('task-2', 'completed')
      manager.updateTaskStatus('task-3', 'failed')

      const stats = manager.getStats()
      expect(stats).toEqual({
        total: 3,
        pending: 0,
        inProgress: 1,
        completed: 1,
        failed: 1,
      })
    })
  })

  describe('getSortedTasks', () => {
    test('应该按依赖顺序排序任务', () => {
      const sorted = manager.getSortedTasks()
      const ids = sorted.map(t => t.id)

      const idx1 = ids.indexOf('task-1')
      const idx2 = ids.indexOf('task-2')
      const idx3 = ids.indexOf('task-3')

      expect(idx1).toBeLessThan(idx2)
      expect(idx2).toBeLessThan(idx3)
    })

    test('应该处理无依赖的任务', () => {
      const noDeps = new TaskManager({
        tasks: [
          createTask({ id: 'a' }),
          createTask({ id: 'b' }),
          createTask({ id: 'c' }),
        ],
      })
      expect(noDeps.getSortedTasks()).toHaveLength(3)
    })
  })

  describe('JSON 序列化/反序列化', () => {
    test('应该正确序列化为 JSON', () => {
      const json = manager.toJSON()
      const parsed = JSON.parse(json)
      expect(parsed).toHaveLength(3)
    })

    test('应该从 JSON 正确反序列化', () => {
      const json = manager.toJSON()
      const restored = TaskManager.fromJSON(json)
      expect(restored.getAllTasks()).toHaveLength(3)
      expect(restored.getTask('task-1')).toBeDefined()
    })
  })

  describe('createTaskManager 辅助函数', () => {
    test('应该创建 TaskManager 实例', () => {
      const tm = createTaskManager([createTask()])
      expect(tm).toBeInstanceOf(TaskManager)
      expect(tm.getAllTasks()).toHaveLength(1)
    })
  })
})
