import { validateSubTasks } from '../../orchestrator/index'

describe('validateSubTasks with diagnostics', () => {
  it('should return empty array for non-array input', () => {
    const result = validateSubTasks('not an array')
    expect(result).toEqual([])
  })

  it('should return empty array for null input', () => {
    const result = validateSubTasks(null)
    expect(result).toEqual([])
  })

  it('should validate and return valid subtasks', () => {
    const input = [
      { title: 'Task 1', description: 'Desc 1', assignedTo: 'dev', dependencies: [] },
      { title: 'Task 2', description: 'Desc 2', assignedTo: 'review', dependencies: ['Task 1'] },
    ]

    const result = validateSubTasks(input)

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Task 1')
    expect(result[1].title).toBe('Task 2')
  })

  it('should skip null entries and include them in validation warnings', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const input = [
      { title: 'Task 1', description: 'Desc 1', assignedTo: 'dev', dependencies: [] },
      null,
      { title: 'Task 3', description: 'Desc 3', assignedTo: 'dev', dependencies: [] },
    ]

    const result = validateSubTasks(input)

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Task 1')
    expect(result[1].title).toBe('Task 3')

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Orchestrator]'),
      expect.stringContaining('SubTask validation failed'),
      expect.objectContaining({
        index: 1,
        reason: expect.any(String),
      }),
    )

    consoleWarnSpy.mockRestore()
  })

  it('should log warning with Zod error details for invalid tasks', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const input = [
      { title: '', description: 'Empty title', assignedTo: 'dev', dependencies: [] },
      { title: 'Valid Task', description: 'Good', assignedTo: 'dev', dependencies: [] },
      { description: 'Missing title', assignedTo: 'dev', dependencies: [] },
    ]

    const result = validateSubTasks(input)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Valid Task')

    const warnCalls = consoleWarnSpy.mock.calls.filter(
      (call) => typeof call[1] === 'string' && call[1].includes('SubTask validation failed'),
    )
    expect(warnCalls.length).toBe(2)
    expect(warnCalls[0][2]).toEqual(
      expect.objectContaining({
        index: 0,
        reason: expect.any(String),
      }),
    )
    expect(warnCalls[1][2]).toEqual(
      expect.objectContaining({
        index: 2,
        reason: expect.any(String),
      }),
    )

    consoleWarnSpy.mockRestore()
  })

  it('should preserve files array from raw task data', () => {
    const input = [
      {
        title: 'Task with files',
        description: 'Has files',
        assignedTo: 'dev',
        dependencies: [],
        files: ['src/a.ts', 'src/b.ts'],
      },
    ]

    const result = validateSubTasks(input)

    expect(result[0].files).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('should handle empty files gracefully', () => {
    const input = [
      { title: 'Task', description: 'No files', assignedTo: 'dev', dependencies: [] },
    ]

    const result = validateSubTasks(input)
    expect(result[0].files).toEqual([])
  })

  it('should log warning for tasks with invalid assignedTo', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const input = [
      { title: 'Bad assignment', description: 'desc', assignedTo: 'invalid_role', dependencies: [] },
    ]

    const result = validateSubTasks(input)

    expect(result).toHaveLength(0)

    const warnCalls = consoleWarnSpy.mock.calls.filter(
      (call) => typeof call[1] === 'string' && call[1].includes('SubTask validation failed'),
    )
    expect(warnCalls.length).toBe(1)

    consoleWarnSpy.mockRestore()
  })

  it('should log warning for tasks with non-array dependencies', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const input = [
      { title: 'Task', description: 'desc', assignedTo: 'dev', dependencies: 'not-an-array' },
    ]

    const result = validateSubTasks(input)

    expect(result).toHaveLength(1)

    consoleWarnSpy.mockRestore()
  })

  it('should handle mixed valid and invalid entries with accurate warning count', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const input = [
      { title: 'Valid 1', description: 'd', assignedTo: 'dev', dependencies: [] },
      { title: '', description: 'Empty title', assignedTo: 'dev', dependencies: [] },
      undefined,
      { title: 'Valid 2', description: 'd', assignedTo: 'review', dependencies: [] },
      { description: 'No title', assignedTo: 'dev', dependencies: [] },
      'string instead of object',
    ]

    const result = validateSubTasks(input)

    expect(result).toHaveLength(2)
    expect(result.map((t) => t.title)).toEqual(['Valid 1', 'Valid 2'])

    const warnCalls = consoleWarnSpy.mock.calls.filter(
      (call) => typeof call[1] === 'string' && call[1].includes('SubTask validation failed'),
    )
    expect(warnCalls.length).toBe(4)
    const warnIndices = warnCalls.map((call) => (call[2] as { index: number }).index)
    expect(warnIndices).toEqual([1, 2, 4, 5])

    consoleWarnSpy.mockRestore()
  })
})
