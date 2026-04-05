import { extractJSONObject, extractJSONArray, extractJSON, safeJsonParse, sanitizeJSON } from '../json-parser'

describe('extractJSONObject', () => {
  it('should extract JSON from plain JSON string', () => {
    const result = extractJSONObject('{"key": "value"}')
    expect(result).toEqual({ key: 'value' })
  })

  it('should extract JSON from LLM response with surrounding text', () => {
    const response = 'Here is the result:\n{"tasks": [], "analysis": "done"}\nEnd of response.'
    const result = extractJSONObject(response)
    expect(result).toEqual({ tasks: [], analysis: 'done' })
  })

  it('should extract JSON from response with markdown code blocks', () => {
    const response = '```json\n{"approved": true}\n```'
    const result = extractJSONObject(response)
    expect(result).toEqual({ approved: true })
  })

  it('should extract the first JSON object from nested JSON', () => {
    const response = '{"outer": {"inner": 42}}'
    const result = extractJSONObject(response)
    expect(result).toEqual({ outer: { inner: 42 } })
  })

  it('should return null when no JSON object is found', () => {
    const result = extractJSONObject('no json here')
    expect(result).toBeNull()
  })

  it('should return null for empty string', () => {
    const result = extractJSONObject('')
    expect(result).toBeNull()
  })

  it('should return null for malformed JSON', () => {
    const result = extractJSONObject('{broken json}')
    expect(result).toBeNull()
  })

  it('should handle JSON with arrays', () => {
    const response = '{"items": [1, 2, 3], "count": 3}'
    const result = extractJSONObject(response)
    expect(result).toEqual({ items: [1, 2, 3], count: 3 })
  })

  it('should handle JSON with unicode characters', () => {
    const response = '{"message": "任务规划完成", "status": "ok"}'
    const result = extractJSONObject(response)
    expect(result).toEqual({ message: '任务规划完成', status: 'ok' })
  })

  it('should handle JSON with multiline strings', () => {
    const response = `{"code": "line1\\nline2\\nline3"}`
    const result = extractJSONObject(response)
    expect(result).toEqual({ code: 'line1\nline2\nline3' })
  })

  it('should skip non-JSON curly braces before the actual JSON', () => {
    const response = 'Here is {analysis} and {plan}. Result: {"tasks": [], "status": "ok"}'
    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result).toEqual({ tasks: [], status: 'ok' })
  })

  it('should extract the first valid JSON object when multiple exist', () => {
    const response = 'First: {"a": 1} and second: {"b": 2}'
    const result = extractJSONObject(response)
    expect(result).toEqual({ a: 1 })
  })

  it('should handle text with curly brace in code examples before JSON', () => {
    const response = 'Use `function() { return x; }` to get value.\n{"result": "success", "data": {}}'
    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result).toEqual({ result: 'success', data: {} })
  })

  it('should handle nested JSON with surrounding brace text', () => {
    const response = 'Config: {env}. Response: {"outer": {"inner": {"deep": true}}, "count": 1}'
    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result).toEqual({ outer: { inner: { deep: true } }, count: 1 })
  })

  it('should extract JSON from markdown with link before it', () => {
    const response = 'Check [this]{#link} for details.\n{"approved": true}'
    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result).toEqual({ approved: true })
  })

  it('should handle JSON with string containing braces', () => {
    const response = '{"code": "if (x) { return 1; }", "status": "ok"}'
    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result).toEqual({ code: 'if (x) { return 1; }', status: 'ok' })
  })

  it('should extract JSON from LLM response with template-like text', () => {
    const response = `Analysis complete.

I considered {options} and {alternatives}.

Here's my structured output:
{"analysis": "done", "confidence": 0.95, "tasks": [{"name": "implement"}]}`
    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result!.analysis).toBe('done')
    expect(result!.confidence).toBe(0.95)
  })

  it('should extract JSON from real-world PM agent response', () => {
    const response = `Based on my analysis:

{
  "analysis": "User wants a login feature",
  "tasks": [
    {"title": "Create login form", "description": "Build UI", "assignedTo": "dev"},
    {"title": "Add auth logic", "description": "Backend", "assignedTo": "dev"}
  ],
  "message": "任务规划完成"
}

Please proceed with implementation.`

    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result!.analysis).toBe('User wants a login feature')
    expect(result!.tasks).toHaveLength(2)
    expect(result!.tasks[0].title).toBe('Create login form')
  })

  it('should extract JSON from real-world Dev agent response', () => {
    const response = `Implementation done:
{
  "analysis": "Created component",
  "files": [{"path": "src/Login.tsx", "content": "export const Login = () => {}", "action": "create"}],
  "message": "代码实现完成",
  "notes": ["Used TypeScript"]
}`

    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result!.files).toHaveLength(1)
    expect(result!.files[0].path).toBe('src/Login.tsx')
  })

  it('should extract JSON from real-world Review agent response', () => {
    const response = `Review result:
{
  "checks": [{"name": "Type Safety", "passed": true}],
  "approved": true,
  "message": "代码审查完成",
  "suggestions": []
}`

    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result!.approved).toBe(true)
    expect(result!.checks).toHaveLength(1)
  })

  it('should handle deeply nested objects', () => {
    const result = extractJSONObject('{"a": {"b": {"c": {"d": {"e": 1}}}}}')
    expect(result).toEqual({ a: { b: { c: { d: { e: 1 } } } } })
  })

  it('should handle JSON with escaped quotes in values', () => {
    const result = extractJSONObject('{"msg": "He said \\"hello\\""}')
    expect(result).toEqual({ msg: 'He said "hello"' })
  })

  it('should handle JSON with backslashes in values', () => {
    const result = extractJSONObject('{"path": "C:\\\\Users\\\\test"}')
    expect(result).toEqual({ path: 'C:\\Users\\test' })
  })

  it('should handle object with empty string value', () => {
    const result = extractJSONObject('{"key": ""}')
    expect(result).toEqual({ key: '' })
  })

  it('should skip unmatched opening braces until valid JSON found', () => {
    const result = extractJSONObject('{invalid} but {"valid": true}')
    expect(result).toEqual({ valid: true })
  })

  it('should handle object containing array with objects', () => {
    const result = extractJSONObject('{"items": [{"id": 1}, {"id": 2}]}')
    expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] })
  })

  it('should handle JSON with boolean and null values', () => {
    const result = extractJSONObject('{"a": true, "b": false, "c": null}')
    expect(result).toEqual({ a: true, b: false, c: null })
  })

  it('should handle JSON with numeric values including negative and float', () => {
    const result = extractJSONObject('{"a": -1, "b": 3.14, "c": 0}')
    expect(result).toEqual({ a: -1, b: 3.14, c: 0 })
  })

  it('should handle brace inside a string value', () => {
    const result = extractJSONObject('{"template": "${name} is {age}"}')
    expect(result).toEqual({ template: '${name} is {age}' })
  })
})

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    const result = safeJsonParse('{"key": "value"}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ key: 'value' })
    }
  })

  it('should return error for invalid JSON', () => {
    const result = safeJsonParse('{invalid}')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Failed to parse JSON')
    }
  })

  it('should return error for empty string', () => {
    const result = safeJsonParse('')
    expect(result.success).toBe(false)
  })

  it('should include custom context in error message', () => {
    const result = safeJsonParse('{bad}', 'ChatManager')
    if (!result.success) {
      expect(result.error).toContain('ChatManager')
    }
  })

  it('should parse arrays', () => {
    const result = safeJsonParse('[1, 2, 3]')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3])
    }
  })

  it('should parse nested objects', () => {
    const result = safeJsonParse('{"a": {"b": {"c": 1}}}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ a: { b: { c: 1 } } })
    }
  })

  it('should handle JSON with null values', () => {
    const result = safeJsonParse('{"key": null}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ key: null })
    }
  })
})

