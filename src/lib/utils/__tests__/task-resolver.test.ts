import { resolveTaskOrder, detectCircularDependencies, DependencyError } from '../task-resolver'

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

describe('resolveTaskOrder', () => {
  it('should return tasks in original order when no dependencies exist', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task 1' }),
      makeTask({ id: 't2', title: 'Task 2' }),
      makeTask({ id: 't3', title: 'Task 3' }),
    ]

    const result = resolveTaskOrder(tasks)

    expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
  })

  it('should order tasks so dependencies come first', () => {
    const tasks = [
      makeTask({ id: 't3', title: 'Task 3', dependencies: ['t1', 't2'] }),
      makeTask({ id: 't1', title: 'Task 1' }),
      makeTask({ id: 't2', title: 'Task 2', dependencies: ['t1'] }),
    ]

    const result = resolveTaskOrder(tasks)
    const ids = result.map((t) => t.id)

    expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t2'))
    expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t3'))
    expect(ids.indexOf('t2')).toBeLessThan(ids.indexOf('t3'))
  })

  it('should handle diamond dependency pattern', () => {
    const tasks = [
      makeTask({ id: 't4', title: 'Task D', dependencies: ['t2', 't3'] }),
      makeTask({ id: 't3', title: 'Task C', dependencies: ['t1'] }),
      makeTask({ id: 't1', title: 'Task A' }),
      makeTask({ id: 't2', title: 'Task B', dependencies: ['t1'] }),
    ]

    const result = resolveTaskOrder(tasks)
    const ids = result.map((t) => t.id)

    expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t2'))
    expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t3'))
    expect(ids.indexOf('t2')).toBeLessThan(ids.indexOf('t4'))
    expect(ids.indexOf('t3')).toBeLessThan(ids.indexOf('t4'))
  })

  it('should return empty array for empty input', () => {
    expect(resolveTaskOrder([])).toEqual([])
  })

  it('should return single task unchanged', () => {
    const tasks = [makeTask({ id: 't1', title: 'Only Task' })]
    const result = resolveTaskOrder(tasks)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })

  it('should preserve all task properties', () => {
    const tasks = [
      makeTask({ id: 't2', title: 'Task 2', dependencies: ['t1'], assignedTo: 'dev', files: ['a.ts'] }),
      makeTask({ id: 't1', title: 'Task 1', assignedTo: 'pm' }),
    ]

    const result = resolveTaskOrder(tasks)
    const t1 = result.find((t) => t.id === 't1')!
    const t2 = result.find((t) => t.id === 't2')!

    expect(t1.assignedTo).toBe('pm')
    expect(t2.dependencies).toEqual(['t1'])
    expect(t2.files).toEqual(['a.ts'])
  })
})

describe('detectCircularDependencies', () => {
  it('should return empty array when no cycles exist', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task 1' }),
      makeTask({ id: 't2', title: 'Task 2', dependencies: ['t1'] }),
    ]

    const cycles = detectCircularDependencies(tasks)
    expect(cycles).toEqual([])
  })

  it('should detect direct circular dependency (A → B → A)', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task 1', dependencies: ['t2'] }),
      makeTask({ id: 't2', title: 'Task 2', dependencies: ['t1'] }),
    ]

    const cycles = detectCircularDependencies(tasks)
    expect(cycles.length).toBeGreaterThan(0)
  })

  it('should detect indirect circular dependency (A → B → C → A)', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task 1', dependencies: ['t3'] }),
      makeTask({ id: 't2', title: 'Task 2', dependencies: ['t1'] }),
      makeTask({ id: 't3', title: 'Task 3', dependencies: ['t2'] }),
    ]

    const cycles = detectCircularDependencies(tasks)
    expect(cycles.length).toBeGreaterThan(0)
  })

  it('should return empty array for empty input', () => {
    expect(detectCircularDependencies([])).toEqual([])
  })

  it('should detect self-dependency', () => {
    const tasks = [makeTask({ id: 't1', title: 'Self', dependencies: ['t1'] })]

    const cycles = detectCircularDependencies(tasks)
    expect(cycles.length).toBeGreaterThan(0)
  })
})

describe('resolveTaskOrder with circular dependencies', () => {
  it('should throw DependencyError on circular dependency', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task 1', dependencies: ['t2'] }),
      makeTask({ id: 't2', title: 'Task 2', dependencies: ['t1'] }),
    ]

    expect(() => resolveTaskOrder(tasks)).toThrow(DependencyError)
  })

  it('should include cycle info in error message', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task 1', dependencies: ['t2'] }),
      makeTask({ id: 't2', title: 'Task 2', dependencies: ['t1'] }),
    ]

    try {
      resolveTaskOrder(tasks)
      fail('Expected DependencyError')
    } catch (error) {
      expect(error).toBeInstanceOf(DependencyError)
      expect((error as DependencyError).cycles.length).toBeGreaterThan(0)
    }
  })
})

describe('resolveTaskOrder with missing dependencies', () => {
  it('should throw DependencyError when dependency references non-existent task', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task 1', dependencies: ['nonexistent'] }),
    ]

    expect(() => resolveTaskOrder(tasks)).toThrow(DependencyError)
  })

  it('should include missing dependency info in error', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task 1', dependencies: ['missing_1', 'missing_2'] }),
    ]

    try {
      resolveTaskOrder(tasks)
      fail('Expected DependencyError')
    } catch (error) {
      expect(error).toBeInstanceOf(DependencyError)
      expect((error as DependencyError).missingDeps).toContain('missing_1')
      expect((error as DependencyError).missingDeps).toContain('missing_2')
    }
  })
})

describe('resolveTaskOrder with mixed independent and dependent tasks', () => {
  it('should handle tasks with some having dependencies and others not', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Independent 1' }),
      makeTask({ id: 't2', title: 'Dependent', dependencies: ['t4'] }),
      makeTask({ id: 't3', title: 'Independent 2' }),
      makeTask({ id: 't4', title: 'Prerequisite' }),
    ]

    const result = resolveTaskOrder(tasks)
    const ids = result.map((t) => t.id)

    expect(ids.indexOf('t4')).toBeLessThan(ids.indexOf('t2'))
    expect(result).toHaveLength(4)
  })

  it('should handle PM-like workflow: pm task + dev tasks with dependencies', () => {
    const tasks = [
      makeTask({ id: 'dev-2', title: '实现 API 接口', dependencies: ['dev-1'], assignedTo: 'dev' }),
      makeTask({ id: 'dev-1', title: '创建表单组件', assignedTo: 'dev' }),
      makeTask({ id: 'dev-3', title: '添加表单验证', dependencies: ['dev-1'], assignedTo: 'dev' }),
      makeTask({
        id: 'dev-4',
        title: '集成测试',
        dependencies: ['dev-2', 'dev-3'],
        assignedTo: 'dev',
      }),
    ]

    const result = resolveTaskOrder(tasks)
    const ids = result.map((t) => t.id)

    expect(ids.indexOf('dev-1')).toBeLessThan(ids.indexOf('dev-2'))
    expect(ids.indexOf('dev-1')).toBeLessThan(ids.indexOf('dev-3'))
    expect(ids.indexOf('dev-2')).toBeLessThan(ids.indexOf('dev-4'))
    expect(ids.indexOf('dev-3')).toBeLessThan(ids.indexOf('dev-4'))
  })
})
