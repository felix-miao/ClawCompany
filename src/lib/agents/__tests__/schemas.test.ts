import {
  PMAgentResponseSchema,
  DevAgentResponseSchema,
  ReviewAgentResponseSchema,
  SubTaskSchema,
  FileChangeSchema,
  ReviewCheckSchema,
} from '../schemas'

describe('PMAgentResponseSchema', () => {
  it('should accept valid PM response', () => {
    const input = {
      analysis: '用户需要一个登录页面',
      tasks: [
        { title: '创建登录表单', description: '实现登录表单', assignedTo: 'dev', dependencies: [] },
      ],
      message: '规划完成',
    }
    const result = PMAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tasks).toHaveLength(1)
    }
  })

  it('should reject response with missing analysis', () => {
    const input = {
      tasks: [],
      message: 'hello',
    }
    const result = PMAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should reject response with invalid assignedTo', () => {
    const input = {
      analysis: 'test',
      tasks: [{ title: 't', description: 'd', assignedTo: 'hacker', dependencies: [] }],
      message: 'm',
    }
    const result = PMAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should default empty tasks array', () => {
    const input = { analysis: 'test', message: 'm' }
    const result = PMAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tasks).toEqual([])
    }
  })

  it('should reject non-string analysis', () => {
    const input = { analysis: 123, tasks: [], message: 'm' }
    const result = PMAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should reject empty task title', () => {
    const input = {
      analysis: 'test',
      tasks: [{ title: '', description: 'd', assignedTo: 'dev' }],
      message: 'm',
    }
    const result = PMAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('DevAgentResponseSchema', () => {
  it('should accept valid Dev response', () => {
    const input = {
      files: [
        { path: 'src/App.tsx', content: 'export default function App() {}', action: 'create' },
      ],
      message: '实现完成',
    }
    const result = DevAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('should reject file with missing path', () => {
    const input = {
      files: [{ content: 'code', action: 'create' }],
      message: 'done',
    }
    const result = DevAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should reject invalid file action', () => {
    const input = {
      files: [{ path: 'a.ts', content: 'c', action: 'delete' }],
      message: 'done',
    }
    const result = DevAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should default action to create', () => {
    const input = {
      files: [{ path: 'a.ts', content: 'c' }],
      message: 'done',
    }
    const result = DevAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.files[0].action).toBe('create')
    }
  })

  it('should accept response with optional notes', () => {
    const input = {
      files: [],
      message: 'done',
      notes: ['note1', 'note2'],
    }
    const result = DevAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
  })
})

describe('ReviewAgentResponseSchema', () => {
  it('should accept valid Review response', () => {
    const input = {
      checks: [
        { name: 'Code style', passed: true },
        { name: 'Security', passed: false, warning: false, message: 'SQL injection risk' },
      ],
      approved: false,
      message: 'Issues found',
      suggestions: ['Add input validation'],
      score: 65,
    }
    const result = ReviewAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('should reject response missing approved field', () => {
    const input = {
      checks: [],
      message: 'ok',
      suggestions: [],
    }
    const result = ReviewAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should reject score outside 0-100', () => {
    const input = {
      checks: [],
      approved: true,
      message: 'ok',
      score: 150,
    }
    const result = ReviewAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should reject negative score', () => {
    const input = {
      checks: [],
      approved: true,
      message: 'ok',
      score: -10,
    }
    const result = ReviewAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should default empty arrays', () => {
    const input = { approved: true, message: 'ok' }
    const result = ReviewAgentResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.checks).toEqual([])
      expect(result.data.suggestions).toEqual([])
    }
  })
})

describe('SubTaskSchema', () => {
  it('should only allow dev or review roles', () => {
    expect(SubTaskSchema.safeParse({ title: 't', description: 'd', assignedTo: 'dev' }).success).toBe(true)
    expect(SubTaskSchema.safeParse({ title: 't', description: 'd', assignedTo: 'review' }).success).toBe(true)
    expect(SubTaskSchema.safeParse({ title: 't', description: 'd', assignedTo: 'admin' }).success).toBe(false)
  })
})

describe('FileChangeSchema', () => {
  it('should only allow create or modify actions', () => {
    expect(FileChangeSchema.safeParse({ path: 'a.ts', content: 'c', action: 'create' }).success).toBe(true)
    expect(FileChangeSchema.safeParse({ path: 'a.ts', content: 'c', action: 'modify' }).success).toBe(true)
    expect(FileChangeSchema.safeParse({ path: 'a.ts', content: 'c', action: 'delete' }).success).toBe(false)
  })
})

describe('ReviewCheckSchema', () => {
  it('should accept check with optional fields', () => {
    const minimal = { name: 'test', passed: true }
    expect(ReviewCheckSchema.safeParse(minimal).success).toBe(true)
  })

  it('should reject check with empty name', () => {
    const input = { name: '', passed: true }
    expect(ReviewCheckSchema.safeParse(input).success).toBe(false)
  })
})