describe('extractJSONArray', () => {
  it('should extract JSON array from plain string', () => {
    const result = extractJSONArray('[1, 2, 3]')
    expect(result).toEqual([1, 2, 3])
  })

  it('should extract JSON array from LLM response with surrounding text', () => {
    const response = 'Here are the items:\n[{"name": "task1"}, {"name": "task2"}]\nEnd.'
    const result = extractJSONArray(response)
    expect(result).toEqual([{ name: 'task1' }, { name: 'task2' }])
  })

  it('should extract JSON array from markdown code block', () => {
    const response = '```json\n["a", "b", "c"]\n```'
    const result = extractJSONArray(response)
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('should return null when no JSON array is found', () => {
    const result = extractJSONArray('no array here')
    expect(result).toBeNull()
  })

  it('should return null for empty string', () => {
    const result = extractJSONArray('')
    expect(result).toBeNull()
  })

  it('should return null for malformed array', () => {
    const result = extractJSONArray('[broken array]')
    expect(result).toBeNull()
  })

  it('should handle nested arrays', () => {
    const result = extractJSONArray('[[1, 2], [3, 4]]')
    expect(result).toEqual([[1, 2], [3, 4]])
  })

  it('should handle array with unicode', () => {
    const result = extractJSONArray('["任务一", "任务二"]')
    expect(result).toEqual(['任务一', '任务二'])
  })

  it('should handle empty array', () => {
    const result = extractJSONArray('Result: []')
    expect(result).toEqual([])
  })

  it('should skip non-array brackets before the actual array', () => {
    const response = 'Use items[0] to get first. Result: [1, 2, 3]'
    const result = extractJSONArray(response)
    expect(result).toEqual([1, 2, 3])
  })

  it('should handle array with objects containing nested arrays', () => {
    const result = extractJSONArray('[{"items": [1, 2]}, {"items": [3, 4]}]')
    expect(result).toEqual([{ items: [1, 2] }, { items: [3, 4] }])
  })

  it('should handle deeply nested arrays', () => {
    const result = extractJSONArray('[[[[1]]]]')
    expect(result).toEqual([[[[1]]]])
  })

  it('should handle array with escaped quotes in string values', () => {
    const result = extractJSONArray('["He said \\"hello\\""]')
    expect(result).toEqual(['He said "hello"'])
  })

  it('should handle array with mixed types', () => {
    const result = extractJSONArray('[1, "two", true, null, {"key": "val"}]')
    expect(result).toEqual([1, 'two', true, null, { key: 'val' }])
  })

  it('should extract array from response with bracket in code example', () => {
    const response = 'Access items[0] for first.\n[1, 2, 3]'
    const result = extractJSONArray(response)
    expect(result).toEqual([1, 2, 3])
  })
})

describe('extractJSON', () => {
  it('should extract JSON object from text', () => {
    const result = extractJSON('Result: {"key": "value"}')
    expect(result).toEqual({ key: 'value' })
  })

  it('should extract JSON array from text', () => {
    const result = extractJSON('Result: [1, 2, 3]')
    expect(result).toEqual([1, 2, 3])
  })

  it('should prefer object when both exist in text', () => {
    const response = 'First {"a": 1} then [1, 2]'
    const result = extractJSON(response)
    expect(result).toEqual({ a: 1 })
  })

  it('should return null when no JSON found', () => {
    const result = extractJSON('no json')
    expect(result).toBeNull()
  })

  it('should return null for empty string', () => {
    const result = extractJSON('')
    expect(result).toBeNull()
  })

  it('should handle array-only input', () => {
    const result = extractJSON('["x", "y"]')
    expect(result).toEqual(['x', 'y'])
  })

  it('should handle object-only input', () => {
    const result = extractJSON('{"only": "object"}')
    expect(result).toEqual({ only: 'object' })
  })
})

describe('sanitizeJSON - LLM edge cases', () => {
  describe('trailing commas', () => {
    it('should handle trailing comma in object', () => {
      const result = sanitizeJSON('{"a": 1, "b": 2,}')
      expect(JSON.parse(result)).toEqual({ a: 1, b: 2 })
    })

    it('should handle trailing comma in array', () => {
      const result = sanitizeJSON('[1, 2, 3,]')
      expect(JSON.parse(result)).toEqual([1, 2, 3])
    })

    it('should handle trailing comma in nested object', () => {
      const result = sanitizeJSON('{"outer": {"inner": 42,},}')
      expect(JSON.parse(result)).toEqual({ outer: { inner: 42 } })
    })

    it('should handle trailing comma in nested array', () => {
      const result = sanitizeJSON('[[1, 2,], [3,],]')
      expect(JSON.parse(result)).toEqual([[1, 2], [3]])
    })

    it('should handle trailing comma after object in array', () => {
      const result = sanitizeJSON('[{"a": 1}, {"b": 2},]')
      expect(JSON.parse(result)).toEqual([{ a: 1 }, { b: 2 }])
    })

    it('should NOT remove commas that are not trailing', () => {
      const result = sanitizeJSON('{"a": 1, "b": 2}')
      expect(JSON.parse(result)).toEqual({ a: 1, b: 2 })
    })
  })

  describe('single quotes', () => {
    it('should convert single-quoted keys', () => {
      const result = sanitizeJSON("{'a': 1}")
      expect(JSON.parse(result)).toEqual({ a: 1 })
    })

    it('should convert single-quoted values', () => {
      const result = sanitizeJSON('{"a": \'hello\'}')
      expect(JSON.parse(result)).toEqual({ a: 'hello' })
    })

    it('should convert all single quotes in nested structures', () => {
      const result = sanitizeJSON("{'a': 'hello', 'b': {'c': 'world'}}")
      expect(JSON.parse(result)).toEqual({ a: 'hello', b: { c: 'world' } })
    })

    it('should handle single quotes in arrays', () => {
      const result = sanitizeJSON("['a', 'b', 'c']")
      expect(JSON.parse(result)).toEqual(['a', 'b', 'c'])
    })

    it('should handle mixed single and double quotes', () => {
      const result = sanitizeJSON("{'a': \"hello\", 'b': 'world'}")
      expect(JSON.parse(result)).toEqual({ a: 'hello', b: 'world' })
    })

    it('should not affect double-quoted strings', () => {
      const result = sanitizeJSON('{"key": "value"}')
      expect(JSON.parse(result)).toEqual({ key: 'value' })
    })

    it('should handle escaped single quotes inside single-quoted strings', () => {
      const result = sanitizeJSON("{'key': 'it\\'s fine'}")
      expect(JSON.parse(result)).toEqual({ key: "it's fine" })
    })
  })

  describe('comments', () => {
    it('should remove single-line comments', () => {
      const result = sanitizeJSON('{"a": 1 // this is a comment\n}')
      expect(JSON.parse(result)).toEqual({ a: 1 })
    })

    it('should remove multi-line comments', () => {
      const result = sanitizeJSON('{"a": 1 /* this is a comment */}')
      expect(JSON.parse(result)).toEqual({ a: 1 })
    })

    it('should remove multi-line comments spanning lines', () => {
      const result = sanitizeJSON('{"a": 1, /* comment\nacross\nlines */ "b": 2}')
      expect(JSON.parse(result)).toEqual({ a: 1, b: 2 })
    })

    it('should NOT remove // or /* inside strings', () => {
      const result = sanitizeJSON('{"url": "https://example.com", "regex": "/a*/"}')
      expect(JSON.parse(result)).toEqual({ url: 'https://example.com', regex: '/a*/' })
    })

    it('should handle comment at end of array element', () => {
      const result = sanitizeJSON('[1, // first\n2, // second\n3 // third\n]')
      expect(JSON.parse(result)).toEqual([1, 2, 3])
    })

    it('should handle comment-only lines in object', () => {
      const result = sanitizeJSON('{\n// config section\n"a": 1\n}')
      expect(JSON.parse(result)).toEqual({ a: 1 })
    })
  })

  describe('undefined values', () => {
    it('should convert undefined to null', () => {
      const result = sanitizeJSON('{"a": undefined}')
      expect(JSON.parse(result)).toEqual({ a: null })
    })

    it('should convert undefined in array to null', () => {
      const result = sanitizeJSON('[1, undefined, 3]')
      expect(JSON.parse(result)).toEqual([1, null, 3])
    })

    it('should handle undefined value in nested object', () => {
      const result = sanitizeJSON('{"a": {"b": undefined}}')
      expect(JSON.parse(result)).toEqual({ a: { b: null } })
    })

    it('should NOT convert "undefined" string to null', () => {
      const result = sanitizeJSON('{"a": "undefined"}')
      expect(JSON.parse(result)).toEqual({ a: 'undefined' })
    })
  })

  describe('unquoted keys', () => {
    it('should add quotes to unquoted keys', () => {
      const result = sanitizeJSON('{a: 1, b: 2}')
      expect(JSON.parse(result)).toEqual({ a: 1, b: 2 })
    })

    it('should handle mixed quoted and unquoted keys', () => {
      const result = sanitizeJSON('{a: 1, "b": 2, c: "three"}')
      expect(JSON.parse(result)).toEqual({ a: 1, b: 2, c: 'three' })
    })

    it('should handle unquoted keys with underscore', () => {
      const result = sanitizeJSON('{my_key: "value"}')
      expect(JSON.parse(result)).toEqual({ my_key: 'value' })
    })
  })

  describe('combined edge cases', () => {
    it('should handle trailing comma + single quotes + comments', () => {
      const result = sanitizeJSON("{'a': 1, // comment\n'b': 2,}")
      expect(JSON.parse(result)).toEqual({ a: 1, b: 2 })
    })

    it('should handle unquoted keys + trailing comma + undefined', () => {
      const result = sanitizeJSON('{a: 1, b: undefined,}')
      expect(JSON.parse(result)).toEqual({ a: 1, b: null })
    })

    it('should handle single quotes + comments + trailing comma in real LLM output', () => {
      const input = `{
  // Task configuration
  'name': 'my-task',
  'items': [1, 2, 3,], /* trailing items */
  'config': undefined,
}`
      const result = sanitizeJSON(input)
      expect(JSON.parse(result)).toEqual({
        name: 'my-task',
        items: [1, 2, 3],
        config: null
      })
    })
  })
})

describe('extractJSONObject - LLM edge cases (sanitized)', () => {
  it('should handle trailing comma in LLM response', () => {
    const response = 'Here is the result:\n{"tasks": [], "status": "ok",}\nDone.'
    const result = extractJSONObject(response)
    expect(result).toEqual({ tasks: [], status: 'ok' })
  })

  it('should handle single quotes in LLM response', () => {
    const response = "Result: {'name': 'test', 'value': 42}"
    const result = extractJSONObject(response)
    expect(result).toEqual({ name: 'test', value: 42 })
  })

  it('should handle comments in LLM response', () => {
    const response = 'Result: {"a": 1, /* important */ "b": 2}'
    const result = extractJSONObject(response)
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('should handle undefined values in LLM response', () => {
    const response = 'Result: {"a": 1, "b": undefined}'
    const result = extractJSONObject(response)
    expect(result).toEqual({ a: 1, b: null })
  })

  it('should handle combined edge cases in real-world LLM output', () => {
    const response = `Analysis complete.
{
  // analysis section
  'analysis': 'User wants login',
  'tasks': [
    {'title': 'Create form', 'done': false,},
    {'title': 'Add auth', 'done': undefined,},
  ],
  'notes': null,
}
Proceed with implementation.`

    const result = extractJSONObject(response)
    expect(result).not.toBeNull()
    expect(result!.analysis).toBe('User wants login')
    expect(result!.tasks).toHaveLength(2)
    expect(result!.tasks[1].done).toBeNull()
  })
})

describe('extractJSONArray - LLM edge cases (sanitized)', () => {
  it('should handle trailing comma in array from LLM', () => {
    const response = 'Items: [1, 2, 3,]'
    const result = extractJSONArray(response)
    expect(result).toEqual([1, 2, 3])
  })

  it('should handle single quotes in array from LLM', () => {
    const response = "Names: ['alice', 'bob']"
    const result = extractJSONArray(response)
    expect(result).toEqual(['alice', 'bob'])
  })

  it('should handle comments in array from LLM', () => {
    const response = 'Values: [1, /* first */ 2, // second\n3]'
    const result = extractJSONArray(response)
    expect(result).toEqual([1, 2, 3])
  })
})
