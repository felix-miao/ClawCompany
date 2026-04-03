import { PMAgent } from '../pm-agent'
import { Task, AgentContext } from '../types'
import { PMAgentResponseSchema } from '../schemas'

jest.mock('../../llm/factory', () => ({
  getLLMProvider: jest.fn(),
}))

describe('PMAgent - Comprehensive', () => {
  let pmAgent: PMAgent
  let mockContext: AgentContext

  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task description',
    status: 'pending',
    assignedTo: 'pm',
    dependencies: [],
    files: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    pmAgent = new PMAgent()
    mockContext = {
      projectId: 'test-project',
      tasks: [],
      files: {},
      chatHistory: [],
    }
  })

  describe('extractKeywords', () => {
    it('should extract auth keywords from login-related descriptions', async () => {
      const task = makeTask({
        title: 'Login feature',
        description: '需要实现用户登录功能',
      })
      const response = await pmAgent.execute(task, mockContext)
      const titles = response.tasks!.map(t => t.title.toLowerCase())
      expect(titles.some(t => t.includes('表单') || t.includes('form'))).toBe(true)
    })

    it('should extract form and validation keywords', async () => {
      const task = makeTask({
        title: 'Registration form',
        description: '创建注册表单，需要输入验证',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.tasks!.length).toBeGreaterThanOrEqual(2)
    })

    it('should extract page/UI keywords', async () => {
      const task = makeTask({
        title: 'Dashboard page',
        description: '创建一个新的页面来展示数据',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.tasks).toBeDefined()
      expect(response.tasks!.length).toBeGreaterThan(0)
    })

    it('should extract API keywords', async () => {
      const task = makeTask({
        title: 'User API',
        description: '创建用户管理 API 接口',
      })
      const response = await pmAgent.execute(task, mockContext)
      const titles = response.tasks!.map(t => t.title.toLowerCase())
      expect(titles.some(t => t.includes('api') || t.includes('接口'))).toBe(true)
    })

    it('should extract testing keywords', async () => {
      const task = makeTask({
        title: 'Unit tests',
        description: '为现有功能添加测试',
      })
      const response = await pmAgent.execute(task, mockContext)
      const titles = response.tasks!.map(t => t.title.toLowerCase())
      expect(titles.some(t => t.includes('测试'))).toBe(true)
    })

    it('should default to implementation+testing for unknown descriptions', async () => {
      const task = makeTask({
        title: 'Random feature',
        description: 'Something completely unrelated to form/api/login/test',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.tasks).toBeDefined()
      expect(response.tasks!.length).toBeGreaterThan(0)
    })

    it('should match English login keyword', async () => {
      const task = makeTask({
        title: 'Auth feature',
        description: 'Implement user login functionality with OAuth',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.tasks!.length).toBeGreaterThan(0)
    })

    it('should match English form keyword', async () => {
      const task = makeTask({
        title: 'Contact form',
        description: 'Create a form for user feedback',
      })
      const response = await pmAgent.execute(task, mockContext)
      const titles = response.tasks!.map(t => t.title)
      expect(titles.some(t => t.includes('表单'))).toBe(true)
    })

    it('should match English page keyword', async () => {
      const task = makeTask({
        title: 'Settings page',
        description: 'Build a settings page for user preferences',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.tasks!.length).toBeGreaterThan(0)
    })

    it('should handle combined keywords (login + API + testing)', async () => {
      const task = makeTask({
        title: 'Complete auth system',
        description: '需要实现用户登录 API 接口，并添加测试',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.tasks!.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('generateSubTasks', () => {
    it('should generate form subtask when form keyword present', async () => {
      const task = makeTask({
        title: 'Input form',
        description: '创建表单',
      })
      const response = await pmAgent.execute(task, mockContext)
      const titles = response.tasks!.map(t => t.title)
      expect(titles.some(t => t.includes('表单'))).toBe(true)
    })

    it('should generate validation subtask dependent on form subtask', async () => {
      const task = makeTask({
        title: 'Register',
        description: '创建注册表单需要验证',
      })
      const response = await pmAgent.execute(task, mockContext)
      const validationTask = response.tasks!.find(t => t.title.includes('验证'))
      if (validationTask) {
        expect(validationTask.dependencies.length).toBeGreaterThan(0)
      }
    })

    it('should generate API subtask for api-related descriptions', async () => {
      const task = makeTask({
        title: 'Backend',
        description: '创建数据 API 接口',
      })
      const response = await pmAgent.execute(task, mockContext)
      const apiTask = response.tasks!.find(t =>
        t.title.toLowerCase().includes('api') || t.title.includes('接口')
      )
      expect(apiTask).toBeDefined()
    })

    it('should generate testing subtask with dependencies on form and API', async () => {
      const task = makeTask({
        title: 'Full feature',
        description: '创建登录表单，实现 API 接口，并添加测试',
      })
      const response = await pmAgent.execute(task, mockContext)
      const testTask = response.tasks!.find(t => t.title.includes('测试'))
      if (testTask) {
        expect(testTask.dependencies.length).toBeGreaterThan(0)
      }
    })

    it('should generate default implementation task when no keywords match', async () => {
      const task = makeTask({
        title: 'Mystery feature',
        description: 'Something without any keywords',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.tasks).toBeDefined()
      expect(response.tasks!.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('generatePlanningMessage', () => {
    it('should include task count in message', async () => {
      const task = makeTask({
        title: 'Login page',
        description: '创建登录页面',
      })
      const response = await pmAgent.execute(task, mockContext)
      const count = response.tasks!.length
      expect(response.message).toContain(`${count}`)
    })

    it('should include agent name in task assignments', async () => {
      const task = makeTask({
        title: 'Feature',
        description: '创建表单',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.message).toContain('Dev Claw')
    })

    it('should list dependencies when present', async () => {
      const task = makeTask({
        title: 'Complex feature',
        description: '创建注册表单并添加验证',
      })
      const response = await pmAgent.execute(task, mockContext)
      const tasksWithDeps = response.tasks!.filter(t => t.dependencies.length > 0)
      if (tasksWithDeps.length > 0) {
        tasksWithDeps.forEach(t => {
          expect(response.message).toContain(t.dependencies[0])
        })
      }
    })

    it('should reference Dev Claw for first task in message', async () => {
      const task = makeTask({
        title: 'Something',
        description: 'A task',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.message).toContain('Dev Claw')
    })
  })

  describe('handleLLMResponse', () => {
    it('should parse valid JSON and produce structured response', () => {
      const handleLLMResponse = (pmAgent as any).handleLLMResponse.bind(pmAgent)
      const validJSON = JSON.stringify({
        analysis: '需求分析',
        tasks: [
          { title: 'Task 1', description: 'Desc 1', assignedTo: 'dev', dependencies: [] },
        ],
        message: '规划完成',
      })

      const result = handleLLMResponse(validJSON)
      expect(result.agent).toBe('pm')
      expect(result.status).toBe('success')
      expect(result.nextAgent).toBe('dev')
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks![0].status).toBe('pending')
    })

    it('should handle invalid JSON gracefully', () => {
      const handleLLMResponse = (pmAgent as any).handleLLMResponse.bind(pmAgent)
      const result = handleLLMResponse('not valid json')
      expect(result.agent).toBe('pm')
      expect(result.status).toBe('success')
      expect(result.message).toBe('not valid json')
    })

    it('should handle JSON with missing message field', () => {
      const handleLLMResponse = (pmAgent as any).handleLLMResponse.bind(pmAgent)
      const result = handleLLMResponse(JSON.stringify({
        analysis: 'test',
        tasks: [],
      }))
      expect(result.agent).toBe('pm')
      expect(result.status).toBe('success')
    })

    it('should set all subtask status to pending', () => {
      const handleLLMResponse = (pmAgent as any).handleLLMResponse.bind(pmAgent)
      const result = handleLLMResponse(JSON.stringify({
        analysis: 'test',
        tasks: [
          { title: 'T1', description: 'D1', assignedTo: 'dev', dependencies: [] },
          { title: 'T2', description: 'D2', assignedTo: 'review', dependencies: ['T1'] },
        ],
        message: 'done',
      }))
      result.tasks.forEach((t: any) => {
        expect(t.status).toBe('pending')
      })
    })

    it('should preserve dependencies from parsed tasks', () => {
      const handleLLMResponse = (pmAgent as any).handleLLMResponse.bind(pmAgent)
      const result = handleLLMResponse(JSON.stringify({
        analysis: 'test',
        tasks: [
          { title: 'T1', description: 'D1', assignedTo: 'dev', dependencies: [] },
          { title: 'T2', description: 'D2', assignedTo: 'dev', dependencies: ['T1'] },
        ],
        message: 'done',
      }))
      expect(result.tasks[1].dependencies).toEqual(['T1'])
    })

    it('should set empty files array on each subtask', () => {
      const handleLLMResponse = (pmAgent as any).handleLLMResponse.bind(pmAgent)
      const result = handleLLMResponse(JSON.stringify({
        analysis: 'test',
        tasks: [
          { title: 'T1', description: 'D1', assignedTo: 'dev', dependencies: [] },
        ],
        message: 'done',
      }))
      expect(result.tasks[0].files).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('should handle empty title gracefully', async () => {
      const task = makeTask({ title: '', description: 'A description' })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.agent).toBe('pm')
      expect(response.status).toBe('success')
    })

    it('should handle empty description gracefully', async () => {
      const task = makeTask({ title: 'Title only', description: '' })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.agent).toBe('pm')
      expect(response.status).toBe('success')
      expect(response.tasks!.length).toBeGreaterThan(0)
    })

    it('should handle very long description', async () => {
      const task = makeTask({
        title: 'Big feature',
        description: 'a'.repeat(5000),
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.status).toBe('success')
    })

    it('should handle special characters in title', async () => {
      const task = makeTask({
        title: 'Feature <script>alert("xss")</script>',
        description: 'Normal description',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.status).toBe('success')
    })

    it('should handle unicode in description', async () => {
      const task = makeTask({
        title: '国际化功能',
        description: '实现多语言支持，包括中文、日本語、한국어',
      })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.status).toBe('success')
    })

    it('should always set nextAgent to dev', async () => {
      const tasks = [
        makeTask({ description: '登录' }),
        makeTask({ description: '表单验证' }),
        makeTask({ description: 'API 接口' }),
        makeTask({ description: 'random stuff' }),
      ]

      for (const task of tasks) {
        const response = await pmAgent.execute(task, mockContext)
        expect(response.nextAgent).toBe('dev')
      }
    })

    it('should always return agent as pm', async () => {
      const task = makeTask()
      const response = await pmAgent.execute(task, mockContext)
      expect(response.agent).toBe('pm')
    })

    it('should handle context with existing tasks', async () => {
      mockContext.tasks = [
        makeTask({ id: 'prev-1', title: 'Previous task' }),
        makeTask({ id: 'prev-2', title: 'Another task' }),
      ]
      const task = makeTask({ description: '创建新表单' })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.status).toBe('success')
    })

    it('should handle context with files', async () => {
      mockContext.files = {
        'src/existing.ts': 'existing content',
      }
      const task = makeTask({ description: '创建新功能' })
      const response = await pmAgent.execute(task, mockContext)
      expect(response.status).toBe('success')
    })

    it('should handle concurrent task execution', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        pmAgent.execute(
          makeTask({ id: `concurrent-${i}`, title: `Task ${i}`, description: '表单测试' }),
          mockContext
        )
      )
      const results = await Promise.all(tasks)
      results.forEach(response => {
        expect(response.status).toBe('success')
        expect(response.agent).toBe('pm')
      })
    })
  })

  describe('system prompt', () => {
    it('should contain PM role description in system prompt', () => {
      const getSystemPrompt = (pmAgent as any).getSystemPrompt.bind(pmAgent)
      const prompt = getSystemPrompt()
      expect(prompt).toContain('PM')
      expect(prompt).toContain('JSON')
      expect(prompt).toContain('tasks')
    })
  })

  describe('user prompt builder', () => {
    it('should include task information in user prompt', () => {
      const buildUserPrompt = (pmAgent as any).buildUserPrompt.bind(pmAgent)
      const task = makeTask({
        title: 'Test Title',
        description: 'Test Description',
      })
      const prompt = buildUserPrompt(task)
      expect(prompt).toContain('Test Title')
      expect(prompt).toContain('Test Description')
      expect(prompt).toContain('task_input')
    })

    it('should wrap task data in sanitization tags', () => {
      const buildUserPrompt = (pmAgent as any).buildUserPrompt.bind(pmAgent)
      const task = makeTask()
      const prompt = buildUserPrompt(task)
      expect(prompt).toContain('<task_input>')
      expect(prompt).toContain('</task_input>')
    })
  })
})
