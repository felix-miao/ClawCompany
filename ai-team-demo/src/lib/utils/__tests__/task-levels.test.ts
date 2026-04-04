import { Task } from '@/lib/core/types'
import { groupTasksByLevels } from '../task-levels'

function makeTask(overrides: Partial<Task> & { id: string }): Task {
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

describe('groupTasksByLevels', () => {
  it('should return empty array for empty input', () => {
    expect(groupTasksByLevels([])).toEqual([])
  })

  it('should return single level for single task with no deps', () => {
    const tasks = [makeTask({ id: 't1', dependencies: [] })]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(1)
    expect(levels[0]).toEqual(['t1'])
  })

  it('should return single level for multiple independent tasks', () => {
    const tasks = [
      makeTask({ id: 't1', dependencies: [] }),
      makeTask({ id: 't2', dependencies: [] }),
      makeTask({ id: 't3', dependencies: [] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(1)
    expect(levels[0]).toHaveLength(3)
    expect(new Set(levels[0])).toEqual(new Set(['t1', 't2', 't3']))
  })

  it('should separate tasks into two levels for linear chain', () => {
    const tasks = [
      makeTask({ id: 't1', dependencies: [] }),
      makeTask({ id: 't2', dependencies: ['t1'] }),
      makeTask({ id: 't3', dependencies: ['t2'] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(3)
    expect(levels[0]).toEqual(['t1'])
    expect(levels[1]).toEqual(['t2'])
    expect(levels[2]).toEqual(['t3'])
  })

  it('should group independent tasks at same level', () => {
    const tasks = [
      makeTask({ id: 't1', dependencies: [] }),
      makeTask({ id: 't2', dependencies: [] }),
      makeTask({ id: 't3', dependencies: ['t1', 't2'] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(2)
    expect(new Set(levels[0])).toEqual(new Set(['t1', 't2']))
    expect(levels[1]).toEqual(['t3'])
  })

  it('should handle diamond dependency pattern', () => {
    const tasks = [
      makeTask({ id: 'A', dependencies: [] }),
      makeTask({ id: 'B', dependencies: ['A'] }),
      makeTask({ id: 'C', dependencies: ['A'] }),
      makeTask({ id: 'D', dependencies: ['B', 'C'] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(3)
    expect(levels[0]).toEqual(['A'])
    expect(new Set(levels[1])).toEqual(new Set(['B', 'C']))
    expect(levels[2]).toEqual(['D'])
  })

  it('should handle wide dependency (one task depends on many)', () => {
    const tasks = [
      makeTask({ id: 't1', dependencies: [] }),
      makeTask({ id: 't2', dependencies: [] }),
      makeTask({ id: 't3', dependencies: [] }),
      makeTask({ id: 't4', dependencies: ['t1', 't2', 't3'] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(2)
    expect(new Set(levels[0])).toEqual(new Set(['t1', 't2', 't3']))
    expect(levels[1]).toEqual(['t4'])
  })

  it('should handle two independent chains', () => {
    const tasks = [
      makeTask({ id: 'a1', dependencies: [] }),
      makeTask({ id: 'a2', dependencies: ['a1'] }),
      makeTask({ id: 'b1', dependencies: [] }),
      makeTask({ id: 'b2', dependencies: ['b1'] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(2)
    expect(new Set(levels[0])).toEqual(new Set(['a1', 'b1']))
    expect(new Set(levels[1])).toEqual(new Set(['a2', 'b2']))
  })

  it('should ignore unknown dependencies', () => {
    const tasks = [
      makeTask({ id: 't1', dependencies: ['unknown-dep'] }),
      makeTask({ id: 't2', dependencies: ['t1'] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(2)
    expect(levels[0]).toEqual(['t1'])
    expect(levels[1]).toEqual(['t2'])
  })

  it('should handle single task with self-referencing dep gracefully', () => {
    const tasks = [
      makeTask({ id: 't1', dependencies: ['t1'] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(0)
  })

  it('should preserve task order within a level for deterministic execution', () => {
    const tasks = [
      makeTask({ id: 't3', dependencies: [] }),
      makeTask({ id: 't1', dependencies: [] }),
      makeTask({ id: 't2', dependencies: [] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(1)
    expect(levels[0]).toEqual(['t3', 't1', 't2'])
  })

  it('should handle complex multi-level graph', () => {
    const tasks = [
      makeTask({ id: 'A', dependencies: [] }),
      makeTask({ id: 'B', dependencies: ['A'] }),
      makeTask({ id: 'C', dependencies: ['A'] }),
      makeTask({ id: 'D', dependencies: ['B'] }),
      makeTask({ id: 'E', dependencies: ['C'] }),
      makeTask({ id: 'F', dependencies: ['D', 'E'] }),
    ]
    const levels = groupTasksByLevels(tasks)

    expect(levels).toHaveLength(4)
    expect(levels[0]).toEqual(['A'])
    expect(new Set(levels[1])).toEqual(new Set(['B', 'C']))
    expect(new Set(levels[2])).toEqual(new Set(['D', 'E']))
    expect(levels[3]).toEqual(['F'])
  })
})
