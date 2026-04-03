import { DevAgent, DevAgentMode } from '../dev-agent'
import { Task, AgentContext } from '../types'
import { OpenClawAgentExecutor } from '../../gateway/executor'

jest.mock('../../gateway/executor', () => ({
  getAgentExecutor: jest.fn(),
  OpenClawAgentExecutor: jest.fn(),
}))

jest.mock('../../llm/factory', () => ({
  getLLMProvider: jest.fn(),
}))

describe('DevAgent - Comprehensive', () => {
  let devAgent: DevAgent
  let mockContext: AgentContext

  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task',
    status: 'pending',
    assignedTo: 'dev',
    dependencies: [],
    files: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    devAgent = new DevAgent({ mode: 'mock' })
    mockContext = {
      projectId: 'test-project',
      tasks: [],
      files: {},
      chatHistory: [],
    }
  })

  describe('toPascalCase', () => {
    it('should convert space-separated words', () => {
      const result = (devAgent as any).toPascalCase('create login form')
      expect(result).toBe('CreateLoginForm')
    })

    it('should convert hyphen-separated words', () => {
      const result = (devAgent as any).toPascalCase('user-auth-component')
      expect(result).toBe('UserAuthComponent')
    })

    it('should convert underscore-separated words', () => {
      const result = (devAgent as any).toPascalCase('user_auth_component')
      expect(result).toBe('UserAuthComponent')
    })

    it('should handle already PascalCase', () => {
      const result = (devAgent as any).toPascalCase('LoginForm')
      expect(result).toBe('LoginForm')
    })

    it('should strip non-alphanumeric characters', () => {
      const result = (devAgent as any).toPascalCase('create @#$ form!!!')
      expect(result).toBe('CreateForm')
    })

    it('should handle single character', () => {
      const result = (devAgent as any).toPascalCase('a')
      expect(result).toBe('A')
    })

    it('should handle Chinese characters (stripped)', () => {
      const result = (devAgent as any).toPascalCase('创建登录表单')
      expect(result).toBe('')
    })

    it('should handle mixed alphanumeric', () => {
      const result = (devAgent as any).toPascalCase('create v2 form')
      expect(result).toBe('CreateV2Form')
    })
  })

  describe('toKebabCase', () => {
    it('should convert spaces to hyphens', () => {
      const result = (devAgent as any).toKebabCase('Create Login API')
      expect(result).toBe('create-login-api')
    })

    it('should lowercase everything', () => {
      const result = (devAgent as any).toKebabCase('UPPER CASE')
      expect(result).toBe('upper-case')
    })

    it('should remove non-alphanumeric except hyphens', () => {
      const result = (devAgent as any).toKebabCase('API @#$ Route!!!')
      expect(result).toBe('api--route')
    })

    it('should handle already kebab-case', () => {
      const result = (devAgent as any).toKebabCase('user-login-api')
      expect(result).toBe('user-login-api')
    })
  })

  describe('getExtensionFromLang', () => {
    it('should map typescript to ts', () => {
      expect((devAgent as any).getExtensionFromLang('typescript')).toBe('ts')
    })

    it('should map typescriptreact to tsx', () => {
      expect((devAgent as any).getExtensionFromLang('typescriptreact')).toBe('tsx')
    })

    it('should map javascript to js', () => {
      expect((devAgent as any).getExtensionFromLang('javascript')).toBe('js')
    })

    it('should map jsx to jsx', () => {
      expect((devAgent as any).getExtensionFromLang('jsx')).toBe('jsx')
    })

    it('should map css to css', () => {
      expect((devAgent as any).getExtensionFromLang('css')).toBe('css')
    })

    it('should map json to json', () => {
      expect((devAgent as any).getExtensionFromLang('json')).toBe('json')
    })

    it('should map markdown to md', () => {
      expect((devAgent as any).getExtensionFromLang('markdown')).toBe('md')
    })

    it('should default to ts for unknown language', () => {
      expect((devAgent as any).getExtensionFromLang('python')).toBe('ts')
    })

    it('should handle case-insensitive matching', () => {
      expect((devAgent as any).getExtensionFromLang('TypeScript')).toBe('ts')
      expect((devAgent as any).getExtensionFromLang('CSS')).toBe('css')
    })
  })

  describe('generateCode', () => {
    it('should generate form component for form-related tasks', async () => {
      const task = makeTask({ title: '创建表单组件' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('useState')
      expect(response.files![0].content).toContain('input')
      expect(response.files![0].content).toContain('handleSubmit')
    })

    it('should generate form component for login form task', async () => {
      const task = makeTask({ title: 'Login form' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].path).toMatch(/\.tsx$/)
      expect(response.files![0].content).toContain('export default')
    })

    it('should generate API route for API tasks', async () => {
      const task = makeTask({ title: '创建用户 API' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].path).toContain('/api/')
      expect(response.files![0].content).toContain('POST')
      expect(response.files![0].content).toContain('GET')
    })

    it('should generate API route for 接口 tasks', async () => {
      const task = makeTask({ title: '数据接口' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].path).toContain('/api/')
    })

    it('should generate generic component for non-form non-API tasks', async () => {
      const task = makeTask({ title: 'Dashboard widget' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].path).toMatch(/\.tsx$/)
      expect(response.files![0].content).toContain('export default')
    })

    it('should generate component path using PascalCase', async () => {
      const task = makeTask({ title: 'create login form' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].path).toContain('CreateLoginForm')
    })

    it('should generate API path using kebab-case', async () => {
      const task = makeTask({ title: 'Create User API' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].path).toMatch(/\/api\/[a-z-]+\//)
    })

    it('should set action to create for all generated files', async () => {
      const task = makeTask({ title: 'Some component' })
      const response = await devAgent.execute(task, mockContext)
      response.files!.forEach(f => {
        expect(f.action).toBe('create')
      })
    })
  })

  describe('generateFormComponent', () => {
    it('should include "use client" directive', async () => {
      const task = makeTask({ title: 'User form' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('"use client"')
    })

    it('should include React useState import', async () => {
      const task = makeTask({ title: 'Form input' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('useState')
    })

    it('should include form submit handler', async () => {
      const task = makeTask({ title: 'Login form' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('handleSubmit')
      expect(response.files![0].content).toContain('e.preventDefault')
    })

    it('should use the PascalCase component name', async () => {
      const task = makeTask({ title: 'My special form' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('function MySpecialForm')
    })

    it('should include Tailwind CSS classes', async () => {
      const task = makeTask({ title: 'Styled form' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('className')
    })
  })

  describe('generateAPIRoute', () => {
    it('should include both GET and POST handlers', async () => {
      const task = makeTask({ title: 'Data API' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('export async function POST')
      expect(response.files![0].content).toContain('export async function GET')
    })

    it('should include NextRequest and NextResponse imports', async () => {
      const task = makeTask({ title: 'Endpoint API' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('NextRequest')
      expect(response.files![0].content).toContain('NextResponse')
    })

    it('should include try-catch error handling', async () => {
      const task = makeTask({ title: 'Safe API' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('try')
      expect(response.files![0].content).toContain('catch')
    })

    it('should return 500 on error', async () => {
      const task = makeTask({ title: 'API route' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('500')
    })

    it('should reference task title in API response', async () => {
      const task = makeTask({ title: 'User Data API' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('User Data API')
    })
  })

  describe('generateGenericComponent', () => {
    it('should include task title in component', async () => {
      const task = makeTask({ title: 'Info Card' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('Info Card')
    })

    it('should include task description in component', async () => {
      const task = makeTask({ title: 'Widget', description: 'A useful widget' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('A useful widget')
    })

    it('should use PascalCase function name', async () => {
      const task = makeTask({ title: 'status indicator' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files![0].content).toContain('function StatusIndicator')
    })
  })

  describe('generateImplementationMessage', () => {
    it('should include task title', async () => {
      const task = makeTask({ title: 'My Feature' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.message).toContain('My Feature')
    })

    it('should mention file path when code generated', async () => {
      const task = makeTask({ title: 'Component' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.message).toMatch(/src\//)
    })

    it('should mention key features in message', async () => {
      const task = makeTask({ title: 'Form' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.message).toContain('响应式设计')
      expect(response.message).toContain('表单验证')
      expect(response.message).toContain('错误处理')
    })

    it('should request review from Reviewer Claw', async () => {
      const task = makeTask({ title: 'Something' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.message).toContain('Reviewer Claw')
      expect(response.message).toContain('审查')
    })

    it('should work when code is null', async () => {
      const task = makeTask({ title: 'Empty task' })
      const genMsg = (devAgent as any).generateImplementationMessage(task, null)
      expect(genMsg).toContain('Empty task')
    })
  })

  describe('mode management', () => {
    it('should default to mock mode when no LLM or gateway available', () => {
      const agent = new DevAgent({ mode: 'mock' })
      expect(agent.getMode()).toBe('mock')
    })

    it('should allow switching modes at runtime', () => {
      devAgent.setMode('openclaw')
      expect(devAgent.getMode()).toBe('openclaw')

      devAgent.setMode('llm')
      expect(devAgent.getMode()).toBe('llm')

      devAgent.setMode('mock')
      expect(devAgent.getMode()).toBe('mock')
    })

    it('should execute in mock mode when set to mock', async () => {
      devAgent.setMode('mock')
      const task = makeTask({ title: 'Form component' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.files).toBeDefined()
      expect(response.files!.length).toBeGreaterThan(0)
    })
  })

  describe('OpenClaw mode edge cases', () => {
    let mockExecutor: jest.Mocked<OpenClawAgentExecutor>

    beforeEach(() => {
      mockExecutor = {
        connect: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(false),
        executeDevAgent: jest.fn(),
      } as any

      devAgent = new DevAgent({ mode: 'openclaw', executor: mockExecutor })
    })

    it('should connect executor if not connected', async () => {
      mockExecutor.isConnected.mockReturnValue(false)
      mockExecutor.executeDevAgent.mockResolvedValue({
        success: true,
        content: 'done',
      })

      await devAgent.execute(makeTask(), mockContext)
      expect(mockExecutor.connect).toHaveBeenCalled()
    })

    it('should not reconnect if already connected', async () => {
      mockExecutor.isConnected.mockReturnValue(true)
      mockExecutor.executeDevAgent.mockResolvedValue({
        success: true,
        content: 'done',
      })

      await devAgent.execute(makeTask(), mockContext)
      expect(mockExecutor.connect).not.toHaveBeenCalled()
    })

    it('should include session metadata on success', async () => {
      mockExecutor.executeDevAgent.mockResolvedValue({
        success: true,
        sessionKey: 'agent:main:acp:test',
        runId: 'run-abc',
        content: '```json\n{"files":[],"message":"ok"}\n```',
      })

      const response = await devAgent.execute(makeTask(), mockContext)
      expect(response.metadata?.sessionKey).toBe('agent:main:acp:test')
      expect(response.metadata?.runId).toBe('run-abc')
      expect(response.metadata?.mode).toBe('openclaw')
    })

    it('should fallback to mock when executor throws', async () => {
      mockExecutor.executeDevAgent.mockRejectedValue(new Error('Network error'))

      const response = await devAgent.execute(makeTask(), mockContext)
      expect(response.status).toBe('success')
      expect(response.files).toBeDefined()
    })

    it('should handle multiple code blocks of different languages', async () => {
      mockExecutor.executeDevAgent.mockResolvedValue({
        success: true,
        content: '```\nconst x = 1\n```\n```tsx\nexport default function Y() {}\n```',
      })

      const response = await devAgent.execute(makeTask(), mockContext)
      expect(response.files!.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('response structure validation', () => {
    it('should always return dev as agent', async () => {
      const response = await devAgent.execute(makeTask(), mockContext)
      expect(response.agent).toBe('dev')
    })

    it('should always set nextAgent to review', async () => {
      const response = await devAgent.execute(makeTask(), mockContext)
      expect(response.nextAgent).toBe('review')
    })

    it('should always return success status', async () => {
      const response = await devAgent.execute(makeTask(), mockContext)
      expect(response.status).toBe('success')
    })
  })

  describe('edge cases', () => {
    it('should handle empty task title', async () => {
      const task = makeTask({ title: '' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.status).toBe('success')
    })

    it('should handle empty description', async () => {
      const task = makeTask({ description: '' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.status).toBe('success')
    })

    it('should handle special characters in title', async () => {
      const task = makeTask({ title: 'Component <>&"\'` ' })
      const response = await devAgent.execute(task, mockContext)
      expect(response.status).toBe('success')
    })

    it('should handle very long title', async () => {
      const task = makeTask({ title: 'x'.repeat(500) })
      const response = await devAgent.execute(task, mockContext)
      expect(response.status).toBe('success')
    })

    it('should handle concurrent executions', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        devAgent.execute(makeTask({ id: `concurrent-${i}`, title: `Task ${i}` }), mockContext)
      )
      const results = await Promise.all(promises)
      results.forEach(r => {
        expect(r.status).toBe('success')
        expect(r.agent).toBe('dev')
      })
    })

    it('should handle context with existing files', async () => {
      mockContext.files = {
        'src/existing.ts': 'existing code',
      }
      const response = await devAgent.execute(makeTask(), mockContext)
      expect(response.status).toBe('success')
    })

    it('should handle context with chat history', async () => {
      mockContext.chatHistory = [
        { agent: 'user', content: 'Build something' },
        { agent: 'pm', content: 'Here is the plan' },
      ]
      const response = await devAgent.execute(makeTask(), mockContext)
      expect(response.status).toBe('success')
    })
  })

  describe('LLM system prompt', () => {
    it('should include Next.js and TypeScript stack', () => {
      const prompt = (devAgent as any).getLLMSystemPrompt()
      expect(prompt).toContain('Next.js')
      expect(prompt).toContain('TypeScript')
      expect(prompt).toContain('React')
      expect(prompt).toContain('Tailwind')
    })

    it('should request JSON response format', () => {
      const prompt = (devAgent as any).getLLMSystemPrompt()
      expect(prompt).toContain('JSON')
      expect(prompt).toContain('files')
      expect(prompt).toContain('path')
      expect(prompt).toContain('content')
    })
  })
})
