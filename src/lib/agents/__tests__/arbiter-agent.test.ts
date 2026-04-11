/**
 * Arbiter Agent Tests
 */

import { ArbiterAgent } from '../arbiter-agent'
import { Task, AgentContext } from '../../core/types'
import type { DAResult } from '../devil-advocate-agent'

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-arbiter-test',
  title: 'Test Arbiter Task',
  description: 'Testing the Arbiter agent',
  assignedTo: 'dev',
  status: 'in_progress',
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

const makeDaResult = (overrides: Partial<DAResult> = {}): DAResult => ({
  verdict: 'CONVINCED',
  openCount: 0,
  sealedCount: 2,
  escalatedCount: 0,
  fatalCount: 0,
  challenges: [],
  summary: '所有挑战已被有力反驳',
  actionableRecommendations: [],
  topRisk: null,
  ...overrides,
})

describe('ArbiterAgent', () => {
  let arbiter: ArbiterAgent

  beforeEach(() => {
    arbiter = new ArbiterAgent()
  })

  describe('基本属性', () => {
    it('should have correct id and name', () => {
      expect(arbiter.id).toBe('arbiter-1')
      expect(arbiter.name).toBe('Arbiter Claw')
    })

    it('should have role of review', () => {
      expect(arbiter.role).toBe('review')
    })
  })

  describe('规则系统裁决 (无 LLM)', () => {
    it('ACCEPT: Review 批准 + DA CONVINCED', async () => {
      const daResult = makeDaResult({ verdict: 'CONVINCED' })
      const context = makeContext({
        reviewFeedback: '✅ 审查通过，代码质量良好，可以合并。score: 85/100',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.status).toBe('success')
      expect(response.metadata?.finalDecision).toBe('ACCEPT')
      expect(response.metadata?.dpScore).toBeGreaterThan(60)
    })

    it('REJECT: DA FATAL', async () => {
      const daResult = makeDaResult({
        verdict: 'FATAL',
        fatalCount: 2,
        openCount: 2,
        challenges: [
          {
            id: 1, status: 'OPEN', severity: 'fatal', dimension: 'security',
            summary: 'SQL 注入漏洞',
            assumptionUnderAttack: '...', failureScenario: '...', triggerCondition: '...',
            concreteImpact: '...', whatWouldConvinceMe: '...', alternativeApproach: '参数化查询',
          },
        ],
        actionableRecommendations: ['使用参数化查询'],
      })
      const context = makeContext({
        reviewFeedback: '✅ 审查通过',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.status).toBe('error')
      expect(response.metadata?.finalDecision).toBe('REJECT')
      expect(response.metadata?.dpScore).toBeLessThan(50)
    })

    it('REVISE: Review 批准 + DA UNCONVINCED (含 critical)', async () => {
      const daResult = makeDaResult({
        verdict: 'UNCONVINCED',
        openCount: 2,
        challenges: [
          {
            id: 1, status: 'OPEN', severity: 'critical', dimension: 'performance',
            summary: 'N+1 查询问题',
            assumptionUnderAttack: '...', failureScenario: '...', triggerCondition: '...',
            concreteImpact: '...', whatWouldConvinceMe: '...', alternativeApproach: '使用批量查询',
          },
          {
            id: 2, status: 'OPEN', severity: 'critical', dimension: 'security',
            summary: 'XSS 风险',
            assumptionUnderAttack: '...', failureScenario: '...', triggerCondition: '...',
            concreteImpact: '...', whatWouldConvinceMe: '...', alternativeApproach: 'DOMPurify',
          },
        ],
      })
      const context = makeContext({
        reviewFeedback: '✅ 代码审查通过，approved: true',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.status).toBe('need_input')
      expect(response.metadata?.finalDecision).toBe('REVISE')
      expect(response.nextAgent).toBe('dev')
      const arbiterVerdict = response.metadata?.arbiterVerdict as { conflictResolution?: string }
      expect(arbiterVerdict?.conflictResolution).toBeTruthy()
    })

    it('ACCEPT: Review 批准 + DA UNCONVINCED (仅 warning)', async () => {
      const daResult = makeDaResult({
        verdict: 'UNCONVINCED',
        openCount: 1,
        challenges: [
          {
            id: 1, status: 'OPEN', severity: 'warning', dimension: 'maintainability',
            summary: '魔法数字',
            assumptionUnderAttack: '...', failureScenario: '...', triggerCondition: '...',
            concreteImpact: '...', whatWouldConvinceMe: '...', alternativeApproach: '提取常量',
          },
        ],
      })
      const context = makeContext({
        reviewFeedback: '✅ 代码审查通过',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.status).toBe('success')
      expect(response.metadata?.finalDecision).toBe('ACCEPT')
    })

    it('REVISE: Review 拒绝 + DA CONVINCED (分歧处理)', async () => {
      const daResult = makeDaResult({
        verdict: 'CONVINCED',
        openCount: 0,
        sealedCount: 3,
      })
      const context = makeContext({
        reviewFeedback: '❌ 审查不通过，需要修改\n1. 缺少错误处理\n2. 类型安全问题',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.status).toBe('need_input')
      expect(response.metadata?.finalDecision).toBe('REVISE')
      const arbiterVerdict = response.metadata?.arbiterVerdict as { conflictResolution?: string }
      expect(arbiterVerdict?.conflictResolution).toBeTruthy()
    })

    it('无 DA 结果时，基于 Review 单独裁决', async () => {
      const context = makeContext({
        reviewFeedback: '✅ 代码审查通过，approved: true，score: 88',
        // daFeedback 未提供
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.status).toBe('success')
      expect(response.metadata?.finalDecision).toBe('ACCEPT')
      expect(response.metadata?.dpScore).toBe(88)
    })

    it('DP Score 计算正确：Review 40% + DA 60%', async () => {
      const daResult = makeDaResult({ verdict: 'CONVINCED' })
      const context = makeContext({
        reviewFeedback: 'score: 80/100 ✅ 审查通过',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      // 80 * 0.4 + 100 * 0.6 = 32 + 60 = 92
      expect(response.metadata?.dpScore).toBe(92)
    })
  })

  describe('输出格式', () => {
    it('ACCEPT 时应包含流程完成提示', async () => {
      const daResult = makeDaResult({ verdict: 'CONVINCED' })
      const context = makeContext({
        reviewFeedback: '✅ 审查通过',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.message).toContain('Arbiter')
      expect(response.message).toContain('DP Score')
      expect(response.message).toContain('接受')
    })

    it('REJECT 时应包含拒绝信息', async () => {
      const daResult = makeDaResult({
        verdict: 'FATAL',
        fatalCount: 1,
        actionableRecommendations: ['重新设计方案'],
      })
      const context = makeContext({
        reviewFeedback: '审查完成',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.message).toContain('拒绝')
    })

    it('nextAgent 在 REVISE 时应为 dev', async () => {
      const daResult = makeDaResult({
        verdict: 'UNCONVINCED',
        openCount: 1,
        challenges: [{
          id: 1, status: 'OPEN', severity: 'critical', dimension: 'security',
          summary: '安全问题',
          assumptionUnderAttack: '...', failureScenario: '...', triggerCondition: '...',
          concreteImpact: '...', whatWouldConvinceMe: '...', alternativeApproach: '修复',
        }],
      })
      const context = makeContext({
        reviewFeedback: '✅ 批准',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.nextAgent).toBe('dev')
    })

    it('ACCEPT 时 nextAgent 应为 undefined', async () => {
      const daResult = makeDaResult({ verdict: 'CONVINCED' })
      const context = makeContext({
        reviewFeedback: '✅ 审查通过',
        daFeedback: JSON.stringify(daResult),
      })

      const response = await arbiter.execute(makeTask(), context)
      expect(response.nextAgent).toBeUndefined()
    })
  })
})
