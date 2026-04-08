import { resolveTitleDependencies } from '../resolve-title-deps'

import { Task } from '@/lib/core/types'

function makeTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    description: overrides.title,
    status: 'pending',
    assignedTo: 'dev',
    dependencies: [],
    files: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('resolveTitleDependencies', () => {
  it('should resolve title-based dependencies to task IDs', () => {
    const task1 = makeTask({ id: 'dev-1', title: '创建表单组件' })
    const task2 = makeTask({ id: 'dev-2', title: '添加表单验证', dependencies: ['创建表单组件'] })
    const task3 = makeTask({ id: 'dev-3', title: '集成测试', dependencies: ['创建表单组件', '添加表单验证'] })

    const result = resolveTitleDependencies([task1, task2, task3])

    expect(result[0].dependencies).toEqual([])
    expect(result[1].dependencies).toEqual(['dev-1'])
    expect(result[2].dependencies).toEqual(['dev-1', 'dev-2'])
  })

  it('should preserve already-valid ID-based dependencies', () => {
    const task1 = makeTask({ id: 'dev-1', title: 'Task A' })
    const task2 = makeTask({ id: 'dev-2', title: 'Task B', dependencies: ['dev-1'] })

    const result = resolveTitleDependencies([task1, task2])

    expect(result[1].dependencies).toEqual(['dev-1'])
  })

  it('should handle mixed title and ID dependencies', () => {
    const task1 = makeTask({ id: 'dev-1', title: 'Setup DB' })
    const task2 = makeTask({ id: 'dev-2', title: 'Create API', dependencies: ['dev-1'] })
    const task3 = makeTask({ id: 'dev-3', title: 'Write Tests', dependencies: ['Setup DB', 'dev-2'] })

    const result = resolveTitleDependencies([task1, task2, task3])

    expect(result[2].dependencies).toEqual(['dev-1', 'dev-2'])
  })

  it('should leave external dependencies unchanged', () => {
    const task1 = makeTask({ id: 'dev-1', title: 'Task', dependencies: ['external-dep'] })

    const result = resolveTitleDependencies([task1])

    expect(result[0].dependencies).toEqual(['external-dep'])
  })

  it('should handle empty task list', () => {
    const result = resolveTitleDependencies([])
    expect(result).toEqual([])
  })

  it('should handle tasks with no dependencies', () => {
    const task1 = makeTask({ id: 'dev-1', title: 'Independent' })

    const result = resolveTitleDependencies([task1])

    expect(result[0].dependencies).toEqual([])
  })

  it('should handle duplicate titles by matching first occurrence', () => {
    const task1 = makeTask({ id: 'dev-1', title: '同名任务' })
    const task2 = makeTask({ id: 'dev-2', title: '同名任务' })
    const task3 = makeTask({ id: 'dev-3', title: '依赖任务', dependencies: ['同名任务'] })

    const result = resolveTitleDependencies([task1, task2, task3])

    expect(result[2].dependencies).toEqual(['dev-1'])
  })

  it('should not mutate the original tasks', () => {
    const task1 = makeTask({ id: 'dev-1', title: 'Base' })
    const task2 = makeTask({ id: 'dev-2', title: 'Dependent', dependencies: ['Base'] })

    resolveTitleDependencies([task1, task2])

    expect(task2.dependencies).toEqual(['Base'])
  })

  it('should handle self-referencing title dependency', () => {
    const task1 = makeTask({ id: 'dev-1', title: 'Self', dependencies: ['Self'] })

    const result = resolveTitleDependencies([task1])

    expect(result[0].dependencies).toEqual(['dev-1'])
  })

  it('should handle complex PM-like workflow', () => {
    const tasks = [
      makeTask({ id: 'dev-1', title: '创建表单组件', dependencies: [] }),
      makeTask({ id: 'dev-2', title: '添加表单验证', dependencies: ['创建表单组件'] }),
      makeTask({ id: 'dev-3', title: '实现 API 接口', dependencies: [] }),
      makeTask({ id: 'dev-4', title: '编写测试用例', dependencies: ['创建表单组件', '实现 API 接口'] }),
    ]

    const result = resolveTitleDependencies(tasks)

    expect(result[0].dependencies).toEqual([])
    expect(result[1].dependencies).toEqual(['dev-1'])
    expect(result[2].dependencies).toEqual([])
    expect(result[3].dependencies).toEqual(['dev-1', 'dev-3'])
  })
})
