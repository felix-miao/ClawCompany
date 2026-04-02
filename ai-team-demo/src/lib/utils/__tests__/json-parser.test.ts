import { extractJSONObject, safeJsonParse } from '../json-parser'

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
