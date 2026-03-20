// Reviewer Claw 测试

import { ReviewAgent } from '../review-agent'
import { Task, AgentContext } from '../types'

describe('ReviewAgent', () => {
  let reviewAgent: ReviewAgent
  let mockTask: Task
  let mockContext: AgentContext

  beforeEach(() => {
    reviewAgent = new ReviewAgent()

    mockTask = {
      id: 'test-task-1',
      title: '创建登录表单组件',
      description: '实现用户登录表单',
      status: 'review',
      assignedTo: 'review',
      dependencies: [],
      files: ['src/components/LoginForm.tsx'],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockContext = {
      projectId: 'test-project',
      tasks: [],
      files: {
        'src/components/LoginForm.tsx': 'export default function LoginForm() { return <form></form> }'
      },
      chatHistory: []
    }
  })

  it('应该正确初始化', () => {
    expect(reviewAgent.id).toBe('review-agent-1')
    expect(reviewAgent.name).toBe('Reviewer Claw')
    expect(reviewAgent.role).toBe('review')
  })

  it('应该能审查代码并生成报告', async () => {
    const response = await reviewAgent.execute(mockTask, mockContext)

    expect(response.agent).toBe('review')
    expect(response.message).toContain('代码审查报告')
    expect(response.message).toContain(mockTask.title)
    expect(response.status).toBeDefined()
  })

  it('审查报告应该包含检查项', async () => {
    const response = await reviewAgent.execute(mockTask, mockContext)

    expect(response.message).toContain('代码风格')
    expect(response.message).toContain('TypeScript')
    expect(response.message).toContain('错误处理')
    expect(response.message).toContain('可访问性')
  })

  it('如果通过审查，状态应该是 success', async () => {
    const response = await reviewAgent.execute(mockTask, mockContext)

    if (response.status === 'success') {
      expect(response.message).toContain('审查通过')
    }
  })

  it('如果需要修改，状态应该是 need_input', async () => {
    const response = await reviewAgent.execute(mockTask, mockContext)

    if (response.status === 'need_input') {
      expect(response.message).toContain('需要修改')
      expect(response.nextAgent).toBe('dev')
    }
  })

  it('通过审查后应该通知 PM Claw', async () => {
    const response = await reviewAgent.execute(mockTask, mockContext)

    if (response.status === 'success') {
      expect(response.message).toContain('PM Claw')
      expect(response.message).toContain('Done')
    }
  })
})
