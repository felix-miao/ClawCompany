import { Task } from '@/lib/core/types'
import { resolveTaskGraph, DependencyError } from '../task-resolver'

function makeTask(overrides: Partial<Task> & { id: string; title?: string }): Task {
  return {
    title: `Task ${overrides.id}`,
    description: `Description for ${overrides.id}`,
    status: 'pending',
    assignedTo: 'dev',
    dependencies: [],
    files: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('resolveTaskGraph', () => {
  describe('basic functionality', () => {
    it('should return empty sorted and levels for empty input', () => {
      const result = resolveTaskGraph([])
      expect(result.sorted).toEqual([])
      expect(result.levels).toEqual([])
    })

    it('should return single task in sorted and single level', () => {
      const tasks = [makeTask({ id: 't1' })]
      const result = resolveTaskGraph(tasks)

      expect(result.sorted).toHaveLength(1)
      expect(result.sorted[0].id).toBe('t1')
      expect(result.levels).toHaveLength(1)
      expect(result.levels[0]).toEqual(['t1'])
    })

    it('should return all independent tasks in sorted and single level', () => {
      const tasks = [
        makeTask({ id: 't1' }),
        makeTask({ id: 't2' }),
        makeTask({ id: 't3' }),
      ]
      const result = resolveTaskGraph(tasks)

      expect(result.sorted.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
      expect(result.levels).toHaveLength(1)
      expect(result.levels[0]).toHaveLength(3)
    })
  })

  describe('dependency ordering', () => {
    it('should order tasks so dependencies come first in sorted', () => {
      const tasks = [
        makeTask({ id: 't3', title: 'Task 3', dependencies: ['t1', 't2'] }),
        makeTask({ id: 't1', title: 'Task 1' }),
        makeTask({ id: 't2', title: 'Task 2', dependencies: ['t1'] }),
      ]

      const result = resolveTaskGraph(tasks)
      const ids = result.sorted.map((t) => t.id)

      expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t2'))
      expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t3'))
      expect(ids.indexOf('t2')).toBeLessThan(ids.indexOf('t3'))
    })

    it('should handle diamond dependency pattern', () => {
      const tasks = [
        makeTask({ id: 't4', dependencies: ['t2', 't3'] }),
        makeTask({ id: 't3', dependencies: ['t1'] }),
        makeTask({ id: 't1' }),
        makeTask({ id: 't2', dependencies: ['t1'] }),
      ]

      const result = resolveTaskGraph(tasks)
      const ids = result.sorted.map((t) => t.id)

      expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t2'))
      expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t3'))
      expect(ids.indexOf('t2')).toBeLessThan(ids.indexOf('t4'))
      expect(ids.indexOf('t3')).toBeLessThan(ids.indexOf('t4'))
    })
  })

  describe('level grouping', () => {
    it('should separate linear chain into individual levels', () => {
      const tasks = [
        makeTask({ id: 't1' }),
        makeTask({ id: 't2', dependencies: ['t1'] }),
        makeTask({ id: 't3', dependencies: ['t2'] }),
      ]
      const result = resolveTaskGraph(tasks)

      expect(result.levels).toHaveLength(3)
      expect(result.levels[0]).toEqual(['t1'])
      expect(result.levels[1]).toEqual(['t2'])
      expect(result.levels[2]).toEqual(['t3'])
    })

    it('should group independent tasks at the same level', () => {
      const tasks = [
        makeTask({ id: 't1' }),
        makeTask({ id: 't2' }),
        makeTask({ id: 't3', dependencies: ['t1', 't2'] }),
      ]
      const result = resolveTaskGraph(tasks)

      expect(result.levels).toHaveLength(2)
      expect(new Set(result.levels[0])).toEqual(new Set(['t1', 't2']))
      expect(result.levels[1]).toEqual(['t3'])
    })

    it('should handle diamond dependency for level grouping', () => {
      const tasks = [
        makeTask({ id: 'A' }),
        makeTask({ id: 'B', dependencies: ['A'] }),
        makeTask({ id: 'C', dependencies: ['A'] }),
        makeTask({ id: 'D', dependencies: ['B', 'C'] }),
      ]
      const result = resolveTaskGraph(tasks)

      expect(result.levels).toHaveLength(3)
      expect(result.levels[0]).toEqual(['A'])
      expect(new Set(result.levels[1])).toEqual(new Set(['B', 'C']))
      expect(result.levels[2]).toEqual(['D'])
    })

    it('should handle two independent chains', () => {
      const tasks = [
        makeTask({ id: 'a1' }),
        makeTask({ id: 'a2', dependencies: ['a1'] }),
        makeTask({ id: 'b1' }),
        makeTask({ id: 'b2', dependencies: ['b1'] }),
      ]
      const result = resolveTaskGraph(tasks)

      expect(result.levels).toHaveLength(2)
      expect(new Set(result.levels[0])).toEqual(new Set(['a1', 'b1']))
      expect(new Set(result.levels[1])).toEqual(new Set(['a2', 'b2']))
    })

    it('should handle complex multi-level graph', () => {
      const tasks = [
        makeTask({ id: 'A' }),
        makeTask({ id: 'B', dependencies: ['A'] }),
        makeTask({ id: 'C', dependencies: ['A'] }),
        makeTask({ id: 'D', dependencies: ['B'] }),
        makeTask({ id: 'E', dependencies: ['C'] }),
        makeTask({ id: 'F', dependencies: ['D', 'E'] }),
      ]
      const result = resolveTaskGraph(tasks)

      expect(result.levels).toHaveLength(4)
      expect(result.levels[0]).toEqual(['A'])
      expect(new Set(result.levels[1])).toEqual(new Set(['B', 'C']))
      expect(new Set(result.levels[2])).toEqual(new Set(['D', 'E']))
      expect(result.levels[3]).toEqual(['F'])
    })

    it('should preserve original task order within a level', () => {
      const tasks = [
        makeTask({ id: 't3' }),
        makeTask({ id: 't1' }),
        makeTask({ id: 't2' }),
      ]
      const result = resolveTaskGraph(tasks)

      expect(result.levels).toHaveLength(1)
      expect(result.levels[0]).toEqual(['t3', 't1', 't2'])
    })
  })

  describe('error handling', () => {
    it('should throw DependencyError on circular dependency', () => {
      const tasks = [
        makeTask({ id: 't1', dependencies: ['t2'] }),
        makeTask({ id: 't2', dependencies: ['t1'] }),
      ]

      expect(() => resolveTaskGraph(tasks)).toThrow(DependencyError)
    })

    it('should throw DependencyError on missing dependency', () => {
      const tasks = [
        makeTask({ id: 't1', dependencies: ['nonexistent'] }),
      ]

      expect(() => resolveTaskGraph(tasks)).toThrow(DependencyError)
    })

    it('should include cycle and missing dep info in error', () => {
      const tasks = [
        makeTask({ id: 't1', dependencies: ['missing_1', 'missing_2'] }),
      ]

      try {
        resolveTaskGraph(tasks)
        fail('Expected DependencyError')
      } catch (error) {
        expect(error).toBeInstanceOf(DependencyError)
        const depErr = error as DependencyError
        expect(depErr.missingDeps).toContain('missing_1')
        expect(depErr.missingDeps).toContain('missing_2')
      }
    })
  })

  describe('consistency guarantee', () => {
    it('should produce sorted and levels that are consistent with each other', () => {
      const tasks = [
        makeTask({ id: 'A' }),
        makeTask({ id: 'B', dependencies: ['A'] }),
        makeTask({ id: 'C', dependencies: ['A'] }),
        makeTask({ id: 'D', dependencies: ['B'] }),
        makeTask({ id: 'E', dependencies: ['C'] }),
        makeTask({ id: 'F', dependencies: ['D', 'E'] }),
      ]
      const result = resolveTaskGraph(tasks)

      const fromSorted = result.sorted.map((t) => t.id)
      const fromLevels = result.levels.flat()
      expect(new Set(fromSorted)).toEqual(new Set(fromLevels))
      expect(fromSorted.length).toBe(fromLevels.length)
    })

    it('should produce levels that respect dependency ordering', () => {
      const tasks = [
        makeTask({ id: 't1' }),
        makeTask({ id: 't2', dependencies: ['t1'] }),
        makeTask({ id: 't3' }),
        makeTask({ id: 't4', dependencies: ['t2', 't3'] }),
      ]
      const result = resolveTaskGraph(tasks)

      const levelOf = new Map<string, number>()
      result.levels.forEach((level, levelIdx) => {
        for (const id of level) {
          levelOf.set(id, levelIdx)
        }
      })

      for (const task of tasks) {
        for (const dep of task.dependencies) {
          expect(levelOf.get(dep)!).toBeLessThan(levelOf.get(task.id)!)
        }
      }
    })

    it('should compute from a single graph traversal (no double build)', () => {
      const tasks = [
        makeTask({ id: 't1' }),
        makeTask({ id: 't2', dependencies: ['t1'] }),
        makeTask({ id: 't3', dependencies: ['t1'] }),
      ]
      const result = resolveTaskGraph(tasks)

      expect(result.sorted).toHaveLength(3)
      expect(result.levels).toHaveLength(2)
      expect(result.levels[0]).toEqual(['t1'])
      expect(new Set(result.levels[1])).toEqual(new Set(['t2', 't3']))
    })
  })

  describe('real-world patterns', () => {
    it('should handle PM-like workflow', () => {
      const tasks = [
        makeTask({ id: 'dev-2', title: '实现 API 接口', dependencies: ['dev-1'], assignedTo: 'dev' }),
        makeTask({ id: 'dev-1', title: '创建表单组件', assignedTo: 'dev' }),
        makeTask({ id: 'dev-3', title: '添加表单验证', dependencies: ['dev-1'], assignedTo: 'dev' }),
        makeTask({ id: 'dev-4', title: '集成测试', dependencies: ['dev-2', 'dev-3'], assignedTo: 'dev' }),
      ]

      const result = resolveTaskGraph(tasks)
      const ids = result.sorted.map((t) => t.id)

      expect(ids.indexOf('dev-1')).toBeLessThan(ids.indexOf('dev-2'))
      expect(ids.indexOf('dev-1')).toBeLessThan(ids.indexOf('dev-3'))
      expect(ids.indexOf('dev-2')).toBeLessThan(ids.indexOf('dev-4'))
      expect(ids.indexOf('dev-3')).toBeLessThan(ids.indexOf('dev-4'))

      expect(result.levels[0]).toEqual(['dev-1'])
      expect(new Set(result.levels[1])).toEqual(new Set(['dev-2', 'dev-3']))
      expect(result.levels[2]).toEqual(['dev-4'])
    })

    it('should preserve all task properties through the graph', () => {
      const tasks = [
        makeTask({ id: 't2', dependencies: ['t1'], assignedTo: 'dev', files: ['a.ts'] }),
        makeTask({ id: 't1', assignedTo: 'pm' }),
      ]

      const result = resolveTaskGraph(tasks)
      const t1 = result.sorted.find((t) => t.id === 't1')!
      const t2 = result.sorted.find((t) => t.id === 't2')!

      expect(t1.assignedTo).toBe('pm')
      expect(t2.dependencies).toEqual(['t1'])
      expect(t2.files).toEqual(['a.ts'])
    })
  })
})
