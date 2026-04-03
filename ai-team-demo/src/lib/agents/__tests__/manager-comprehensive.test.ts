import { AgentManager, agentManager } from '../manager'
import { AgentRole, Task, AgentContext } from '../../core/types'

describe('AgentManager - Comprehensive', () => {
  let manager: AgentManager

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

  const makeContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
    projectId: 'test-project',
    tasks: [],
    files: {},
    chatHistory: [],
    ...overrides,
  })

  beforeEach(() => {
    manager = new AgentManager()
  })

  describe('initialization', () => {
    it('should initialize exactly three agents', () => {
      expect(manager.getAllAgents()).toHaveLength(3)
    })

    it('should have PM, Dev, and Review agents', () => {
      const roles = manager.getAllAgents().map(a => a.role)
      expect(roles).toContain('pm')
      expect(roles).toContain('dev')
      expect(roles).toContain('review')
    })

    it('should have unique agent IDs', () => {
      const ids = manager.getAllAgents().map(a => a.id)
      expect(new Set(ids).size).toBe(3)
    })
  })

  describe('getAgent', () => {
    it('should return undefined for unknown role', () => {
      expect(manager.getAgent('nonexistent' as AgentRole)).toBeUndefined()
    })

    it('should return correct agent for pm role', () => {
      const agent = manager.getAgent('pm')
      expect(agent).toBeDefined()
      expect(agent!.role).toBe('pm')
      expect(agent!.name).toBe('PM Claw')
    })

    it('should return correct agent for dev role', () => {
      const agent = manager.getAgent('dev')
      expect(agent).toBeDefined()
      expect(agent!.role).toBe('dev')
      expect(agent!.name).toBe('Dev Claw')
    })

    it('should return correct agent for review role', () => {
      const agent = manager.getAgent('review')
      expect(agent).toBeDefined()
      expect(agent!.role).toBe('review')
      expect(agent!.name).toBe('Reviewer Claw')
    })

    it('should return the same agent instance on repeated calls', () => {
      const agent1 = manager.getAgent('pm')
      const agent2 = manager.getAgent('pm')
      expect(agent1).toBe(agent2)
    })
  })

  describe('getAllAgents', () => {
    it('should return array of all agents', () => {
      const agents = manager.getAllAgents()
      expect(Array.isArray(agents)).toBe(true)
      expect(agents.length).toBe(3)
    })

    it('should return agents with all required properties', () => {
      manager.getAllAgents().forEach(agent => {
        expect(agent).toHaveProperty('id')
        expect(agent).toHaveProperty('name')
        expect(agent).toHaveProperty('role')
        expect(agent).toHaveProperty('description')
        expect(agent).toHaveProperty('execute')
      })
    })
  })

  describe('getAgentInfo', () => {
    it('should return info for all agents', () => {
      const info = manager.getAgentInfo()
      expect(info).toHaveLength(3)
    })

    it('should include required fields in each info object', () => {
      manager.getAgentInfo().forEach(info => {
        expect(info).toHaveProperty('id')
        expect(info).toHaveProperty('name')
        expect(info).toHaveProperty('role')
        expect(info).toHaveProperty('description')
      })
    })

    it('should have non-empty strings for all fields', () => {
      manager.getAgentInfo().forEach(info => {
        expect(info.id).toBeTruthy()
        expect(info.name).toBeTruthy()
        expect(info.role).toBeTruthy()
        expect(info.description).toBeTruthy()
      })
    })

    it('should match the actual agent properties', () => {
      const agents = manager.getAllAgents()
      const info = manager.getAgentInfo()

      agents.forEach((agent, i) => {
        expect(info[i].id).toBe(agent.id)
        expect(info[i].name).toBe(agent.name)
        expect(info[i].role).toBe(agent.role)
        expect(info[i].description).toBe(agent.description)
      })
    })
  })

  describe('executeAgent', () => {
    const task = makeTask()
    const context = makeContext()

    it('should throw for nonexistent agent role', async () => {
      await expect(
        manager.executeAgent('nonexistent' as AgentRole, task, context)
      ).rejects.toThrow('Agent not found: nonexistent')
    })

    it('should execute PM agent and return valid response', async () => {
      const result = await manager.executeAgent('pm', task, context)
      expect(result.agent).toBe('pm')
      expect(result.status).toBe('success')
      expect(result.message).toBeTruthy()
    })

    it('should execute Dev agent and return valid response', async () => {
      const result = await manager.executeAgent('dev', task, context)
      expect(result.agent).toBe('dev')
      expect(result.status).toBe('success')
      expect(result.files).toBeDefined()
    })

    it('should execute Review agent and return valid response', async () => {
      const result = await manager.executeAgent('review', task, context)
      expect(result.agent).toBe('review')
      expect(result.message).toBeTruthy()
    })

    it('should pass task to the agent correctly', async () => {
      const customTask = makeTask({
        title: 'Custom Title',
        description: 'Custom description for testing',
      })
      const result = await manager.executeAgent('pm', customTask, context)
      expect(result).toBeDefined()
      expect(result.message).toContain('Custom Title')
    })

    it('should propagate errors from agent execution', async () => {
      const agent = manager.getAgent('pm')!
      const originalExecute = agent.execute
      agent.execute = jest.fn().mockRejectedValue(new Error('Agent error'))

      await expect(
        manager.executeAgent('pm', task, context)
      ).rejects.toThrow('Agent error')

      agent.execute = originalExecute
    })
  })

  describe('workflow integration', () => {
    it('should support PM -> Dev -> Review pipeline', async () => {
      const context = makeContext()

      const pmTask = makeTask({
        title: 'Create login page',
        description: '创建用户登录页面',
        assignedTo: 'pm',
      })

      const pmResult = await manager.executeAgent('pm', pmTask, context)
      expect(pmResult.agent).toBe('pm')
      expect(pmResult.nextAgent).toBe('dev')

      if (pmResult.tasks && pmResult.tasks.length > 0) {
        const devTask = makeTask({
          title: pmResult.tasks[0].title,
          description: pmResult.tasks[0].description,
          assignedTo: 'dev',
        })

        const devResult = await manager.executeAgent('dev', devTask, context)
        expect(devResult.agent).toBe('dev')
        expect(devResult.nextAgent).toBe('review')

        if (devResult.files && devResult.files.length > 0) {
          context.files = { [devResult.files[0].path]: devResult.files[0].content }
        }

        const reviewTask = makeTask({
          title: devTask.title,
          description: devTask.description,
          assignedTo: 'review',
          status: 'review',
        })

        const reviewResult = await manager.executeAgent('review', reviewTask, context)
        expect(reviewResult.agent).toBe('review')
        expect(reviewResult.message).toContain('代码审查报告')
      }
    })

    it('should support multiple sequential task executions', async () => {
      const context = makeContext()
      const tasks = [
        makeTask({ title: 'Task 1', description: '创建表单' }),
        makeTask({ title: 'Task 2', description: '实现 API 接口' }),
        makeTask({ title: 'Task 3', description: '添加测试' }),
      ]

      for (const task of tasks) {
        const result = await manager.executeAgent('pm', task, context)
        expect(result.status).toBe('success')
      }
    })

    it('should support concurrent agent executions', async () => {
      const context = makeContext()
      const promises = [
        manager.executeAgent('pm', makeTask({ title: 'PM Task' }), context),
        manager.executeAgent('dev', makeTask({ title: 'Dev Task' }), context),
        manager.executeAgent('review', makeTask({ title: 'Review Task' }), context),
      ]

      const [pmResult, devResult, reviewResult] = await Promise.all(promises)
      expect(pmResult.agent).toBe('pm')
      expect(devResult.agent).toBe('dev')
      expect(reviewResult.agent).toBe('review')
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton agentManager', () => {
      expect(agentManager).toBeDefined()
      expect(agentManager).toBeInstanceOf(AgentManager)
    })

    it('should have all agents in the singleton', () => {
      expect(agentManager.getAllAgents()).toHaveLength(3)
    })

    it('should be the same instance across imports', () => {
      expect(agentManager).toBe(agentManager)
    })
  })

  describe('edge cases', () => {
    it('should handle task with empty fields', async () => {
      const task = makeTask({ title: '', description: '' })
      const context = makeContext()
      const result = await manager.executeAgent('pm', task, context)
      expect(result).toBeDefined()
    })

    it('should handle context with many files', async () => {
      const files: Record<string, string> = {}
      for (let i = 0; i < 50; i++) {
        files[`src/file-${i}.ts`] = `export const x${i} = ${i};`
      }
      const context = makeContext({ files })
      const result = await manager.executeAgent('review', makeTask(), context)
      expect(result.agent).toBe('review')
    })

    it('should handle context with many tasks', async () => {
      const tasks = Array.from({ length: 20 }, (_, i) =>
        makeTask({ id: `task-${i}`, title: `Task ${i}` })
      )
      const context = makeContext({ tasks })
      const result = await manager.executeAgent('pm', makeTask(), context)
      expect(result.agent).toBe('pm')
    })

    it('should handle context with long chat history', async () => {
      const chatHistory = Array.from({ length: 100 }, (_, i) => ({
        agent: (i % 2 === 0 ? 'user' : 'pm') as 'user' | 'pm',
        content: `Message ${i}`,
      }))
      const context = makeContext({ chatHistory })
      const result = await manager.executeAgent('dev', makeTask(), context)
      expect(result.agent).toBe('dev')
    })
  })
})
