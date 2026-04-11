/**
 * Arbiter Agent — 最终裁决者
 *
 * 设计哲学：
 * 三方对抗流程（Proposer → Critic → Devil's Advocate）的天然缺陷是：
 * 当 Critic 批准而 DA 未被说服，或 Critic 拒绝而 DA CONVINCED，
 * 没有人拍板。流程陷入 deadlock，或更糟——沉默地以其中一方为准。
 *
 * Arbiter 解决的问题：
 * 不是找更多问题，而是【综合已有证据，做出可执行的最终判决】。
 *
 * Arbiter 的核心特征：
 * 1. 无立场：不偏袒 Reviewer 或 DA，只看证据的质量
 * 2. 终局性：Arbiter 的判决不再上诉（除非明确重启流程）
 * 3. 可解释性：每个判决都有明确的理由，不接受"感觉"
 * 4. 实用性：判决结果必须可直接执行（接受/需修改/拒绝）
 *
 * Arbiter 在流程中的位置：
 * Review → DA（可选） → **Arbiter**（当 DA 被触发时）
 *
 * 调用时机：
 * - DA 被触发后，无论 Critic 和 DA 是否一致，都调用 Arbiter
 * - 理由：当 DA 介入时，我们已经有了两份独立评估，需要综合
 * - 若 DA 未触发，Review 结果直接作为最终结果（无需 Arbiter）
 *
 * DP Score（Decision Points Score）计算：
 * - Review 质量分（0-100）权重 40%
 * - DA 挑战严重程度权重 60%
 *   - CONVINCED（所有挑战已封闭）: DA 贡献 100 分
 *   - UNCONVINCED（仅 warning）: DA 贡献 70 分
 *   - UNCONVINCED（含 critical）: DA 贡献 40 分
 *   - FATAL: DA 贡献 0 分
 */

import { BaseAgent } from '../core/base-agent'
import { Task, AgentResponse, AgentContext, AgentRole } from '../core/types'
import { sanitizeTaskPrompt } from '../utils/prompt-sanitizer'
import { z } from 'zod'
import type { DAResult, DAVerdict, Challenge } from './devil-advocate-agent'

// ─── Arbiter 类型 ──────────────────────────────────────────────

export type ArbiterDecision = 'ACCEPT' | 'REVISE' | 'REJECT'

export interface ArbiterVerdict {
  /** 最终判决：接受 / 需要修改 / 拒绝 */
  finalDecision: ArbiterDecision
  /**
   * DP Score（Decision Points Score）：0-100
   * 综合 Review 质量分（40%）+ DA 挑战评估（60%）
   */
  dpScore: number
  /** 必须修改的点（REVISE 时才有意义） */
  requiredChanges: string[]
  /** 可选改进（不影响判决，但建议处理） */
  optionalImprovements: string[]
  /** 判决理由（可解释性） */
  rationale: string
  /** Critic 与 DA 的分歧处理说明（当存在分歧时） */
  conflictResolution: string | null
  /** 判决后的下一步 Agent */
  nextAgent: AgentRole | null
  /** Arbiter 对整体流程质量的评注 */
  processNote: string
}

// ─── Zod Schema ────────────────────────────────────────────────

const ArbiterResponseSchema = z.object({
  finalDecision: z.enum(['ACCEPT', 'REVISE', 'REJECT']),
  dpScore: z.number().min(0).max(100),
  requiredChanges: z.array(z.string()).default([]),
  optionalImprovements: z.array(z.string()).default([]),
  rationale: z.string().min(1),
  conflictResolution: z.string().nullable().optional(),
  processNote: z.string().default(''),
})

// ─── Arbiter Agent ─────────────────────────────────────────────

export class ArbiterAgent extends BaseAgent {
  constructor() {
    super(
      'arbiter-1',
      'Arbiter Claw',
      'review' as AgentRole,
      '最终裁决者：综合 Critic 与 DA 的对抗性评估，做出具有终局性的判决'
    )
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`Arbiter 介入，综合裁决: ${task.title}`)

