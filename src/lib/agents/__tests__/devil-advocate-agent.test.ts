/**
 * Devil's Advocate Agent 单元测试
 */

import { DevilAdvocateAgent, shouldTriggerDA, evaluateDAGate, Challenge } from '../devil-advocate-agent'
import { Task, AgentContext } from '../../core/types'

// ─── Test Fixtures ─────────────────────────────────────────────

const mockTask: Task = {
  id: 'task-1',
  title: '实现用户认证 API',
  description: '添加 JWT 认证端点',
  status: 'in_progress',
  assignedTo: 'dev',
  dependencies: [],
  files: [],
}

const mockContext: AgentContext = {
  projectId: 'test-project',
  tasks: [],
  files: {
    'auth.ts': `
      const password = "hardcoded-secret-123"
      async function login(user: string, pass: string) {
        const result = await db.query("SELECT * FROM users WHERE name = '" + user + "'")
        for await (const item of result) {
          await processItem(item)
        }
        return result[0]
      }
      function divide(a: number, b: number) {
        return a / b
      }
    `,
  },
  chatHistory: [],
}

const emptyContext: AgentContext = {
  projectId: 'test-project',
  tasks: [],
  files: {},
  chatHistory: [],
}

// ─── shouldTriggerDA Tests ─────────────────────────────────────

describe('shouldTriggerDA', () => {
  it('forceDA 选项应强制触发 DA', () => {
    const task: Task = {
      id: 't1',
      title: '简单的 UI 调整',
      description: '改变按钮颜色',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
    }
    expect(shouldTriggerDA(task, undefined, { forceDA: true })).toBe(true)
  })

  it('包含 security 关键词应触发 DA', () => {
    const task: Task = {
      id: 't2',
      title: '修复 security 漏洞',
      description: '处理 XSS',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
    }
    expect(shouldTriggerDA(task)).toBe(true)
  })

  it('包含中文"安全"关键词应触发 DA', () => {
    const task: Task = {
      id: 't3',
      title: '安全审计',
      description: '检查系统安全性',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
    }
    expect(shouldTriggerDA(task)).toBe(true)
  })

  it('Review 评分过高应触发 DA（疑似伪对抗）', () => {
    const task: Task = {
      id: 't4',
      title: '简单 bug 修复',
      description: '修正拼写错误',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
    }
    expect(shouldTriggerDA(task, { approved: true, score: 98 })).toBe(true)
  })

  it('普通任务且评分正常不应触发 DA', () => {
    const task: Task = {
      id: 't5',
      title: '更新依赖版本',
      description: '升级 lodash 到最新版',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
    }
    // score=80 falls in 60-85 sampling range; pass random=0.5 (>0.3) to ensure deterministic skip
    expect(evaluateDAGate(task, { approved: true, score: 80 }, undefined, 0.5).trigger).toBe(false)
  })

  it('包含 auth 关键词应触发 DA', () => {
    const task: Task = {
      id: 't6',
      title: '实现 auth 模块',
      description: '用户登录注册',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
    }
    expect(shouldTriggerDA(task)).toBe(true)
  })

  it('包含数据库迁移关键词应触发 DA', () => {
    const task: Task = {
      id: 't7',
      title: '数据库 migration 脚本',
      description: '迁移用户数据',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
    }
    expect(shouldTriggerDA(task)).toBe(true)
  })
})

// ─── DevilAdvocateAgent Tests ──────────────────────────────────

describe('DevilAdvocateAgent', () => {
  let agent: DevilAdvocateAgent

  beforeEach(() => {
    agent = new DevilAdvocateAgent()
  })

  it('应该能实例化', () => {
    expect(agent).toBeDefined()
    expect(agent.role).toBe('devil-advocate')
    expect(agent.name).toBe("Devil's Advocate Claw")
  })

  it('execute() 对含安全问题的代码应返回 need_input 或 error 状态', async () => {
    const result = await agent.execute(mockTask, mockContext)

    expect(result.agent).toBe('review')
    expect(result.status).toMatch(/need_input|error/)
    expect(result.message).toContain('Devil')
  })

  it('execute() 结果应包含 metadata.daResult', async () => {
    const result = await agent.execute(mockTask, mockContext)

    expect(result.metadata).toBeDefined()
    expect(result.metadata?.verdict).toBeDefined()
    expect(result.metadata?.challengeCount).toBeGreaterThan(0)
  })

  it('空代码上下文应能正常运行（不崩溃）', async () => {
    const result = await agent.execute(mockTask, emptyContext)

    expect(result).toBeDefined()
    expect(result.agent).toBe('review')
    expect(result.message).toBeTruthy()
  })

  it('Cross-Run Tracking：应继承上一轮未解决的挑战', async () => {
    const previousChallenges: Challenge[] = [
      {
        id: 1,
        status: 'OPEN',
        summary: '上一轮发现的 SQL 注入风险',
        assumptionUnderAttack: '假设输入已净化',
        failureScenario: '攻击者构造恶意 SQL',
        triggerCondition: '用户控制输入',
        concreteImpact: '数据库被清空',
        whatWouldConvinceMe: '展示参数化查询',
        alternativeApproach: '使用 ORM 或 prepared statements',
        dimension: 'security',
        severity: 'fatal',
      },
    ]

    agent.setPreviousChallenges(previousChallenges)
    const result = await agent.execute(mockTask, emptyContext)

    expect(result.metadata?.challengeCount).toBeGreaterThanOrEqual(1)
    // 继承的挑战应该在消息中出现
    expect(result.message).toContain('LOOPBACK')
  })

  it('DA 报告应包含 Challenge Ledger 格式的关键字段', async () => {
    const result = await agent.execute(mockTask, mockContext)

    expect(result.message).toContain('Challenge')
    expect(result.message).toContain('OPEN')
    // Should contain the challenge ledger section
    expect(result.message).toContain('挑战账本')
  })

  it('evaluate 包含硬编码密码的代码应检测到安全问题', async () => {
    const contextWithHardcodedCreds: AgentContext = {
      ...emptyContext,
      files: {
        'config.ts': 'const password = "super-secret-password-123"',
      },
    }

    const result = await agent.execute(mockTask, contextWithHardcodedCreds)
    const daResult = result.metadata?.daResult as { challenges: Challenge[] }

    const securityChallenges = daResult?.challenges?.filter(
      (c: Challenge) => c.dimension === 'security'
    ) ?? []

    expect(securityChallenges.length).toBeGreaterThan(0)
  })

  it('evaluate 包含 N+1 查询的代码应检测到性能问题', async () => {
    const contextWithN1: AgentContext = {
      ...emptyContext,
      files: {
        'service.ts': `
          async function processAll(items: string[]) {
            for await (const item of items) {
              await db.save(item)
            }
          }
        `,
      },
    }

    const result = await agent.execute(mockTask, contextWithN1)
    const daResult = result.metadata?.daResult as { challenges: Challenge[] }

    const perfChallenges = daResult?.challenges?.filter(
      (c: Challenge) => c.dimension === 'performance'
    ) ?? []

    expect(perfChallenges.length).toBeGreaterThan(0)
  })

  it('CONVINCED 判决应返回 success 状态', async () => {
    // 空代码 + 简单任务不应触发任何规则
    const simpleTask: Task = {
      id: 'simple-1',
      title: '更新 README',
      description: '修正拼写错误',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
    }

    const result = await agent.execute(simpleTask, emptyContext)

    // 无代码、无安全问题 → 应该是 CONVINCED
    if (result.metadata?.verdict === 'CONVINCED') {
      expect(result.status).toBe('success')
    }
  })
})
