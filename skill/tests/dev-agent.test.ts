import { DevAgent, executeTask } from '../src/agents/dev-agent'
import type { Task } from '../src/core/types'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      sessions_spawn: jest.Mock
      sessions_history: jest.Mock
    }
  }
}

const mockSessionsSpawn = jest.fn()
const mockSessionsHistory = jest.fn()

;(global as any).sessions_spawn = mockSessionsSpawn
;(global as any).sessions_history = mockSessionsHistory

const mockTask: Task = {
  id: 'task-1',
  title: '实现登录功能',
  description: '创建用户登录表单和验证逻辑',
  assignedTo: 'dev',
  dependencies: [],
  files: [],
  status: 'pending',
}

describe('DevAgent', () => {
  let agent: DevAgent

  beforeEach(() => {
    jest.clearAllMocks()
    agent = new DevAgent()
  })

  describe('constructor', () => {
    test('应该使用默认配置初始化', () => {
      const defaultAgent = new DevAgent()
      expect(defaultAgent.role).toBe('dev')
    })

    test('应该接受自定义配置覆盖默认值', () => {
      const customAgent = new DevAgent({
        runtime: 'subagent',
        agentId: 'custom-agent',
        thinking: 'high',
      })
      expect(customAgent.role).toBe('dev')
    })
  })

  describe('execute - ACP runtime 成功路径', () => {
    test('应该通过 ACP runtime 执行任务并返回解析结果', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'dev-acp-session-1',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              success: true,
              files: ['src/login.ts', 'src/login.test.ts'],
              summary: '登录功能实现完成',
            }),
          },
        ],
      })

      const result = await agent.execute(mockTask, '/project/path')

      expect(result.success).toBe(true)
      expect(result.files).toEqual(['src/login.ts', 'src/login.test.ts'])
      expect(result.summary).toBe('登录功能实现完成')
      expect(mockSessionsSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'acp',
          agentId: 'opencode',
          cwd: '/project/path',
          task: expect.stringContaining('实现登录功能'),
        })
      )
    })
  })

  describe('execute - ACP runtime 失败时 fallback 到 subagent', () => {
    test('应该在 ACP 抛出异常时 fallback 到 subagent 并返回结果', async () => {
      mockSessionsSpawn
        .mockRejectedValueOnce(new Error('ACP 不可用'))
        .mockResolvedValueOnce({
          sessionKey: 'dev-subagent-session-1',
          status: 'completed',
        })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              success: true,
              files: ['src/login.ts'],
              summary: 'subagent fallback 完成',
            }),
          },
        ],
      })

      const result = await agent.execute(mockTask, '/project/path')

      expect(result.success).toBe(true)
      expect(result.files).toEqual(['src/login.ts'])
      expect(result.summary).toBe('subagent fallback 完成')
      expect(mockSessionsSpawn).toHaveBeenCalledTimes(2)
      expect(mockSessionsSpawn).toHaveBeenLastCalledWith(
        expect.objectContaining({
          runtime: 'subagent',
          task: expect.stringContaining('实现登录功能'),
        })
      )
    })
  })

  describe('execute - subagent runtime 直接路径', () => {
    test('应该在 runtime 为 subagent 时直接使用 subagent 执行', async () => {
      const subAgent = new DevAgent({ runtime: 'subagent' })

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'dev-sub-session',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              success: true,
              files: ['src/feature.ts'],
              summary: 'subagent 直接执行完成',
            }),
          },
        ],
      })

      const result = await subAgent.execute(mockTask, '/project')

      expect(result.success).toBe(true)
      expect(result.files).toEqual(['src/feature.ts'])
      expect(mockSessionsSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'subagent',
          task: expect.stringContaining('实现登录功能'),
        })
      )
    })
  })

  describe('execute - 解析失败时返回默认值', () => {
    test('应该在 parseJSONFromSession 无法解析时返回默认 DevResult', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'dev-session-default',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: '这不是JSON格式的内容',
          },
        ],
      })

      const result = await agent.execute(mockTask, '/project')

      expect(result.success).toBe(true)
      expect(result.files).toEqual([])
      expect(result.summary).toBe('任务完成')
    })
  })

  describe('buildPrompt', () => {
    test('应该生成包含任务信息的 prompt', () => {
      const anyAgent = agent as any
      const prompt = anyAgent.buildPrompt(mockTask)

      expect(prompt).toContain('实现登录功能')
      expect(prompt).toContain('创建用户登录表单和验证逻辑')
      expect(prompt).toContain('Dev Agent')
      expect(prompt).toContain('JSON')
    })
  })

  describe('executeTask 辅助函数', () => {
    test('应该创建 DevAgent 实例并执行任务', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'exec-task-session',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              success: true,
              files: ['src/new-feature.ts'],
              summary: '通过 executeTask 执行完成',
            }),
          },
        ],
      })

      const result = await executeTask(mockTask, '/project')

      expect(result.success).toBe(true)
      expect(result.files).toEqual(['src/new-feature.ts'])
      expect(result.summary).toBe('通过 executeTask 执行完成')
    })

    test('应该使用传入的自定义 config', async () => {
      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'custom-config-session',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              success: true,
              files: ['src/custom.ts'],
              summary: '自定义配置执行完成',
            }),
          },
        ],
      })

      const result = await executeTask(mockTask, '/project', {
        runtime: 'subagent',
        thinking: 'low',
      })

      expect(result.success).toBe(true)
      expect(result.files).toEqual(['src/custom.ts'])
    })
  })

  describe('execute - 自定义 agentId 配置', () => {
    test('应该使用配置中指定的 agentId', async () => {
      const customAgent = new DevAgent({
        runtime: 'acp',
        agentId: 'custom-opencode',
      })

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'custom-agent-session',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              success: true,
              files: ['src/result.ts'],
              summary: '自定义 agent 完成',
            }),
          },
        ],
      })

      await customAgent.execute(mockTask, '/project')

      expect(mockSessionsSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'custom-opencode',
        })
      )
    })

    test('应该在 agentId 为空时使用默认 opencode', async () => {
      const fallbackAgent = new DevAgent({
        runtime: 'acp',
        agentId: '' as string,
      })

      mockSessionsSpawn.mockResolvedValueOnce({
        sessionKey: 'fallback-agent-session',
        status: 'completed',
      })

      mockSessionsHistory.mockResolvedValueOnce({
        messages: [
          {
            role: 'assistant',
            content: JSON.stringify({
              success: true,
              files: ['src/fallback.ts'],
              summary: 'fallback agent 完成',
            }),
          },
        ],
      })

      await fallbackAgent.execute(mockTask, '/project')

      expect(mockSessionsSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'opencode',
        })
      )
    })
  })
})