    // 从 context 中提取 Review 和 DA 的结果
    const reviewFeedback = context.reviewFeedback || ''
    const daFeedback = context.daFeedback || ''

    // 解析 DA 结果（若存在）
    let daResult: DAResult | null = null
    try {
      if (daFeedback) {
        daResult = JSON.parse(daFeedback) as DAResult
      }
    } catch {
      this.log('DA feedback 解析失败，降级到文本分析模式')
    }

    const verdict = await this.deliberate(task, context, reviewFeedback, daResult)

    return {
      agent: 'review' as AgentRole,
      message: this.formatVerdictReport(verdict, task),
      status: this.mapDecisionToStatus(verdict.finalDecision),
      nextAgent: verdict.nextAgent ?? undefined,
      metadata: {
        arbiterVerdict: verdict,
        dpScore: verdict.dpScore,
        finalDecision: verdict.finalDecision,
        requiredChangesCount: verdict.requiredChanges.length,
      },
    }
  }

  /**
   * 核心裁决逻辑
   * 优先使用 LLM（更细腻的综合判断），降级到规则系统
   */
  private async deliberate(
    task: Task,
    context: AgentContext,
    reviewFeedback: string,
    daResult: DAResult | null,
  ): Promise<ArbiterVerdict> {
    const llm = this.getLLM()

    if (llm) {
      try {
        const systemPrompt = this.getSystemPrompt()
        const userPrompt = this.buildUserPrompt(task, context, reviewFeedback, daResult)
        const response = await this.callLLM(systemPrompt, userPrompt)
        if (response) {
          return this.handleLLMResponse(response, reviewFeedback, daResult)
        }
      } catch (error) {
        this.log(`Arbiter LLM 调用失败，降级到规则系统: ${error}`)
      }
    }

    return this.ruleBasedDeliberation(reviewFeedback, daResult)
  }

  /**
   * LLM 响应处理
   */
  private handleLLMResponse(
    response: string,
    reviewFeedback: string,
    daResult: DAResult | null,
  ): ArbiterVerdict {
    const parsed = this.parseJSONResponse(response, ArbiterResponseSchema)

    if (parsed.success) {
      const data = parsed.data
      return {
        finalDecision: data.finalDecision,
        dpScore: data.dpScore,
        requiredChanges: data.requiredChanges,
        optionalImprovements: data.optionalImprovements,
        rationale: data.rationale,
        conflictResolution: data.conflictResolution ?? null,
        nextAgent: data.finalDecision !== 'ACCEPT' ? 'dev' as AgentRole : null,
        processNote: data.processNote,
      }
    }

    // LLM 解析失败 → 降级
    this.log('Arbiter LLM 响应解析失败，使用规则系统')
    return this.ruleBasedDeliberation(reviewFeedback, daResult)
  }

  /**
   * 规则系统裁决（无 LLM 或 LLM 降级时使用）
   *
   * 裁决逻辑矩阵：
   * ┌─────────────────┬─────────────┬─────────────┬─────────────┐
   * │ Review \ DA     │ CONVINCED   │ UNCONVINCED │ FATAL       │
   * ├─────────────────┼─────────────┼─────────────┼─────────────┤
   * │ Approved        │ ACCEPT      │ REVISE      │ REJECT      │
   * │ Rejected        │ REVISE*     │ REVISE      │ REJECT      │
   * └─────────────────┴─────────────┴─────────────┴─────────────┘
   * * Review Rejected + DA CONVINCED：DA 力度更强，但 Critic 的具体问题仍需解决
   *   → REVISE（以 Reviewer 的具体建议为准）
   */
  private ruleBasedDeliberation(
    reviewFeedback: string,
    daResult: DAResult | null,
  ): ArbiterVerdict {
    // 解析 Review 状态
    const reviewApproved = this.inferReviewApproval(reviewFeedback)
    const reviewScore = this.inferReviewScore(reviewFeedback)

    // 解析 DA 状态
    const daVerdict: DAVerdict | null = daResult?.verdict ?? null
    const openCriticals = daResult?.challenges.filter(
      c => c.status === 'OPEN' && (c.severity === 'critical' || c.severity === 'fatal')
    ) ?? []
    const openWarnings = daResult?.challenges.filter(
      c => c.status === 'OPEN' && c.severity === 'warning'
    ) ?? []

    // 计算 DP Score
    const dpScore = this.calculateDPScore(reviewScore, daVerdict, openCriticals.length, openWarnings.length)

    // 裁决矩阵
    let finalDecision: ArbiterDecision
    let rationale: string
    let conflictResolution: string | null = null
    let requiredChanges: string[] = []
    let optionalImprovements: string[] = []

    // FATAL → 无条件 REJECT
    if (daVerdict === 'FATAL' || (daResult?.fatalCount ?? 0) > 0) {
      finalDecision = 'REJECT'
      rationale = `DA 发现致命性假设漏洞（${daResult?.fatalCount} 个 fatal 级别问题），当前方案存在根本性缺陷，不建议在现有方向上继续迭代。`
      requiredChanges = daResult?.actionableRecommendations ?? ['需要重新设计基本方案']
    }
    // Review 批准 + DA CONVINCED → ACCEPT
    else if (reviewApproved && daVerdict === 'CONVINCED') {
      finalDecision = 'ACCEPT'
      rationale = `Critic 审查通过（分数 ${reviewScore}），DA 所有挑战均已被有力反驳或封闭。方案通过完整的对抗性验证，Arbiter 裁定接受。`
    }
    // Review 批准 + DA UNCONVINCED（有 open critical）
    else if (reviewApproved && daVerdict === 'UNCONVINCED' && openCriticals.length > 0) {
      finalDecision = 'REVISE'
      conflictResolution = `Critic 批准了代码质量，但 DA 发现 ${openCriticals.length} 个未解决的关键挑战。Arbiter 采纳 DA 的立场：这些挑战涉及假设层面的问题，代码质量合格不等于设计决策正确。`
      rationale = `尽管 Reviewer 批准了此次实现，DA 仍有 ${openCriticals.length} 个 critical/fatal 级挑战未被解决。Arbiter 裁定需要修改以回应这些挑战。`
      requiredChanges = openCriticals.map(c => `[DA挑战 #${c.id}] ${c.alternativeApproach}`)
      optionalImprovements = openWarnings.map(c => `[DA警告 #${c.id}] ${c.summary}`)
    }
    // Review 批准 + DA UNCONVINCED（仅 warning 级）
    else if (reviewApproved && daVerdict === 'UNCONVINCED' && openCriticals.length === 0) {
      finalDecision = 'ACCEPT'
      rationale = `Critic 审查通过，DA 的开放挑战均为 warning 级（无 critical/fatal）。Arbiter 裁定接受，但建议开发者关注 DA 的警告项。`
      optionalImprovements = openWarnings.map(c => `[DA警告 #${c.id}] ${c.summary}`)
    }
    // Review 拒绝 + DA CONVINCED
    else if (!reviewApproved && daVerdict === 'CONVINCED') {
      finalDecision = 'REVISE'
      conflictResolution = `DA 通过了对抗性验证（CONVINCED），但 Reviewer 发现了具体的实现质量问题。Arbiter 的立场：DA 的通过表明设计方向正确，但 Reviewer 的具体问题仍需修复。以 Reviewer 的建议为准。`
      rationale = `DA 验证了方案的基本假设，但 Reviewer 发现了实现层面的质量问题。Arbiter 裁定需要修改（聚焦 Reviewer 的具体建议）。`
      requiredChanges = this.extractReviewerRequirements(reviewFeedback)
    }
    // Review 拒绝 + DA UNCONVINCED（两者都不满意）
    else if (!reviewApproved && daVerdict === 'UNCONVINCED') {
      finalDecision = 'REVISE'
      rationale = `Critic 和 DA 均认为方案需要改进。Arbiter 综合两方意见，裁定修改（优先处理 DA 的 critical 挑战，再解决 Reviewer 的质量问题）。`
      const daRequirements = openCriticals.map(c => `[DA挑战 #${c.id}] ${c.alternativeApproach}`)
      const reviewRequirements = this.extractReviewerRequirements(reviewFeedback)
      requiredChanges = [...daRequirements, ...reviewRequirements].slice(0, 8)
      optionalImprovements = openWarnings.map(c => `[DA警告 #${c.id}] ${c.summary}`)
    }
    // 无 DA 结果时（仅基于 Review）
    else if (daVerdict === null) {
      finalDecision = reviewApproved ? 'ACCEPT' : 'REVISE'
      rationale = reviewApproved
        ? `仅基于 Reviewer 评估（DA 未介入）：代码审查通过，Arbiter 裁定接受。`
        : `仅基于 Reviewer 评估（DA 未介入）：Reviewer 发现质量问题，Arbiter 裁定需要修改。`
      if (!reviewApproved) {
        requiredChanges = this.extractReviewerRequirements(reviewFeedback)
      }
    }
    // 兜底
    else {
      finalDecision = 'REVISE'
      rationale = '无法明确判断，保守裁定为需要修改。请人工审查。'
    }

    return {
      finalDecision,
      dpScore,
      requiredChanges,
      optionalImprovements,
      rationale,
      conflictResolution,
      nextAgent: finalDecision !== 'ACCEPT' ? 'dev' as AgentRole : null,
      processNote: this.buildProcessNote(reviewApproved, daVerdict, dpScore),
    }
  }

  /**
   * DP Score 计算
   * Review 质量分（40%）+ DA 挑战评估（60%）
   */
  private calculateDPScore(
    reviewScore: number,
    daVerdict: DAVerdict | null,
    openCriticalCount: number,
    openWarningCount: number,
  ): number {
    const reviewContribution = reviewScore * 0.4

    let daContribution: number
    if (daVerdict === null) {
      // 无 DA → 仅凭 Review 分数
      return Math.round(reviewScore)
    } else if (daVerdict === 'CONVINCED') {
      daContribution = 100 * 0.6
    } else if (daVerdict === 'FATAL') {
      daContribution = 0
    } else {
      // UNCONVINCED：根据 open 挑战数量逐步降分
      const baseDaScore = openCriticalCount > 0
        ? Math.max(10, 50 - openCriticalCount * 15)
        : Math.max(50, 80 - openWarningCount * 5)
      daContribution = baseDaScore * 0.6
    }

    return Math.round(Math.min(100, Math.max(0, reviewContribution + daContribution)))
  }

  /**
   * 从 Review feedback 中推断是否批准
   */
  private inferReviewApproval(reviewFeedback: string): boolean {
    if (!reviewFeedback) return false
    const lowerFeedback = reviewFeedback.toLowerCase()
    // 负面信号
    const rejectSignals = ['需要修改', 'need_input', '❌', '不通过', 'failed', 'rejected', '问题', 'approved: false']
    if (rejectSignals.some(s => reviewFeedback.includes(s))) return false
    // 正面信号
    const approveSignals = ['审查通过', 'approved: true', '✅', '可以合并', 'success', 'passed', '通过']
    return approveSignals.some(s => reviewFeedback.includes(s))
  }

  /**
   * 从 Review feedback 中提取质量分数
   */
  private inferReviewScore(reviewFeedback: string): number {
    const scoreMatch = reviewFeedback.match(/"score"\s*:\s*(\d+)|score[：:]\s*(\d+)|\b(\d+)\/100\b/)
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3], 10)
      if (!isNaN(score) && score >= 0 && score <= 100) return score
    }
    // 无法提取时，根据批准状态给默认值
    return this.inferReviewApproval(reviewFeedback) ? 75 : 40
  }

  /**
   * 从 Review feedback 中提取具体需求/建议
   */
  private extractReviewerRequirements(reviewFeedback: string): string[] {
    const requirements: string[] = []
    const lines = reviewFeedback.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      // 提取编号列表项
      if (/^[0-9]+[.)]\s+.+/.test(trimmed) && trimmed.length > 10) {
        requirements.push(trimmed.replace(/^[0-9]+[.)]\s+/, ''))
      }
      // 提取❌/- 开头的问题描述
      else if (/^[❌\-•]\s+.+/.test(trimmed) && trimmed.length > 10) {
        requirements.push(trimmed.replace(/^[❌\-•]\s+/, ''))
      }
    }

    return requirements.slice(0, 5)
  }

  private buildProcessNote(
    reviewApproved: boolean,
    daVerdict: DAVerdict | null,
    dpScore: number,
  ): string {
    if (daVerdict === null) {
      return `本次裁决仅基于 Reviewer 评估（DA 未介入）。DP Score: ${dpScore}/100`
    }

    const conflictNote = (reviewApproved && daVerdict === 'UNCONVINCED')
      ? '⚡ 检测到 Critic/DA 分歧（Critic 批准，DA 未被说服）→ Arbiter 优先 DA 立场（设计假设 > 实现质量）'
      : (!reviewApproved && daVerdict === 'CONVINCED')
        ? '⚡ 检测到 Critic/DA 分歧（Critic 拒绝，DA CONVINCED）→ Arbiter 采纳 Critic 的具体问题（实现质量仍需修复）'
        : '✓ Critic/DA 立场一致'

    return `${conflictNote}。DP Score: ${dpScore}/100`
  }

  // ─── 格式化输出 ──────────────────────────────────────────────

  private formatVerdictReport(verdict: ArbiterVerdict, task: Task): string {
    const decisionEmoji = {
      ACCEPT: '✅',
      REVISE: '🔄',
      REJECT: '🚫',
    }

    const decisionLabel = {
      ACCEPT: '接受',
      REVISE: '需要修改',
      REJECT: '拒绝',
    }

    const lines: string[] = [
      `## ⚖️ Arbiter 最终裁决`,
      ``,
      `**任务：** ${task.title}`,
      ``,
      `### 判决结果`,
      `${decisionEmoji[verdict.finalDecision]} **${decisionLabel[verdict.finalDecision]}**`,
      ``,
      `**DP Score：** ${verdict.dpScore} / 100`,
      `> Review 质量（40%）+ DA 对抗性验证（60%）的综合评分`,
      ``,
      `### 裁决理由`,
      verdict.rationale,
      ``,
    ]

    if (verdict.conflictResolution) {
      lines.push(
        `### ⚡ 分歧处理`,
        verdict.conflictResolution,
        ``,
      )
    }

    if (verdict.requiredChanges.length > 0) {
      lines.push(`### 🔧 必须修改的点（${verdict.requiredChanges.length} 项）`, ``)
      verdict.requiredChanges.forEach((change, i) => {
        lines.push(`${i + 1}. ${change}`)
      })
      lines.push(``)
    }

    if (verdict.optionalImprovements.length > 0) {
      lines.push(`### 💡 可选改进（不影响判决）`, ``)
      verdict.optionalImprovements.forEach((imp, i) => {
        lines.push(`${i + 1}. ${imp}`)
      })
      lines.push(``)
    }

    lines.push(`---`, `*${verdict.processNote}*`)

    if (verdict.nextAgent) {
      lines.push(``, `➡️ 转交 **${verdict.nextAgent.toUpperCase()} Claw** 处理。`)
    } else {
      lines.push(``, `✅ **流程完成。** PM Claw 可标记任务为 Done。`)
    }

    return lines.join('\n')
  }

  // ─── Prompt 构建 ──────────────────────────────────────────────

  private getSystemPrompt(): string {
    return `你是 ClawCompany 的 Arbiter（仲裁者）。

你的唯一职责：在 Critic（代码审查员）和 Devil's Advocate（魔鬼代言人）的对抗性评估之后，
做出最终的、具有终局性的判决。

## 你的角色定位
- 你不是 Reviewer，不评估实现细节
- 你不是 DA，不提出新的挑战
- 你是综合证据的裁判官，只看双方论证的质量

## 裁决框架
1. **证据权重**：评估哪方的论证更有力（具体性、可证伪性、影响范围）
2. **无证据不判决**：若某方的主张缺乏具体证据，不予采信
3. **DA 的特殊权重**：当 DA 发现了 Reviewer 未发现的假设层面问题，DA 的 fatal/critical 挑战优先于 Review 的细节审查
4. **最终可执行性**：判决必须是可直接执行的（接受 or 修改 or 拒绝）

## 裁决矩阵（参考，但允许基于证据质量偏离）
- Review 批准 + DA CONVINCED → ACCEPT
- Review 批准 + DA UNCONVINCED（仅 warning）→ ACCEPT（可选改进）
- Review 批准 + DA UNCONVINCED（含 critical）→ REVISE（DA 优先）
- Review 拒绝 + DA CONVINCED → REVISE（以 Review 具体建议为准）
- 任何情况 + DA FATAL → REJECT

## DP Score 计算
Review 质量分（40%）+ DA 通过率（60%）

## 输出格式（严格 JSON）
{
  "finalDecision": "ACCEPT" | "REVISE" | "REJECT",
  "dpScore": 0-100,
  "requiredChanges": ["必须修改项1", "必须修改项2"],
  "optionalImprovements": ["可选改进1"],
  "rationale": "裁决理由（具体，引用证据）",
  "conflictResolution": "分歧处理说明（若有）或 null",
  "processNote": "流程质量评注"
}`
  }

  private buildUserPrompt(
    task: Task,
    context: AgentContext,
    reviewFeedback: string,
    daResult: DAResult | null,
  ): string {
    const daSection = daResult
      ? `## Devil's Advocate 评估结果
**判决：** ${daResult.verdict}
**开放挑战数：** ${daResult.openCount} OPEN / ${daResult.sealedCount} SEALED
**最高风险：** ${daResult.topRisk ?? '无'}

**挑战摘要：**
${daResult.challenges.map(c =>
  `- [${c.status}] #${c.id} (${c.severity}/${c.dimension}): ${c.summary}`
).join('\n')}

**可操作建议：**
${daResult.actionableRecommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : `## Devil's Advocate 评估结果\n（DA 未介入或结果不可用）`

    return `## 任务信息
${sanitizeTaskPrompt(task)}

## Reviewer（Critic）评估结果
${reviewFeedback || '（Reviewer 结果不可用）'}

${daSection}

## 你的任务
作为 Arbiter，综合以上证据，做出最终裁决。
- 若 Critic 和 DA 意见一致：确认并说明理由
- 若存在分歧：明确说明你如何权衡，最终采纳哪方立场（及为什么）
- DP Score 必须反映两方证据的综合质量
- requiredChanges 必须是具体可操作的，不是泛泛而谈

输出严格 JSON 格式。`
  }

  // ─── 辅助方法 ──────────────────────────────────────────────

  private mapDecisionToStatus(decision: ArbiterDecision): 'success' | 'error' | 'need_input' {
    switch (decision) {
      case 'ACCEPT': return 'success'
      case 'REVISE': return 'need_input'
      case 'REJECT': return 'error'
    }
  }
}
