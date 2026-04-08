import { DevAgent, DevAgentMode } from '../dev-agent'
import { Task, AgentContext } from '../types'
import { getLLMProvider, setLLMProvider } from '../../llm/factory'
import { LLMProvider, ChatMessage } from '../../llm/types'

jest.mock('../../gateway/executor', () => ({
  getAgentExecutor: jest.fn(),
  OpenClawAgentExecutor: jest.fn(),
}))

const createMockLLM = (chatFn: (messages: ChatMessage[]) => Promise<string>): LLMProvider => ({
  chat: chatFn,
})

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-llm-1',
  title: 'Create user profile component',
  description: 'Build a user profile card with avatar and info',
  status: 'pending',
  assignedTo: 'dev',
  dependencies: [],
  files: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeContext = (): AgentContext => ({
  projectId: 'test-project',
  tasks: [],
  files: {},
  chatHistory: [],
})

describe('DevAgent - LLM Mode Integration', () => {
  let devAgent: DevAgent
  let mockContext: AgentContext
  let originalEnv: NodeJS.ProcessEnv

  beforeAll(() => {
    originalEnv = process.env
  })

  afterAll(() => {
    process.env = originalEnv
  })

  beforeEach(() => {
    jest.clearAllMocks()
    devAgent = new DevAgent({ mode: 'llm' })
    mockContext = makeContext()
  })

  afterEach(() => {
    setLLMProvider(null as any)
  })

  describe('detectMode', () => {
    it('should return openclaw when USE_OPENCLAW_GATEWAY is true', () => {
      process.env = { ...originalEnv, USE_OPENCLAW_GATEWAY: 'true' }
      const agent = new DevAgent()
      expect(agent.getMode()).toBe('openclaw')
      process.env = originalEnv
    })

    it('should return llm when LLM provider is available', () => {
      process.env = { ...originalEnv }
      const mockLLM = createMockLLM(async () => 'response')
      setLLMProvider(mockLLM)
      const agent = new DevAgent()
      expect(agent.getMode()).toBe('llm')
    })

    it('should return mock when no gateway and no LLM provider', () => {
      process.env = { ...originalEnv }
      setLLMProvider(null as any)
      delete process.env.USE_OPENCLAW_GATEWAY
      delete process.env.GLM_API_KEY
      delete process.env.OPENAI_API_KEY
      delete process.env.USE_MOCK_LLM
      delete process.env.USE_REAL_GATEWAY
      const agent = new DevAgent()
      expect(agent.getMode()).toBe('mock')
    })
  })

  describe('execute - LLM mode routing', () => {
    it('should fallback to mock when LLM provider is null in execute', async () => {
      setLLMProvider(null as any)
      const task = makeTask()
      const response = await devAgent.execute(task, mockContext)

      expect(response.agent).toBe('dev')
      expect(response.status).toBe('success')
      expect(response.files).toBeDefined()
    })
  })

  describe('implementWithLLM - happy path', () => {
    it('should parse valid JSON response and return files', async () => {
      const llmResponse = JSON.stringify({
        files: [
          {
            path: 'src/components/UserProfile.tsx',
            content: 'export default function UserProfile() { return <div>Profile</div> }',
            action: 'create',
          },
        ],
        message: 'User profile component implemented',
      })
      const mockLLM = createMockLLM(async () => llmResponse)
      setLLMProvider(mockLLM)

      const task = makeTask()
      const response = await devAgent.execute(task, mockContext)

      expect(response.agent).toBe('dev')
      expect(response.status).toBe('success')
      expect(response.nextAgent).toBe('review')
      expect(response.files).toHaveLength(1)
      expect(response.files![0].path).toBe('src/components/UserProfile.tsx')
      expect(response.files![0].content).toContain('UserProfile')
      expect(response.files![0].action).toBe('create')
      expect(response.message).toBe('User profile component implemented')
    })

    it('should handle multiple files in LLM response', async () => {
      const llmResponse = JSON.stringify({
        files: [
          {
            path: 'src/components/UserCard.tsx',
            content: 'export default function UserCard() {}',
            action: 'create',
          },
          {
            path: 'src/hooks/useUser.ts',
            content: 'export function useUser() {}',
            action: 'create',
          },
          {
            path: 'src/types/user.ts',
            content: 'export interface User {}',
            action: 'create',
          },
        ],
        message: 'Three files generated',
      })
      const mockLLM = createMockLLM(async () => llmResponse)
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.files).toHaveLength(3)
      expect(response.files!.map((f) => f.path)).toEqual([
        'src/components/UserCard.tsx',
        'src/hooks/useUser.ts',
        'src/types/user.ts',
      ])
    })

    it('should handle response with optional analysis and notes fields', async () => {
      const llmResponse = JSON.stringify({
        analysis: 'Need to create a profile card component',
        files: [
          {
            path: 'src/Profile.tsx',
            content: 'export default function Profile() {}',
            action: 'create',
          },
        ],
        message: 'Done',
        notes: ['Used Tailwind for styling', 'Added TypeScript types'],
      })
      const mockLLM = createMockLLM(async () => llmResponse)
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.files).toHaveLength(1)
      expect(response.status).toBe('success')
    })

    it('should handle response with modify action', async () => {
      const llmResponse = JSON.stringify({
        files: [
          {
            path: 'src/existing.tsx',
            content: 'export default function Updated() {}',
            action: 'modify',
          },
        ],
        message: 'File modified',
      })
      const mockLLM = createMockLLM(async () => llmResponse)
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.files![0].action).toBe('modify')
    })

    it('should handle response with default create action', async () => {
      const llmResponse = JSON.stringify({
        files: [
          {
            path: 'src/new.tsx',
            content: 'export default function New() {}',
          },
        ],
        message: 'Created',
      })
      const mockLLM = createMockLLM(async () => llmResponse)
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.files![0].action).toBe('create')
    })

    it('should handle response with empty files array', async () => {
      const llmResponse = JSON.stringify({
        files: [],
        message: 'No files needed, just analysis',
      })
      const mockLLM = createMockLLM(async () => llmResponse)
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.files).toHaveLength(0)
      expect(response.message).toBe('No files needed, just analysis')
    })

    it('should pass sanitized task prompt to LLM', async () => {
      let capturedMessages: ChatMessage[] = []
      const mockLLM = createMockLLM(async (messages) => {
        capturedMessages = messages
        return JSON.stringify({ files: [], message: 'ok' })
      })
      setLLMProvider(mockLLM)

      const task = makeTask({ title: 'Build feature', description: 'A cool feature' })
      await devAgent.execute(task, mockContext)

      expect(capturedMessages).toHaveLength(2)
      expect(capturedMessages[0].role).toBe('system')
      expect(capturedMessages[0].content).toContain('Dev Claw')
      expect(capturedMessages[0].content).toContain('Next.js')
      expect(capturedMessages[1].role).toBe('user')
      expect(capturedMessages[1].content).toContain('<task_input>')
      expect(capturedMessages[1].content).toContain('Build feature')
      expect(capturedMessages[1].content).toContain('A cool feature')
    })
  })

  describe('implementWithLLM - null response fallback', () => {
    it('should fallback to mock when LLM returns null', async () => {
      const mockLLM = createMockLLM(async () => null as any)
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.status).toBe('success')
      expect(response.agent).toBe('dev')
      expect(response.nextAgent).toBe('review')
    })

    it('should return mock-generated files when LLM returns null', async () => {
      const mockLLM = createMockLLM(async () => null as any)
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.files).toBeDefined()
      expect(response.files!.length).toBeGreaterThan(0)
    })
  })

  describe('implementWithLLM - parse failure fallback', () => {
    it('should fallback to mock when LLM returns non-JSON', async () => {
      const mockLLM = createMockLLM(async () => 'This is not JSON, just plain text')
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.status).toBe('success')
      expect(response.files).toBeDefined()
    })

    it('should fallback to mock when LLM returns JSON without required fields', async () => {
      const mockLLM = createMockLLM(async () => JSON.stringify({ random: 'data' }))
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.status).toBe('success')
      expect(response.files).toBeDefined()
    })

    it('should fallback to mock when files have invalid action', async () => {
      const mockLLM = createMockLLM(async () =>
        JSON.stringify({
          files: [{ path: 'a.ts', content: 'code', action: 'delete' }],
          message: 'bad action',
        })
      )
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.status).toBe('success')
      expect(response.files).toBeDefined()
    })

    it('should fallback to mock when message is missing', async () => {
      const mockLLM = createMockLLM(async () =>
        JSON.stringify({
          files: [{ path: 'a.ts', content: 'code', action: 'create' }],
        })
      )
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.status).toBe('success')
      expect(response.files).toBeDefined()
    })

    it('should fallback to mock when file path is empty', async () => {
      const mockLLM = createMockLLM(async () =>
        JSON.stringify({
          files: [{ path: '', content: 'code', action: 'create' }],
          message: 'empty path',
        })
      )
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.status).toBe('success')
      expect(response.files).toBeDefined()
    })
  })

  describe('implementWithLLM - exception fallback', () => {
    it('should fallback to mock when LLM throws error', async () => {
      const mockLLM = createMockLLM(async () => {
        throw new Error('Network timeout')
      })
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.status).toBe('success')
      expect(response.agent).toBe('dev')
      expect(response.files).toBeDefined()
    })

    it('should fallback to mock when LLM throws non-Error', async () => {
      const mockLLM = createMockLLM(async () => {
        throw 'string error'
      })
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.status).toBe('success')
    })

    it('should log error message on LLM failure', async () => {
      const logSpy = jest.spyOn(
        Object.getPrototypeOf(devAgent),
        'log'
      )
      const mockLLM = createMockLLM(async () => {
        throw new Error('Rate limit exceeded')
      })
      setLLMProvider(mockLLM)

      await devAgent.execute(makeTask(), mockContext)

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('LLM 调用失败')
      )
    })
  })

  describe('implementWithLLM - prompt construction', () => {
    it('should include system prompt with tech stack requirements', async () => {
      let capturedMessages: ChatMessage[] = []
      const mockLLM = createMockLLM(async (messages) => {
        capturedMessages = messages
        return JSON.stringify({ files: [], message: 'ok' })
      })
      setLLMProvider(mockLLM)

      await devAgent.execute(makeTask(), mockContext)

      const systemPrompt = capturedMessages[0].content
      expect(systemPrompt).toContain('Dev Claw')
      expect(systemPrompt).toContain('Next.js 14')
      expect(systemPrompt).toContain('React')
      expect(systemPrompt).toContain('TypeScript')
      expect(systemPrompt).toContain('Tailwind')
      expect(systemPrompt).toContain('JSON')
    })

    it('should sanitize task input in user prompt', async () => {
      let capturedMessages: ChatMessage[] = []
      const mockLLM = createMockLLM(async (messages) => {
        capturedMessages = messages
        return JSON.stringify({ files: [], message: 'ok' })
      })
      setLLMProvider(mockLLM)

      const task = makeTask({
        title: 'Build auth',
        description: 'Login system',
      })
      await devAgent.execute(task, mockContext)

      const userPrompt = capturedMessages[1].content
      expect(userPrompt).toContain('<task_input>')
      expect(userPrompt).toContain('Build auth')
      expect(userPrompt).toContain('Login system')
    })

    it('should request JSON format in user prompt', async () => {
      let capturedMessages: ChatMessage[] = []
      const mockLLM = createMockLLM(async (messages) => {
        capturedMessages = messages
        return JSON.stringify({ files: [], message: 'ok' })
      })
      setLLMProvider(mockLLM)

      await devAgent.execute(makeTask(), mockContext)

      expect(capturedMessages[1].content).toContain('JSON')
    })
  })

  describe('implementWithLLM - edge cases', () => {
    it('should handle LLM response with extra whitespace around JSON', async () => {
      const llmResponse = `
        Here is the implementation:
        ${JSON.stringify({
          files: [
            { path: 'src/a.tsx', content: 'code', action: 'create' as const },
          ],
          message: 'Done',
        })}
        Let me know if you need changes.
      `
      const mockLLM = createMockLLM(async () => llmResponse)
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.files).toHaveLength(1)
      expect(response.status).toBe('success')
    })

    it('should handle LLM response with JSON embedded in markdown', async () => {
      const llmResponse = '```json\n' +
        JSON.stringify({
          files: [
            { path: 'src/b.ts', content: 'export const b = 1', action: 'create' as const },
          ],
          message: 'Created b.ts',
        }) +
        '\n```'
      const mockLLM = createMockLLM(async () => llmResponse)
      setLLMProvider(mockLLM)

      const response = await devAgent.execute(makeTask(), mockContext)

      expect(response.files).toHaveLength(1)
      expect(response.files![0].path).toBe('src/b.ts')
    })

    it('should handle task with special characters in title', async () => {
      const mockLLM = createMockLLM(async () =>
        JSON.stringify({
          files: [{ path: 'src/a.tsx', content: 'code', action: 'create' }],
          message: 'ok',
        })
      )
      setLLMProvider(mockLLM)

      const task = makeTask({ title: 'Create <script>alert("xss")</script> component' })
      const response = await devAgent.execute(task, mockContext)

      expect(response.status).toBe('success')
    })

    it('should handle task with very long description', async () => {
      const mockLLM = createMockLLM(async () =>
        JSON.stringify({
          files: [{ path: 'src/long.ts', content: 'code', action: 'create' }],
          message: 'ok',
        })
      )
      setLLMProvider(mockLLM)

      const task = makeTask({ description: 'x'.repeat(10000) })
      const response = await devAgent.execute(task, mockContext)

      expect(response.status).toBe('success')
    })

    it('should handle concurrent LLM requests', async () => {
      let callCount = 0
      const mockLLM = createMockLLM(async () => {
        callCount++
        return JSON.stringify({
          files: [{ path: `src/file-${callCount}.ts`, content: `// ${callCount}`, action: 'create' }],
          message: `File ${callCount}`,
        })
      })
      setLLMProvider(mockLLM)

      const promises = Array.from({ length: 5 }, (_, i) =>
        devAgent.execute(makeTask({ id: `concurrent-${i}`, title: `Task ${i}` }), mockContext)
      )
      const results = await Promise.all(promises)

      results.forEach((r) => {
        expect(r.status).toBe('success')
        expect(r.agent).toBe('dev')
      })
      expect(callCount).toBe(5)
    })
  })
})
