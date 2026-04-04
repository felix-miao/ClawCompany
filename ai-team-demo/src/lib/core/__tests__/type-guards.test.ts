import {
  safeParseJSON,
  isNonNullObject,
  hasProperty,
  assertTaskStatus,
  assertAgentRole,
  parseFileEntries,
} from '../type-guards'

describe('safeParseJSON', () => {
  it('parses valid JSON string', () => {
    const result = safeParseJSON<{ name: string }>('{"name":"test"}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('test')
    }
  })

  it('returns error for invalid JSON', () => {
    const result = safeParseJSON('not json')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeInstanceOf(SyntaxError)
    }
  })

  it('parses array JSON', () => {
    const result = safeParseJSON<number[]>('[1,2,3]')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3])
    }
  })

  it('parses nested objects', () => {
    const result = safeParseJSON<{ a: { b: number } }>('{"a":{"b":42}}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.a.b).toBe(42)
    }
  })
})

describe('isNonNullObject', () => {
  it('returns true for plain objects', () => {
    expect(isNonNullObject({})).toBe(true)
    expect(isNonNullObject({ a: 1 })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isNonNullObject(null)).toBe(false)
  })

  it('returns false for arrays', () => {
    expect(isNonNullObject([])).toBe(false)
  })

  it('returns false for primitives', () => {
    expect(isNonNullObject('string')).toBe(false)
    expect(isNonNullObject(42)).toBe(false)
    expect(isNonNullObject(true)).toBe(false)
    expect(isNonNullObject(undefined)).toBe(false)
  })
})

describe('hasProperty', () => {
  it('returns true when property exists', () => {
    const obj = { name: 'test', value: 42 }
    expect(hasProperty(obj, 'name')).toBe(true)
    expect(hasProperty(obj, 'value')).toBe(true)
  })

  it('returns false when property does not exist', () => {
    const obj = { name: 'test' }
    expect(hasProperty(obj, 'missing')).toBe(false)
  })

  it('returns true even for undefined property value', () => {
    const obj = { name: undefined }
    expect(hasProperty(obj, 'name')).toBe(true)
  })
})

describe('assertTaskStatus', () => {
  it('returns valid for known statuses', () => {
    expect(assertTaskStatus('pending')).toBe(true)
    expect(assertTaskStatus('in_progress')).toBe(true)
    expect(assertTaskStatus('review')).toBe(true)
    expect(assertTaskStatus('completed')).toBe(true)
    expect(assertTaskStatus('failed')).toBe(true)
  })

  it('returns false for unknown status', () => {
    expect(assertTaskStatus('unknown')).toBe(false)
    expect(assertTaskStatus('')).toBe(false)
  })
})

describe('assertAgentRole', () => {
  it('returns valid for known roles', () => {
    expect(assertAgentRole('pm')).toBe(true)
    expect(assertAgentRole('dev')).toBe(true)
    expect(assertAgentRole('review')).toBe(true)
  })

  it('returns false for unknown role', () => {
    expect(assertAgentRole('admin')).toBe(false)
    expect(assertAgentRole('')).toBe(false)
  })
})

describe('parseFileEntries', () => {
  it('parses valid file entries from unknown input', () => {
    const input = [
      { path: 'a.ts', content: 'code1', action: 'create' },
      { path: 'b.ts', content: 'code2', action: 'modify' },
    ]
    const result = parseFileEntries(input)
    expect(result).toHaveLength(2)
    expect(result[0].path).toBe('a.ts')
    expect(result[1].action).toBe('modify')
  })

  it('provides defaults for missing fields', () => {
    const input = [{ path: 'a.ts' }]
    const result = parseFileEntries(input)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('')
    expect(result[0].action).toBe('create')
  })

  it('skips entries without path', () => {
    const input = [
      { content: 'no path' },
      { path: 'valid.ts', content: 'code' },
    ]
    const result = parseFileEntries(input)
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('valid.ts')
  })

  it('returns empty array for non-array input', () => {
    expect(parseFileEntries(null)).toEqual([])
    expect(parseFileEntries(undefined)).toEqual([])
    expect(parseFileEntries('string')).toEqual([])
    expect(parseFileEntries(42)).toEqual([])
  })

  it('normalizes invalid action to create', () => {
    const input = [{ path: 'a.ts', content: 'code', action: 'invalid' }]
    const result = parseFileEntries(input)
    expect(result[0].action).toBe('create')
  })
})
