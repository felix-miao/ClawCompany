/**
 * Devil's Advocate (DA) Agent — 对抗性审查代理
 *
 * 设计哲学：
 * 受以色列情报机构"ipcha mistabra"（假定相反）原则启发：
 * 当 9 个人同意时，第 10 个人必须提出反对——
 * 不是因为他相信反对意见，而是因为【未受挑战的共识是最危险的失败模式】。
 *
 * DA 与 Reviewer 的核心区别：
 * - Reviewer：评估实现质量（"代码写得对不对？"）
 * - Devil's Advocate：质疑基本假设（"为什么要这样做？有没有可能根本就是错的方向？"）
 *
 * DA 的 5 个核心关注点：
 * 1. 安全漏洞（Security Vulnerabilities）— 比 Reviewer 更偏执，假设攻击者是最聪明的
 * 2. 边缘情况（Edge Cases）— 寻找"不太可能但会灾难性失败"的场景
 * 3. 性能陷阱（Performance Traps）— 质疑在 N×10 规模下是否仍然成立
 * 4. 可维护性（Maintainability）— 3年后接手的工程师能理解吗？
 * 5. 一致性（Consistency）— 与系统其他部分的约定是否冲突？
 *
 * DA 在流程中的位置：
 * Review 完成后，串行执行（DA 需要读取 Review 的输出来对抗它）
 * 触发条件：
 * - Review 批准率 > 90%（疑似伪对抗，缺少真正批判）
 * - 涉及不可逆操作（数据删除、API 契约、破坏性迁移）
 * - 任务包含"架构"、"设计"、"安全"关键词
 * - 明确要求 DA 介入
 */

import { BaseAgent } from '../core/base-agent'
import { Task, AgentResponse, AgentContext } from '../core/types'
import { sanitizeTaskPrompt } from '../utils/prompt-sanitizer'
import { z } from 'zod'

// ─── Challenge Ledger 类型 ──────────────────────────────────────

export type ChallengeStatus = 'OPEN' | 'SEALED' | 'ESCALATED'

export interface Challenge {
  /** 挑战编号 */
  id: number
  /** 挑战状态 */
  status: ChallengeStatus
  /** 一行摘要 */
  summary: string
  /** 被攻击的假设 */
  assumptionUnderAttack: string
  /** 失败场景描述 */
  failureScenario: string
  /** 具体触发条件 */
  triggerCondition: string
  /** 预期后果 */
  concreteImpact: string
  /** 什么证据会让 DA 信服 */
  whatWouldConvinceMe: string
  /** 如果 DA 是对的，应该采用的替代方案 */
  alternativeApproach: string
  /** 封闭理由（若 SEALED） */
  sealedBy?: string
  /** 升级理由（若 ESCALATED） */
  escalatedReason?: string
  /** 关注维度 */
  dimension: DADimension
  /** 严重程度 */
  severity: 'fatal' | 'critical' | 'warning'
}

export type DADimension =
  | 'security'          // 安全漏洞
  | 'edge-case'         // 边缘情况
  | 'performance'       // 性能陷阱
  | 'maintainability'   // 可维护性
  | 'consistency'       // 一致性

export type DAVerdict =
  | 'CONVINCED'         // 所有挑战已封闭 → PASS
  | 'UNCONVINCED'       // 仍有 OPEN 挑战 → ITERATE
  | 'FATAL'             // 基本假设错误，不值得继续 → FAIL

export interface DAResult {
  verdict: DAVerdict
  openCount: number
  sealedCount: number
  escalatedCount: number
  fatalCount: number
  challenges: Challenge[]
  summary: string
  /** 给 Proposer 的建议（具体、可操作） */
  actionableRecommendations: string[]
  /** DA 认为最危险的单一风险 */
  topRisk: string | null
}

// ─── Zod Schema ────────────────────────────────────────────────

const ChallengeSchema = z.object({
  id: z.number(),
  status: z.enum(['OPEN', 'SEALED', 'ESCALATED']),
  summary: z.string().min(1),
  assumptionUnderAttack: z.string().min(1),
  failureScenario: z.string().min(1),
  triggerCondition: z.string().min(1),
  concreteImpact: z.string().min(1),
  whatWouldConvinceMe: z.string().min(1),
  alternativeApproach: z.string().min(1),
  sealedBy: z.string().optional(),
  escalatedReason: z.string().optional(),
  dimension: z.enum(['security', 'edge-case', 'performance', 'maintainability', 'consistency']),
  severity: z.enum(['fatal', 'critical', 'warning']),
})

