// PM Claw 测试

import { PMAgent } from '../pm-agent'
import { Task, AgentContext } from '../types'

describe('PMAgent', () => {
  let pmAgent: PMAgent
  let mockTask: Task
  let mockContext: AgentContext

  beforeEach(() => {
    pmAgent = new PMAgent()

    mockTask = {
      id: 'test-task-1',
      title: '创建登录页面',
      description: '用户需要一个登录页面，包含邮箱和密码输入',
      status: 'pending',
      assignedTo: 'pm',
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
    expect(pmAgent.id).toBe('pm-agent-1')
    expect(pmAgent.name).toBe('PM Claw')
    expect(pmAgent.role).toBe('pm')
  })

  it('应该能分析任务并生成子任务', async () => {
    const response = await pmAgent.execute(mockTask, mockContext)

    expect(response.agent).toBe('pm')
    expect(response.message).toContain('登录页面')
    expect(response.tasks).toBeDefined()
    expect(response.tasks!.length).toBeGreaterThan(0)
    expect(response.nextAgent).toBe('dev')
    expect(response.status).toBe('success')
  })

  it('应该为表单相关任务生成正确的子任务', async () => {
    mockTask.description = '创建一个注册表单'

    const response = await pmAgent.execute(mockTask, mockContext)

    expect(response.tasks).toBeDefined()
    const taskTitles = response.tasks!.map(t => t.title.toLowerCase())
    expect(taskTitles.some(t => t.includes('表单') || t.includes('form'))).toBe(true)
  })

  it('应该为 API 相关任务生成正确的子任务', async () => {
    mockTask.description = '创建用户登录 API 接口'

    const response = await pmAgent.execute(mockTask, mockContext)

    expect(response.tasks).toBeDefined()
    const taskTitles = response.tasks!.map(t => t.title.toLowerCase())
    expect(taskTitles.some(t => t.includes('api') || t.includes('接口'))).toBe(true)
  })

  it('应该为测试相关任务生成正确的子任务', async () => {
    mockTask.description = '添加单元测试'

    const response = await pmAgent.execute(mockTask, mockContext)

    expect(response.tasks).toBeDefined()
    const taskTitles = response.tasks!.map(t => t.title.toLowerCase())
    expect(taskTitles.some(t => t.includes('测试') || t.includes('test'))).toBe(true)
  })

  it('生成的子任务应该分配给 Dev Claw', async () => {
    const response = await pmAgent.execute(mockTask, mockContext)

    response.tasks!.forEach(task => {
      expect(task.assignedTo).toBe('dev')
    })
  })
})
