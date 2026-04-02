// Agent Manager 测试

import { AgentManager } from '../manager'
import { AgentRole, Task, AgentContext } from '../../core/types'

describe('AgentManager', () => {
  let manager: AgentManager

  beforeEach(() => {
    manager = new AgentManager()
  })

  it('应该初始化三个 Agent', () => {
    const agents = manager.getAllAgents()
    expect(agents).toHaveLength(3)
  })

  it('应该能获取 PM Claw', () => {
    const pmAgent = manager.getAgent('pm')
    expect(pmAgent).toBeDefined()
    expect(pmAgent?.name).toBe('PM Claw')
    expect(pmAgent?.role).toBe('pm')
  })

  it('应该能获取 Dev Claw', () => {
    const devAgent = manager.getAgent('dev')
    expect(devAgent).toBeDefined()
    expect(devAgent?.name).toBe('Dev Claw')
    expect(devAgent?.role).toBe('dev')
  })

  it('应该能获取 Reviewer Claw', () => {
    const reviewAgent = manager.getAgent('review')
    expect(reviewAgent).toBeDefined()
    expect(reviewAgent?.name).toBe('Reviewer Claw')
    expect(reviewAgent?.role).toBe('review')
  })

  it('应该返回所有 Agent 信息', () => {
    const info = manager.getAgentInfo()
    expect(info).toHaveLength(3)
    expect(info[0]).toHaveProperty('id')
    expect(info[0]).toHaveProperty('name')
    expect(info[0]).toHaveProperty('role')
    expect(info[0]).toHaveProperty('description')
  })

  describe('executeAgent', () => {
    const mockTask: Task = {
      id: 'task-1',
      title: 'Test Task',
      description: 'A test task',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockContext: AgentContext = {
      projectId: 'test-project',
      tasks: [],
      files: {},
      chatHistory: [],
    }

    it('应该对不存在的 role 抛出错误', async () => {
      await expect(
        manager.executeAgent('nonexistent' as AgentRole, mockTask, mockContext)
      ).rejects.toThrow('Agent not found: nonexistent')
    })

    it('应该成功执行 PM agent', async () => {
      const result = await manager.executeAgent('pm', mockTask, mockContext)
      expect(result.agent).toBe('pm')
      expect(result.status).toBe('success')
    })

    it('应该成功执行 Dev agent', async () => {
      const result = await manager.executeAgent('dev', mockTask, mockContext)
      expect(result.agent).toBe('dev')
      expect(result.status).toBe('success')
    })

    it('应该成功执行 Review agent', async () => {
      const result = await manager.executeAgent('review', mockTask, mockContext)
      expect(result.agent).toBe('review')
    })

    it('应该传递正确的 task 和 context 给 agent', async () => {
      const customTask: Task = {
        ...mockTask,
        title: '创建登录表单',
        description: '实现用户登录功能',
      }

      const result = await manager.executeAgent('pm', customTask, mockContext)
      expect(result).toBeDefined()
      expect(result.message).toBeTruthy()
    })

    it('应该传播 agent 执行中的错误', async () => {
      const agent = manager.getAgent('pm')
      const originalExecute = agent!.execute.bind(agent!)
      agent!.execute = jest.fn().mockRejectedValue(new Error('Agent crashed'))

      await expect(
        manager.executeAgent('pm', mockTask, mockContext)
      ).rejects.toThrow('Agent crashed')

      agent!.execute = originalExecute
    })
  })
})