const DAResponseSchema = z.object({
  verdict: z.enum(['CONVINCED', 'UNCONVINCED', 'FATAL']),
  challenges: z.array(ChallengeSchema).default([]),
  summary: z.string().min(1),
  actionableRecommendations: z.array(z.string()).default([]),
  topRisk: z.string().nullable().optional(),
})

// ─── DA Agent 实现 ─────────────────────────────────────────────

export class DevilAdvocateAgent extends BaseAgent {
  /** 前一轮的挑战账本（用于 Cross-Run Tracking） */
  private previousChallenges: Challenge[] = []

  constructor() {
    super(
      'devil-advocate-1',
      'Devil\'s Advocate Claw',
      'review',
      '对抗性审查：质疑基本假设，寻找极端情况和灾难性失败模式'
    )
  }

  /**
   * 注入前一轮挑战账本，用于 Cross-Run Tracking。
   * 在 loopback 场景下调用：DA 会检查之前的 [OPEN] 挑战是否已被解决。
   */
  setPreviousChallenges(challenges: Challenge[]): void {
    this.previousChallenges = challenges
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`Devil's Advocate 介入: ${task.title}`)

    const result = await this.runDA(task, context)

    return {
      agent: 'review',
      message: this.formatDAReport(result),
      status: this.mapVerdictToStatus(result.verdict),
      nextAgent: result.verdict === 'CONVINCED' ? undefined : 'dev',
      metadata: {
        daResult: result,
        challengeCount: result.challenges.length,
        openChallenges: result.openCount,
        verdict: result.verdict,
      },
    }
  }

  private async runDA(task: Task, context: AgentContext): Promise<DAResult> {
    const llm = this.getLLM()

    if (llm) {
      try {
        const userPrompt = this.buildUserPrompt(task, context)
        const response = await this.callLLM(this.getSystemPrompt(), userPrompt)
        if (response) {
          return this.handleLLMResponse(response)
        }
      } catch (error) {
        this.log(`DA LLM 调用失败，降级到规则系统: ${error}`)
      }
    }

    return this.runRuleBasedDA(task, context)
  }

  private handleLLMResponse(response: string): DAResult {
    const parsed = this.parseJSONResponse(response, DAResponseSchema)

    if (parsed.success) {
      const data = parsed.data
      const challenges = data.challenges as Challenge[]
      const openCount = challenges.filter(c => c.status === 'OPEN').length
      const sealedCount = challenges.filter(c => c.status === 'SEALED').length
      const escalatedCount = challenges.filter(c => c.status === 'ESCALATED').length
      const fatalCount = challenges.filter(c => c.severity === 'fatal').length

      return {
        verdict: data.verdict,
        openCount,
        sealedCount,
        escalatedCount,
        fatalCount,
        challenges,
        summary: data.summary,
        actionableRecommendations: data.actionableRecommendations,
        topRisk: data.topRisk ?? null,
      }
    }

    // 解析失败 → 降级到规则系统，但记录 LLM 原始输出
    this.log(`DA LLM 响应解析失败，降级到规则系统`)
    return this.createFallbackResult(response)
  }

  /**
   * 规则系统 DA（无 LLM 时使用）
   * 基于静态分析：代码模式匹配 + 启发式规则
   */
  private async runRuleBasedDA(task: Task, context: AgentContext): Promise<DAResult> {
    const code = this.extractCodeFromContext(context)
    const challenges: Challenge[] = []
    let challengeId = 1

    // === 维度 1：安全漏洞 ===
    const securityChallenges = this.checkSecurityVulnerabilities(code, challengeId)
    challenges.push(...securityChallenges)
    challengeId += securityChallenges.length

    // === 维度 2：边缘情况 ===
    const edgeCaseChallenges = this.checkEdgeCases(code, challengeId)
    challenges.push(...edgeCaseChallenges)
    challengeId += edgeCaseChallenges.length

    // === 维度 3：性能陷阱 ===
    const perfChallenges = this.checkPerformanceTraps(code, challengeId)
    challenges.push(...perfChallenges)
    challengeId += perfChallenges.length

    // === 维度 4：可维护性 ===
    const maintChallenges = this.checkMaintainability(code, task, challengeId)
    challenges.push(...maintChallenges)
    challengeId += maintChallenges.length

    // === 维度 5：一致性 ===
    const consistChallenges = this.checkConsistency(code, context, challengeId)
    challenges.push(...consistChallenges)

    // Cross-Run Tracking：继承前一轮未解决的挑战
    const inheritedOpenChallenges = this.inheritPreviousChallenges(challengeId + consistChallenges.length)
    challenges.push(...inheritedOpenChallenges)

    const openCount = challenges.filter(c => c.status === 'OPEN').length
    const sealedCount = challenges.filter(c => c.status === 'SEALED').length
    const escalatedCount = challenges.filter(c => c.status === 'ESCALATED').length
    const fatalCount = challenges.filter(c => c.severity === 'fatal').length

    let verdict: DAVerdict
    if (fatalCount > 0) {
      verdict = 'FATAL'
    } else if (openCount > 0) {
      verdict = 'UNCONVINCED'
    } else {
      verdict = 'CONVINCED'
    }

    const topRiskChallenge = challenges
      .filter(c => c.status === 'OPEN')
      .sort((a, b) => {
        const severityOrder = { fatal: 0, critical: 1, warning: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      })[0]

    return {
      verdict,
      openCount,
      sealedCount,
      escalatedCount,
      fatalCount,
      challenges,
      summary: this.buildSummary(verdict, openCount, fatalCount, challenges),
      actionableRecommendations: this.buildRecommendations(challenges),
      topRisk: topRiskChallenge ? topRiskChallenge.summary : null,
    }
  }

  // ─── 安全漏洞检查 ──────────────────────────────────────────────

  private checkSecurityVulnerabilities(code: string, startId: number): Challenge[] {
    const challenges: Challenge[] = []
    let id = startId

    if (!code) return challenges

    // SQL 注入风险
    if (/query\s*\+|query\s*`|\$\{.*\}.*sql|string.*concat.*sql/i.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '疑似字符串拼接构造 SQL 查询',
        assumptionUnderAttack: '假设调用者会自行做输入验证',
        failureScenario: '当攻击者传入 \'; DROP TABLE users; -- 时',
        triggerCondition: '用户输入直接进入 SQL 查询字符串',
        concreteImpact: '数据库被清空或数据泄露（灾难级）',
        whatWouldConvinceMe: '展示参数化查询的使用，或证明输入在边界层已净化',
        alternativeApproach: '改用参数化查询（prepared statements）或 ORM',
        dimension: 'security',
        severity: 'fatal',
      })
    }

    // XSS 风险
    if (/dangerouslySetInnerHTML|innerHTML\s*=|document\.write\s*\(/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '直接注入 HTML 内容，XSS 风险',
        assumptionUnderAttack: '假设内容来源是可信的',
        failureScenario: '当内容包含 <script>攻击代码</script> 时',
        triggerCondition: '任何用户可控的数据通过此路径渲染',
        concreteImpact: '用户会话劫持、恶意代码执行',
        whatWouldConvinceMe: '证明内容在注入前经过 DOMPurify 或等效净化',
        alternativeApproach: '使用 textContent 替代 innerHTML，或通过 React 的 JSX 正确转义',
        dimension: 'security',
        severity: 'critical',
      })
    }

    // eval / Function 执行
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '使用 eval() 或动态 Function 构造，代码注入风险',
        assumptionUnderAttack: '假设传入的字符串是安全的',
        failureScenario: '任何来自外部的字符串进入此调用',
        triggerCondition: '字符串来源包含用户输入、API 响应或文件内容',
        concreteImpact: '任意代码执行（RCE 风险）',
        whatWouldConvinceMe: '证明传入值只能是编译时常量，或彻底重构以消除 eval',
        alternativeApproach: '使用安全的 JSON.parse、或策略模式替代动态执行',
        dimension: 'security',
        severity: 'fatal',
      })
    }

    // 硬编码凭证
    if (/password\s*=\s*['"][^'"]{4,}['"]|secret\s*=\s*['"][^'"]{8,}['"]|api.?key\s*=\s*['"][^'"]{8,}['"]/i.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '疑似硬编码凭证（密码/密钥/Token）',
        assumptionUnderAttack: '假设代码不会进入版本控制或被他人访问',
        failureScenario: '代码被提交到 Git，出现在 GitHub 公开仓库',
        triggerCondition: '任何时候代码被分享或审查',
        concreteImpact: '凭证泄露，账号被接管，数据库被清空',
        whatWouldConvinceMe: '证明这是测试用的 dummy 值，或已通过 git-secrets 等工具阻止提交',
        alternativeApproach: '使用环境变量、Secret Manager 或 .env 文件（已加入 .gitignore）',
        dimension: 'security',
        severity: 'fatal',
      })
    }

    return challenges
  }

  // ─── 边缘情况检查 ──────────────────────────────────────────────

  private checkEdgeCases(code: string, startId: number): Challenge[] {
    const challenges: Challenge[] = []
    let id = startId

    if (!code) return challenges

    // 除零风险
    if (/\/\s*[a-zA-Z_$][a-zA-Z0-9_$]*(?!\s*[!=<>])/.test(code) &&
        !/\.length\s*>\s*0|!==\s*0|!=\s*0|>\s*0/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '除法操作未检查除数为零',
        assumptionUnderAttack: '假设分母永远不为 0',
        failureScenario: '当分母为 0 时',
        triggerCondition: '边缘数据、空集合、或用户输入 "0"',
        concreteImpact: '返回 NaN/Infinity，导致下游计算静默出错',
        whatWouldConvinceMe: '展示除法前的 !== 0 守卫，或证明分母在数学上不可能为 0',
        alternativeApproach: '在除法前添加明确的零检查守卫',
        dimension: 'edge-case',
        severity: 'warning',
      })
    }

    // 空数组/null 解构
    if (/\[0\]\s*\.|\.first\b|destructure/i.test(code) && !/if.*length|&&.*\[0\]/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '访问数组第一个元素未先检查数组是否为空',
        assumptionUnderAttack: '假设数组总是有元素',
        failureScenario: '当上游返回空数组时',
        triggerCondition: '过滤条件无匹配、网络响应为空列表',
        concreteImpact: 'undefined 静默传播，下游逻辑产生难以排查的错误',
        whatWouldConvinceMe: '展示空数组守卫，或证明上游保证非空',
        alternativeApproach: '使用可选链 arr?.[0] 并处理 undefined 情况',
        dimension: 'edge-case',
        severity: 'warning',
      })
    }

    // 无限循环风险
    if (/while\s*\(true\)|for\s*\(;.*;\s*\)/.test(code) && !/break|return/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '无界循环缺少退出条件',
        assumptionUnderAttack: '假设循环内部的条件总会触发 break',
        failureScenario: '条件永不满足时',
        triggerCondition: '意外数据状态，或竞争条件导致状态不一致',
        concreteImpact: '进程 CPU 100%，服务器无响应，需要强制重启',
        whatWouldConvinceMe: '展示明确的最大迭代次数守卫，或证明退出条件的完整性',
        alternativeApproach: '添加 maxIterations 计数器并在超出时抛出明确错误',
        dimension: 'edge-case',
        severity: 'critical',
      })
    }

    return challenges
  }

  // ─── 性能陷阱检查 ──────────────────────────────────────────────

  private checkPerformanceTraps(code: string, startId: number): Challenge[] {
    const challenges: Challenge[] = []
    let id = startId

    if (!code) return challenges

    // N+1 查询模式
    if (/for.*await|forEach.*await|map.*await/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '循环中使用 await，疑似 N+1 查询模式',
        assumptionUnderAttack: '假设数据量不会超过几十条',
        failureScenario: '当数据量增长到 1000+ 条时',
        triggerCondition: '生产数据累积，或批量操作',
        concreteImpact: '1000 次串行 DB 查询，响应时间从 10ms 劣化到 10s+',
        whatWouldConvinceMe: '展示批量查询（IN 语句）或 Promise.all 并行化方案',
        alternativeApproach: '改用批量 API（findMany with IDs）或 Promise.all + 限流',
        dimension: 'performance',
        severity: 'critical',
      })
    }

    // 同步阻塞 I/O
    if (/readFileSync|writeFileSync|execSync|spawnSync/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '在可能的请求处理路径中使用同步 I/O',
        assumptionUnderAttack: '假设此代码只在启动时或 CLI 中运行',
        failureScenario: '当此代码在 Web 请求处理中被调用时',
        triggerCondition: '并发请求场景',
        concreteImpact: 'Node.js 事件循环被阻塞，所有并发请求超时',
        whatWouldConvinceMe: '确认此代码的调用路径不在请求处理器内，或改为异步版本',
        alternativeApproach: '改用 readFile（async）版本，或移到初始化阶段',
        dimension: 'performance',
        severity: 'critical',
      })
    }

    // 无限制增长的内存结构
    if (/new Map\(\)|new Set\(\)|new Array\(\)|push\s*\(/.test(code) &&
        /while|for|loop/.test(code) &&
        !/delete\s+|\.clear\(\)|splice\s*\(|shift\s*\(/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '集合/数组在循环中增长但没有清理机制',
        assumptionUnderAttack: '假设进程会定期重启，或数据量有自然上界',
        failureScenario: '进程长期运行，数据持续累积',
        triggerCondition: '24小时持续运行的服务',
        concreteImpact: '内存泄漏，最终 OOM kill，服务不可用',
        whatWouldConvinceMe: '展示 TTL 清理机制、大小上限、或证明生命周期有界',
        alternativeApproach: '使用 LRU Cache（带大小限制），或定期清理过期条目',
        dimension: 'performance',
        severity: 'critical',
      })
    }

    return challenges
  }

  // ─── 可维护性检查 ──────────────────────────────────────────────

  private checkMaintainability(code: string, task: Task, startId: number): Challenge[] {
    const challenges: Challenge[] = []
    let id = startId

    if (!code) return challenges

    // 超长函数
    const functionBodies = code.match(/\{[^{}]*\{[^{}]*\}[^{}]*\}/g) || []
    const longFunctions = functionBodies.filter(f => f.split('\n').length > 80)
    if (longFunctions.length > 0) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '存在超过 80 行的单一函数体',
        assumptionUnderAttack: '假设这个函数的职责是内聚的',
        failureScenario: '3年后需要修改这个函数时',
        triggerCondition: '需求变更，需要在函数中间插入逻辑',
        concreteImpact: '工程师需要花费数小时理解上下文，引入回归 bug 的概率极高',
        whatWouldConvinceMe: '展示函数拆分方案，每个子函数有明确的单一职责',
        alternativeApproach: '按职责拆分为多个 20-30 行的函数，每个有独立可测试性',
        dimension: 'maintainability',
        severity: 'warning',
      })
    }

    // 魔法数字
    if (/\b(?<!\/\/.*)\d{2,}\b/.test(code) && !/\bconst\s+[A-Z_]+\s*=\s*\d+/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '存在魔法数字，缺少命名常量',
        assumptionUnderAttack: '假设这些数字的含义对未来的维护者是显而易见的',
        failureScenario: '半年后某人需要修改这些值时',
        triggerCondition: '业务规则变更（超时时间、限制数量等）',
        concreteImpact: '维护者需要搜索所有使用点，容易遗漏，或改错值',
        whatWouldConvinceMe: '将所有魔法数字提取为命名常量，名称解释其业务含义',
        alternativeApproach: 'export const MAX_RETRY_COUNT = 3 而非直接使用 3',
        dimension: 'maintainability',
        severity: 'warning',
      })
    }

    return challenges
  }

  // ─── 一致性检查 ──────────────────────────────────────────────

  private checkConsistency(code: string, context: AgentContext, startId: number): Challenge[] {
    const challenges: Challenge[] = []
    let id = startId

    if (!code) return challenges

    // 错误处理不一致
    const hasThrow = /\bthrow\s+new\b/.test(code)
    const hasReturnNull = /return\s+null|return\s+undefined/.test(code)
    const hasReturnError = /return\s*\{.*error.*\}|return\s*\{.*success:\s*false/.test(code)

    const errorPatternCount = [hasThrow, hasReturnNull, hasReturnError].filter(Boolean).length
    if (errorPatternCount >= 2) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '混合使用多种错误处理模式（throw/return null/return {error}）',
        assumptionUnderAttack: '假设调用者知道这个函数用哪种错误模式',
        failureScenario: '调用者只处理了 throw，但函数在某路径返回 null',
        triggerCondition: '该路径被非原始作者调用',
        concreteImpact: '未捕获异常或静默失败，生产环境难以排查',
        whatWouldConvinceMe: '统一使用一种错误模式，并在 JSDoc 中明确标注',
        alternativeApproach: '统一使用 throw Error（异常路径明确）或 Result<T> 模式（函数式）',
        dimension: 'consistency',
        severity: 'critical',
      })
    }

    // 异步/同步混用
    if (/async\s+function|await\s+/.test(code) && /new Promise\s*\(/.test(code)) {
      challenges.push({
        id: id++,
        status: 'OPEN',
        summary: '混合使用 async/await 和手动 Promise 构造',
        assumptionUnderAttack: '假设两种模式可以任意混合',
        failureScenario: '需要添加错误处理时',
        triggerCondition: '维护者修改错误处理逻辑',
        concreteImpact: 'Promise 链未被正确 await，错误静默丢失',
        whatWouldConvinceMe: '统一改用 async/await，移除手动 Promise 构造（除非包装回调 API）',
        alternativeApproach: '只保留 async/await；如需包装回调，使用 util.promisify',
        dimension: 'consistency',
        severity: 'warning',
      })
    }

    return challenges
  }

  // ─── Cross-Run Tracking：继承前一轮 OPEN 的挑战 ────────────────

  private inheritPreviousChallenges(startId: number): Challenge[] {
    if (this.previousChallenges.length === 0) return []

    return this.previousChallenges
      .filter(c => c.status === 'OPEN')
      .map((c, i) => ({
        ...c,
        id: startId + i,
        summary: `[LOOPBACK] ${c.summary}`,
        failureScenario: `${c.failureScenario} (本挑战在上一轮未被解决，重新开放)`,
      }))
  }

  // ─── 格式化输出 ──────────────────────────────────────────────

  private formatDAReport(result: DAResult): string {
    const verdictEmoji = {
      CONVINCED: '✅',
      UNCONVINCED: '🟡',
      FATAL: '🔴',
    }

    const lines: string[] = [
      `## Devil's Advocate 评估报告`,
      ``,
      `**判决：${verdictEmoji[result.verdict]} ${result.verdict}**`,
      ``,
      `> ${result.summary}`,
      ``,
    ]

    if (result.topRisk) {
      lines.push(`⚠️ **最高风险：** ${result.topRisk}`, ``)
    }

    lines.push(
      `### 挑战账本 (${result.openCount} OPEN / ${result.sealedCount} SEALED / ${result.escalatedCount} ESCALATED)`,
      ``
    )

    for (const challenge of result.challenges) {
      const statusEmoji = { OPEN: '🔓', SEALED: '🔒', ESCALATED: '⬆️' }
      const severityEmoji = { fatal: '💀', critical: '❗', warning: '⚠️' }

      lines.push(
        `#### [${challenge.status}] Challenge ${challenge.id}: ${challenge.summary}`,
        `${statusEmoji[challenge.status]} **${challenge.status}** ${severityEmoji[challenge.severity]} ${challenge.severity.toUpperCase()} | 维度: \`${challenge.dimension}\``,
        ``,
        `**被攻击的假设：** ${challenge.assumptionUnderAttack}`,
        `**失败场景：** 在 ${challenge.triggerCondition} 时，${challenge.failureScenario}，导致 ${challenge.concreteImpact}`,
        `**说服条件：** ${challenge.whatWouldConvinceMe}`,
        `**替代方案：** ${challenge.alternativeApproach}`,
      )

      if (challenge.status === 'SEALED' && challenge.sealedBy) {
        lines.push(`**封闭理由：** ${challenge.sealedBy}`)
      }

      if (challenge.status === 'ESCALATED' && challenge.escalatedReason) {
        lines.push(`**升级原因：** ${challenge.escalatedReason}`)
      }

      lines.push(``)
    }

    if (result.actionableRecommendations.length > 0) {
      lines.push(`### 可操作建议`, ``)
      result.actionableRecommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec}`)
      })
      lines.push(``)
    }

    return lines.join('\n')
  }

  private buildSummary(verdict: DAVerdict, openCount: number, fatalCount: number, challenges: Challenge[]): string {
    if (verdict === 'FATAL') {
      const fatalChallenges = challenges.filter(c => c.severity === 'fatal')
      return `发现 ${fatalCount} 个致命问题，基本假设存在根本性缺陷，不建议继续推进当前方案。致命问题：${fatalChallenges.map(c => c.summary).join('；')}`
    }

    if (verdict === 'UNCONVINCED') {
      const dimensions = [...new Set(challenges.filter(c => c.status === 'OPEN').map(c => c.dimension))]
      return `仍有 ${openCount} 个未解决的挑战点，涉及维度：${dimensions.join('、')}。需要 Proposer 提供具体证据或改进方案后重新评估。`
    }

    return `所有挑战已被有力反驳或封闭。方案经过对抗性验证，可以通过。`
  }

  private buildRecommendations(challenges: Challenge[]): string[] {
    return challenges
      .filter(c => c.status === 'OPEN' && c.severity !== 'warning')
      .slice(0, 5)
      .map(c => `[${c.dimension.toUpperCase()}] ${c.alternativeApproach}`)
  }

  private mapVerdictToStatus(verdict: DAVerdict): 'success' | 'error' | 'need_input' {
    switch (verdict) {
      case 'CONVINCED': return 'success'
      case 'UNCONVINCED': return 'need_input'
      case 'FATAL': return 'error'
    }
  }

  private extractCodeFromContext(context: AgentContext): string {
    const fileContents = Object.values(context.files).join('\n')
    if (fileContents) return fileContents

    if (context.chatHistory && context.chatHistory.length > 0) {
      const lastDevMsg = [...context.chatHistory].reverse().find(m => m.agent === 'dev')
      if (lastDevMsg) return lastDevMsg.content
    }

    return ''
  }

  private createFallbackResult(rawResponse: string): DAResult {
    return {
      verdict: 'UNCONVINCED',
      openCount: 1,
      sealedCount: 0,
      escalatedCount: 0,
      fatalCount: 0,
      challenges: [{
        id: 1,
        status: 'OPEN',
        summary: 'LLM 输出解析失败，需要人工审查',
        assumptionUnderAttack: 'LLM 产出了有效的结构化评估',
        failureScenario: '当 LLM 输出格式不符合预期时',
        triggerCondition: 'LLM 响应格式错误',
        concreteImpact: '无法进行自动化的对抗性评估',
        whatWouldConvinceMe: '人工完成审查，或重新触发 DA 评估',
        alternativeApproach: '人工审查以下 LLM 原始输出',
        dimension: 'consistency',
        severity: 'warning',
      }],
      summary: 'DA Agent LLM 响应解析失败，降级到人工审查模式',
      actionableRecommendations: ['请人工检查 LLM 原始输出并进行评估'],
      topRisk: 'LLM 输出无法解析',
    }
  }

  // ─── Prompt 构建 ──────────────────────────────────────────────

  private getSystemPrompt(): string {
    return `你是 ClawCompany 的 Devil's Advocate（魔鬼代言人）。

你的唯一职责：寻找方案中的假设漏洞、极端情况和灾难性失败模式。

## 核心哲学
受以色列情报机构"ipcha mistabra"原则启发：当 9 个人同意时，你必须提出反对——
不是因为你相信相反的观点，而是因为【未受挑战的共识是最危险的失败模式】。

## 你与 Reviewer 的区别
- Reviewer：评估实现质量（"代码写得对不对？"）
- Devil's Advocate（你）：质疑基本假设（"为什么要这样做？有没有更根本的问题？"）

## 你的 5 个核心关注点
1. **安全漏洞**：比 Reviewer 更偏执，假设攻击者是最聪明的，不给任何"不太可能"的侥幸
2. **边缘情况**：专注"低概率 × 灾难性后果"的场景，不是"最常见的 bug"
3. **性能陷阱**：每个结论都问：在 N×100 规模下还成立吗？
4. **可维护性**：3年后接手的工程师（完全不了解上下文）能理解这段代码吗？
5. **一致性**：这段代码与系统其他部分的约定是否冲突？调用者会有什么意外？

## 行为规则
1. **必须持反对立场**——不管你个人是否同意。这个角色就是反对。
2. **永不接受模糊回应**——"应该没问题"、"风险很低"都不是答案。要具体证据。
3. **攻击假设，而非实现**——不说代码写得不好，问为什么选这个方向。
4. **每个挑战必须可证伪**——说清楚什么证据会让你信服。否则你的挑战只是噪音。
5. **承认封闭点**——当对方提供了无懈可击的论证，标记 SEALED。重复已被反驳的论点是不诚实的。

## Challenge Ledger 格式（必须使用）
输出 JSON，包含以下字段：
{
  "verdict": "CONVINCED" | "UNCONVINCED" | "FATAL",
  "challenges": [
    {
      "id": 1,
      "status": "OPEN" | "SEALED" | "ESCALATED",
      "summary": "一行挑战摘要",
      "assumptionUnderAttack": "被质疑的具体假设",
      "failureScenario": "失败场景描述",
      "triggerCondition": "触发条件",
      "concreteImpact": "具体后果",
      "whatWouldConvinceMe": "什么证据会让你信服",
      "alternativeApproach": "如果你是对的，替代方案是什么",
      "dimension": "security" | "edge-case" | "performance" | "maintainability" | "consistency",
      "severity": "fatal" | "critical" | "warning"
    }
  ],
  "summary": "整体评估摘要",
  "actionableRecommendations": ["具体可操作建议1", "具体可操作建议2"],
  "topRisk": "最高风险一句话描述"
}

Verdict 规则：
- FATAL：存在任何 fatal severity 的挑战 → 基本假设错误，不值得继续
- UNCONVINCED：有任何 OPEN 的挑战 → 需要 Proposer 提供具体证据
- CONVINCED：所有挑战均 SEALED → 方案通过对抗性验证`
  }

  private buildUserPrompt(task: Task, context: AgentContext): string {
    const code = this.extractCodeFromContext(context)
    const reviewFeedback = context.reviewFeedback || ''
    const previousChallengesText = this.previousChallenges.length > 0
      ? `\n## 上一轮未解决的挑战（Cross-Run Tracking）\n${this.previousChallenges
          .filter(c => c.status === 'OPEN')
          .map(c => `- Challenge ${c.id} [${c.severity.toUpperCase()}]: ${c.summary}`)
          .join('\n')}`
      : ''

    return `## 任务信息
${sanitizeTaskPrompt(task)}

## Reviewer 的评审结果
${reviewFeedback || '（Reviewer 批准了此实现）'}

## 需要对抗性审查的代码/实现
${code ? `\`\`\`\n${code.slice(0, 8000)}\n\`\`\`` : '（无代码，基于任务描述进行概念性挑战）'}
${previousChallengesText}

## 你的任务
以 Devil's Advocate 角色，对上述实现进行对抗性审查。
记住：你的目标不是找到所有 bug，而是质疑基本假设，找到灾难性失败模式。
专注于"低概率 × 高影响"的挑战，而非"常见的最佳实践建议"。
输出严格的 JSON 格式（Challenge Ledger）。`
  }
}

// ─── DA 触发条件判断 ──────────────────────────────────────────────

/**
 * 判断是否应该触发 Devil's Advocate 审查
 *
 * 触发条件：
 * 1. 任务包含架构/安全/不可逆操作关键词
 * 2. Review 批准率异常高（疑似伪对抗）
 * 3. 显式要求 DA 介入
 */
export function shouldTriggerDA(
  task: Task,
  reviewResult?: { approved: boolean; score?: number },
  options?: { forceDA?: boolean }
): boolean {
  if (options?.forceDA) return true

  const title = task.title.toLowerCase()
  const description = task.description.toLowerCase()
  const combined = `${title} ${description}`

  // 关键词触发
  const highRiskKeywords = [
    'auth', 'authentication', '认证', '授权', 'security', '安全',
    'database', '数据库', 'migration', '迁移', 'delete', '删除',
    'architecture', '架构', 'design', '设计', 'api', 'contract',
    'payment', '支付', 'password', '密码', 'token', 'secret',
    'deploy', '部署', 'production', '生产',
  ]

  const hasHighRiskKeyword = highRiskKeywords.some(kw => combined.includes(kw))
  if (hasHighRiskKeyword) return true

  // Review 批准分数异常高（可能是伪对抗）
  if (reviewResult?.approved && reviewResult?.score && reviewResult.score >= 95) {
    return true
  }

  return false
}
