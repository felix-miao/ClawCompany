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

  it('should resolve slug-based dependencies before title', () => {
    const task1 = makeTask({ id: 'dev-1', title: '创建表单组件', dependencies: [] })
    const task2 = makeTask({ id: 'dev-2', title: '添加表单验证', dependencies: ['create-form-component'] })

    const task1WithSlug = task1 as Task & { slug: string }
    task1WithSlug.slug = 'create-form-component'

    const result = resolveTitleDependencies([task1WithSlug, task2])

    expect(result[1].dependencies).toEqual(['dev-1'])
  })

  it('should resolve slug dependency even when title changes', () => {
    const task1 = makeTask({ id: 'dev-1', title: '旧标题', dependencies: [] })
    const task2 = makeTask({ id: 'dev-2', title: '依赖任务', dependencies: ['create-form-component'] })

    const task1WithSlug = task1 as Task & { slug: string }
    task1WithSlug.slug = 'create-form-component'

    const result = resolveTitleDependencies([task1WithSlug, task2])

    expect(result[1].dependencies).toEqual(['dev-1'])
  })

  it('should fallback to title if slug not found', () => {
    const task1 = makeTask({ id: 'dev-1', title: '表单组件', dependencies: [] })
    const task2 = makeTask({ id: 'dev-2', title: '验证任务', dependencies: ['表单组件'] })

    const task1WithSlug = task1 as Task & { slug: string }
    task1WithSlug.slug = 'some-other-slug'

    const result = resolveTitleDependencies([task1WithSlug, task2])

    expect(result[1].dependencies).toEqual(['dev-1'])
  })

  it('should handle external slug dependency gracefully', () => {
    const task1 = makeTask({ id: 'dev-1', title: '本地任务', dependencies: ['external-slug'] })

    const result = resolveTitleDependencies([task1])

    expect(result[0].dependencies).toEqual(['external-slug'])
  })

  it('should handle undefined slug gracefully', () => {
    const task1 = makeTask({ id: 'dev-1', title: '任务1', dependencies: [] })
    const task2 = makeTask({ id: 'dev-2', title: '任务2', dependencies: ['task-1-slug'] })

    const result = resolveTitleDependencies([task1, task2])

    expect(result[1].dependencies).toEqual(['task-1-slug'])
  })

  it('should log warning for unresolvable dependency', () => {
    const task1 = makeTask({ id: 'dev-1', title: 'Task', dependencies: ['non-existent-dep'] })

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const result = resolveTitleDependencies([task1])

    warnSpy.mockRestore()

    expect(result[0].dependencies).toEqual(['non-existent-dep'])
  })
})
