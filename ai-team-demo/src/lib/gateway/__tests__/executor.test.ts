import { OpenClawAgentExecutor, AgentExecutionResult, getAgentExecutor, resetAgentExecutor } from '../executor'
import { OpenClawGatewayClient } from '../client'

jest.mock('../client', () => ({
  OpenClawGatewayClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    sessions_spawn: jest.fn(),
    sessions_history: jest.fn(),
    waitForCompletion: jest.fn()
  })),
  getGatewayClient: jest.fn()
}))

describe('OpenClawAgentExecutor', () => {
  let executor: OpenClawAgentExecutor
  let mockClient: jest.Mocked<OpenClawGatewayClient>

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = new OpenClawGatewayClient('') as jest.Mocked<OpenClawGatewayClient>
    executor = new OpenClawAgentExecutor(mockClient)
  })

  afterEach(async () => {
    await executor.disconnect()
  })

  describe('connect', () => {
    it('应该连接到 Gateway', async () => {
      await executor.connect()
      expect(mockClient.connect).toHaveBeenCalled()
      expect(executor.isConnected()).toBe(true)
    })

    it('重复连接应该只调用一次', async () => {
      await executor.connect()
      await executor.connect()
      expect(mockClient.connect).toHaveBeenCalledTimes(1)
    })
  })

  describe('disconnect', () => {
    it('应该断开连接', async () => {
      await executor.connect()
      await executor.disconnect()
      expect(mockClient.disconnect).toHaveBeenCalled()
      expect(executor.isConnected()).toBe(false)
    })
  })

  describe('executeAgent', () => {
    it('应该执行 PM Claw', async () => {
      mockClient.sessions_spawn.mockResolvedValue({
        status: 'accepted',
        runId: 'run-123',
        childSessionKey: 'agent:main:subagent:pm-abc'
      })

      mockClient.waitForCompletion.mockResolvedValue(JSON.stringify({
        analysis: 'Test analysis',
        tasks: [{ title: 'Task 1', description: 'Desc', assignedTo: 'dev' }]
      }))

      const result = await executor.executeAgent('pm', '创建登录功能')

      expect(result.success).toBe(true)
      expect(result.sessionKey).toBe('agent:main:subagent:pm-abc')
      expect(mockClient.sessions_spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'subagent',
          thinking: 'high'
        })
      )
    })

    it('应该执行 Dev Claw 使用 ACP runtime', async () => {
      mockClient.sessions_spawn.mockResolvedValue({
        status: 'accepted',
        runId: 'run-456',
        childSessionKey: 'agent:main:acp:dev-xyz'
      })

      mockClient.waitForCompletion.mockResolvedValue('Implementation complete')

      const result = await executor.executeAgent('dev', '实现登录表单')

      expect(result.success).toBe(true)
      expect(mockClient.sessions_spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'acp',
          thinking: 'medium',
          streamTo: 'parent'
        })
      )
    })

    it('应该执行 Reviewer Claw', async () => {
      mockClient.sessions_spawn.mockResolvedValue({
        status: 'accepted',
        runId: 'run-789',
        childSessionKey: 'agent:main:subagent:review-def'
      })

      mockClient.waitForCompletion.mockResolvedValue('APPROVED')

      const result = await executor.executeAgent('review', '审查代码')

      expect(result.success).toBe(true)
      expect(mockClient.sessions_spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'subagent',
          thinking: 'medium'
        })
      )
    })

    it('spawn 失败应该返回错误', async () => {
      mockClient.sessions_spawn.mockResolvedValue({
        status: 'error',
        error: 'Agent not available'
      })

      const result = await executor.executeAgent('pm', '测试任务')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Agent not available')
    })

    it('等待完成超时应该返回错误', async () => {
      mockClient.sessions_spawn.mockResolvedValue({
        status: 'accepted',
        runId: 'run-timeout',
        childSessionKey: 'agent:main:subagent:timeout'
      })

      mockClient.waitForCompletion.mockRejectedValue(new Error('Timeout'))

      const result = await executor.executeAgent('pm', '测试任务')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Timeout')
    })
  })

  describe('executePMAgent', () => {
    it('应该使用正确的提示词执行 PM Claw', async () => {
      mockClient.sessions_spawn.mockResolvedValue({
        status: 'accepted',
        runId: 'run-pm',
        childSessionKey: 'agent:main:subagent:pm'
      })

      mockClient.waitForCompletion.mockResolvedValue(JSON.stringify({
        analysis: '需求分析',
        tasks: []
      }))

      await executor.executePMAgent('创建用户注册功能')

      const spawnCall = mockClient.sessions_spawn.mock.calls[0][0]
      expect(spawnCall.task).toContain('PM Claw')
      expect(spawnCall.task).toContain('创建用户注册功能')
      expect(spawnCall.thinking).toBe('high')
    })
  })

  describe('executeDevAgent', () => {
    it('应该使用正确的提示词执行 Dev Claw', async () => {
      mockClient.sessions_spawn.mockResolvedValue({
        status: 'accepted',
        runId: 'run-dev',
        childSessionKey: 'agent:main:acp:dev'
      })

      mockClient.waitForCompletion.mockResolvedValue('代码实现完成')

      await executor.executeDevAgent('实现登录表单', '包含邮箱和密码字段')

      const spawnCall = mockClient.sessions_spawn.mock.calls[0][0]
      expect(spawnCall.task).toContain('Dev Claw')
      expect(spawnCall.task).toContain('实现登录表单')
      expect(spawnCall.task).toContain('包含邮箱和密码字段')
      expect(spawnCall.runtime).toBe('acp')
    })
  })

  describe('executeReviewAgent', () => {
    it('应该使用正确的提示词执行 Reviewer Claw', async () => {
      mockClient.sessions_spawn.mockResolvedValue({
        status: 'accepted',
        runId: 'run-review',
        childSessionKey: 'agent:main:subagent:review'
      })

      mockClient.waitForCompletion.mockResolvedValue('APPROVED')

      await executor.executeReviewAgent('审查登录表单', 'const x = 1')

      const spawnCall = mockClient.sessions_spawn.mock.calls[0][0]
      expect(spawnCall.task).toContain('Reviewer Claw')
      expect(spawnCall.task).toContain('审查登录表单')
      expect(spawnCall.task).toContain('const x = 1')
    })
  })

  describe('isConnected', () => {
    it('未连接时应该返回 false', () => {
      expect(executor.isConnected()).toBe(false)
    })

    it('连接后应该返回 true', async () => {
      await executor.connect()
      expect(executor.isConnected()).toBe(true)
    })
  })
})

describe('getAgentExecutor / resetAgentExecutor', () => {
  beforeEach(() => {
    resetAgentExecutor()
  })

  it('应该返回单例实例', () => {
    const executor1 = getAgentExecutor()
    const executor2 = getAgentExecutor()
    expect(executor1).toBe(executor2)
  })

  it('reset 后应该返回新实例', () => {
    const executor1 = getAgentExecutor()
    resetAgentExecutor()
    const executor2 = getAgentExecutor()
    expect(executor1).not.toBe(executor2)
  })
})
