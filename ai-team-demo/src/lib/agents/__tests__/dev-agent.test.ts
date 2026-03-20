// Dev Claw 测试

import { DevAgent, DevAgentMode } from '../dev-agent'
import { Task, AgentContext } from '../types'
import { OpenClawAgentExecutor } from '../../gateway/executor'

jest.mock('../../gateway/executor', () => ({
  getAgentExecutor: jest.fn(),
  OpenClawAgentExecutor: jest.fn()
}))

describe('DevAgent', () => {
  let devAgent: DevAgent
  let mockTask: Task
  let mockContext: AgentContext

  beforeEach(() => {
    devAgent = new DevAgent({ mode: 'mock' })

    mockTask = {
      id: 'test-task-1',
      title: '创建登录表单组件',
      description: '实现用户登录表单，包含邮箱和密码输入',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockContext = {
      projectId: 'test-project',
      tasks: [],
      files: {},
      chatHistory: []
    }
  })

  it('应该正确初始化', () => {
    expect(devAgent.id).toBe('dev-agent-1')
    expect(devAgent.name).toBe('Dev Claw')
    expect(devAgent.role).toBe('dev')
  })

  it('应该能实现任务并生成代码', async () => {
    const response = await devAgent.execute(mockTask, mockContext)

    expect(response.agent).toBe('dev')
    expect(response.message).toContain('登录表单组件')
    expect(response.files).toBeDefined()
    expect(response.files!.length).toBeGreaterThan(0)
    expect(response.nextAgent).toBe('review')
    expect(response.status).toBe('success')
  })

  it('应该为表单任务生成 React 组件', async () => {
    const response = await devAgent.execute(mockTask, mockContext)

    expect(response.files).toBeDefined()
    const file = response.files![0]
    expect(file.path).toMatch(/\.tsx$/)
    expect(file.content).toContain('export default')
    expect(file.action).toBe('create')
  })

  it('应该为 API 任务生成 API 路由', async () => {
    mockTask.title = '创建登录 API 接口'
    mockTask.description = '实现用户登录 API'

    const response = await devAgent.execute(mockTask, mockContext)

    expect(response.files).toBeDefined()
    const file = response.files![0]
    expect(file.path).toContain('/api/')
    expect(file.content).toContain('NextRequest')
    expect(file.content).toContain('NextResponse')
  })

  it('生成的表单组件应该包含必要的元素', async () => {
    const response = await devAgent.execute(mockTask, mockContext)

    const file = response.files![0]
    expect(file.content).toContain('useState')
    expect(file.content).toContain('onSubmit')
    expect(file.content).toContain('input')
  })

  it('应该包含消息说明实现内容', async () => {
    const response = await devAgent.execute(mockTask, mockContext)

    expect(response.message).toContain('完成')
    expect(response.message).toContain('审查')
  })

  describe('模式管理', () => {
    it('应该能设置和获取模式', () => {
      expect(devAgent.getMode()).toBe('mock')
      
      devAgent.setMode('openclaw')
      expect(devAgent.getMode()).toBe('openclaw')
      
      devAgent.setMode('llm')
      expect(devAgent.getMode()).toBe('llm')
    })
  })

  describe('OpenClaw 模式', () => {
    let mockExecutor: jest.Mocked<OpenClawAgentExecutor>

    beforeEach(() => {
      mockExecutor = {
        connect: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(false),
        executeDevAgent: jest.fn()
      } as any

      devAgent = new DevAgent({ mode: 'openclaw', executor: mockExecutor })
    })

    it('应该使用 OpenClaw 执行器', async () => {
      mockExecutor.executeDevAgent.mockResolvedValue({
        success: true,
        sessionKey: 'agent:main:acp:test',
        runId: 'run-123',
        content: '```typescript\nconst x = 1\n```\n实现完成'
      })

      const response = await devAgent.execute(mockTask, mockContext)

      expect(mockExecutor.connect).toHaveBeenCalled()
      expect(mockExecutor.executeDevAgent).toHaveBeenCalledWith(
        mockTask.title,
        mockTask.description
      )
      expect(response.status).toBe('success')
      expect(response.metadata?.mode).toBe('openclaw')
    })

    it('OpenClaw 失败时应该回退到 mock 模式', async () => {
      mockExecutor.executeDevAgent.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      })

      const response = await devAgent.execute(mockTask, mockContext)

      expect(response.status).toBe('success')
      expect(response.files).toBeDefined()
    })

    it('应该解析 OpenClaw 响应中的代码块', async () => {
      mockExecutor.executeDevAgent.mockResolvedValue({
        success: true,
        sessionKey: 'agent:main:acp:test',
        runId: 'run-456',
        content: `代码实现完成

\`\`\`tsx
export default function LoginForm() {
  return <div>Login</div>
}
\`\`\`

\`\`\`css
.login { color: blue; }
\`\`\`
`
      })

      const response = await devAgent.execute(mockTask, mockContext)

      expect(response.files).toHaveLength(2)
      expect(response.files![0].path).toContain('.tsx')
      expect(response.files![1].path).toContain('.css')
    })

    it('应该解析 OpenClaw 响应中的 JSON', async () => {
      mockExecutor.executeDevAgent.mockResolvedValue({
        success: true,
        sessionKey: 'agent:main:acp:test',
        runId: 'run-789',
        content: `实现完成

\`\`\`json
{
  "files": [{
    "path": "src/components/LoginForm.tsx",
    "content": "export default function LoginForm() { return <div>Login</div> }",
    "action": "create"
  }],
  "message": "登录表单实现完成"
}
\`\`\`
`
      })

      const response = await devAgent.execute(mockTask, mockContext)

      expect(response.files).toHaveLength(1)
      expect(response.files![0].path).toBe('src/components/LoginForm.tsx')
      expect(response.message).toContain('登录表单实现完成')
    })
  })
})
