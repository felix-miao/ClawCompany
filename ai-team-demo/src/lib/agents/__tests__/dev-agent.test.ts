// Dev Agent 测试

import { DevAgent } from '../dev-agent'
import { Task, AgentContext } from '../types'

describe('DevAgent', () => {
  let devAgent: DevAgent
  let mockTask: Task
  let mockContext: AgentContext

  beforeEach(() => {
    devAgent = new DevAgent()

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
    expect(devAgent.name).toBe('Dev Agent')
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
})
