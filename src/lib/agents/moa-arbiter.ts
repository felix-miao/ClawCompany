/**
 * MoA Arbiter — Mixture of Agents 裁决者
 *
 * 将单一 Arbiter 升级为多模型并行裁决，聚合结果以提升判决质量。
 *
 * ## 设计理念
 * 单一 LLM 的 Arbiter 存在固有偏见和盲点。通过并行调用两个独立实例
 * （可以是同一 API 的不同模型，也可以是不同 provider），然后聚合裁决，
 * 能显著减少单点失误。
 *
 * ## 启用方式
 * 设置环境变量：USE_MOA_ARBITER=true
 *
 * ## 模型配置
 * - 主模型（Primary）：与原 Arbiter 相同（CLAWCOMPANY_ARBITER_MODEL 或默认 Sonnet）
 * - 备用模型（Secondary）：MOA_SECONDARY_MODEL 环境变量指定
 *   - 若未设置，且只有一个 API key：降级为单模型（两次调用同一模型，取平均分）
 *   - 多 API key 场景：可指定不同 provider 的模型
 *
 * ## 聚合策略
 * 1. finalDecision：多数票（2:0 直接采用；1:1 分歧时采用更保守的决策）
 * 2. dpScore：加权平均（主模型权重 60%，备用模型权重 40%）
 * 3. requiredChanges：两者并集（去重）
 * 4. optionalImprovements：两者并集（去重）
 * 5. rationale：保留主模型的 rationale，附上备用模型的关键补充
 *
 * ## 降级策略
 * - 任何一个模型调用失败 → 使用另一个的结果（单模型降级）
 * - 两个模型都失败 → 规则系统降级（与原 ArbiterAgent 相同）
 * - USE_MOA_ARBITER=false 或未设置 → 直接使用原 ArbiterAgent（无变化）
 */

import { ArbiterAgent } from './arbiter-agent'
import { Task, AgentContext, AgentResponse, AgentRole } from '../core/types'
import { LLMFactory } from '../llm/factory'
import { LLMProvider } from '../llm/types'
import type { DAResult } from './devil-advocate-agent'
import { ArbiterDecision, ArbiterVerdict } from './arbiter-agent'
import { sanitizeTaskPrompt } from '../utils/prompt-sanitizer'
import { z } from 'zod'
import { extractJSONObject } from '../utils/json-parser'
import { getTemperatureForAgent } from '../llm/model-strategy'

// ─── MoA 内部类型 ─────────────────────────────────────────────

interface MoAVoteResult {
  verdict: ArbiterVerdict | null
  modelLabel: string
  success: boolean
  error?: string
}

interface MoAAggregation {
  finalDecision: ArbiterDecision
  dpScore: number
  requiredChanges: string[]
  optionalImprovements: string[]
  rationale: string
  conflictResolution: string | null
  processNote: string
  moaNote: string
}

// ─── ArbiterResponseSchema (复用 arbiter-agent 的格式) ──────────

const ArbiterResponseSchema = z.object({
  finalDecision: z.enum(['ACCEPT', 'REVISE', 'REJECT']),
  dpScore: z.number().min(0).max(100),
  requiredChanges: z.array(z.string()).default([]),
  optionalImprovements: z.array(z.string()).default([]),
  rationale: z.string().min(1),
  conflictResolution: z.string().nullable().optional(),
  processNote: z.string().default(''),
})

// ─── 保守性排序（更保守的决策胜出分歧） ─────────────────────────

const DECISION_CONSERVATISM: Record<ArbiterDecision, number> = {
  ACCEPT: 0,   // 最宽松
  REVISE: 1,   // 中间
  REJECT: 2,   // 最保守
}

function moreConservative(a: ArbiterDecision, b: ArbiterDecision): ArbiterDecision {
  return DECISION_CONSERVATISM[a] >= DECISION_CONSERVATISM[b] ? a : b
}

// ─── MoA Arbiter ──────────────────────────────────────────────

export class MoAArbiter extends ArbiterAgent {
  private readonly useMoA: boolean
  private readonly primaryLabel: string
  private readonly secondaryLabel: string

  constructor() {
    super()
    this.useMoA = process.env.USE_MOA_ARBITER === 'true'
    this.primaryLabel = process.env.MOA_PRIMARY_LABEL || 'Primary'
    this.secondaryLabel = process.env.MOA_SECONDARY_LABEL || 'Secondary'
  }

  /**
   * 主入口：MoA 模式下并行裁决并聚合，否则直接用父类逻辑
   */
  override async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    if (!this.useMoA) {
      // 直接走父类逻辑，零开销
      return super.execute(task, context)
    }

    this.log(`[MoA Arbiter] 启动多模型并行裁决: ${task.title}`)

    const reviewFeedback = context.reviewFeedback || ''
    const daFeedback = context.daFeedback || ''

    let daResult: DAResult | null = null
    try {
      if (daFeedback) {
        daResult = JSON.parse(daFeedback) as DAResult
      }
    } catch {
      this.log('[MoA Arbiter] DA feedback 解析失败，文本分析模式')
    }

    const systemPrompt = this.getMoASystemPrompt()
    const userPrompt = this.buildMoAUserPrompt(task, context, reviewFeedback, daResult)

    // 并行发起两个裁决
    const [primaryResult, secondaryResult] = await Promise.all([
      this.runVote('Primary', this.getPrimaryLLM(task.description), systemPrompt, userPrompt),
      this.runVote('Secondary', this.getSecondaryLLM(task.description), systemPrompt, userPrompt),
    ])

    this.log(
      `[MoA Arbiter] Primary=${primaryResult.success ? primaryResult.verdict?.finalDecision : 'FAILED'}, ` +
      `Secondary=${secondaryResult.success ? secondaryResult.verdict?.finalDecision : 'FAILED'}`
    )

    // 聚合
    const aggregated = this.aggregate(primaryResult, secondaryResult, reviewFeedback, daResult)

    return {
      agent: 'review' as AgentRole,
      message: this.formatMoAReport(aggregated, task),
      status: this.mapDecisionToStatusPublic(aggregated.finalDecision),
      nextAgent: aggregated.finalDecision !== 'ACCEPT' ? 'dev' as AgentRole : undefined,
      metadata: {
        moaArbiter: true,
        moaNote: aggregated.moaNote,
        primaryDecision: primaryResult.verdict?.finalDecision ?? null,
        secondaryDecision: secondaryResult.verdict?.finalDecision ?? null,
        finalDecision: aggregated.finalDecision,
        dpScore: aggregated.dpScore,
        requiredChangesCount: aggregated.requiredChanges.length,
      },
    }
  }

  // ─── LLM Provider 获取 ─────────────────────────────────────

  private getPrimaryLLM(taskDescription?: string): LLMProvider | null {
    return this.getLLMForRole('arbiter', taskDescription)
  }

  private getSecondaryLLM(taskDescription?: string): LLMProvider | null {
    // 检查是否配置了独立的 Secondary 模型
    const secondaryModel = process.env.MOA_SECONDARY_MODEL
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    // 场景1：指定了 Secondary 模型名（同 provider，不同模型）
    if (secondaryModel && anthropicKey && secondaryModel.startsWith('claude')) {
      this.log(`[MoA Arbiter] Secondary → Anthropic (${secondaryModel})`)
      return LLMFactory.createProvider({
        provider: 'anthropic',
        apiKey: anthropicKey,
        model: secondaryModel,
        temperature: getTemperatureForAgent('arbiter'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2000', 10),
      })
    }

    // 场景2：指定了 GPT 系列模型（需要 OPENAI_API_KEY）
    if (secondaryModel && openaiKey && (secondaryModel.startsWith('gpt') || secondaryModel.startsWith('o1') || secondaryModel.startsWith('o3'))) {
      this.log(`[MoA Arbiter] Secondary → OpenAI (${secondaryModel})`)
      return LLMFactory.createProvider({
        provider: 'openai',
        apiKey: openaiKey,
        model: secondaryModel,
        temperature: getTemperatureForAgent('arbiter'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2000', 10),
      })
    }

    // 场景3：有 OpenAI key 但没有显式指定 Secondary
    if (openaiKey && !secondaryModel) {
      const gptModel = process.env.OPENAI_MODEL || 'gpt-4o-mini'
      this.log(`[MoA Arbiter] Secondary → OpenAI (${gptModel}) [auto-detected]`)
      return LLMFactory.createProvider({
        provider: 'openai',
        apiKey: openaiKey,
        model: gptModel,
        temperature: getTemperatureForAgent('arbiter'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2000', 10),
      })
    }

    // 降级：只有一个 API key → 用同一个模型跑两次
    this.log('[MoA Arbiter] Secondary LLM unavailable — 使用同一模型（独立调用）')
    return this.getPrimaryLLM(taskDescription)
  }

  // ─── 单次裁决 ──────────────────────────────────────────────

  private async runVote(
    label: string,
    llm: LLMProvider | null,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<MoAVoteResult> {
    if (!llm) {
      return { verdict: null, modelLabel: label, success: false, error: 'LLM not available' }
    }

    try {
      const response = await this.callLLMWith(llm, systemPrompt, userPrompt)
      if (!response) {
        return { verdict: null, modelLabel: label, success: false, error: 'Empty response' }
      }

      const raw = extractJSONObject(response)
      if (!raw) {
        return { verdict: null, modelLabel: label, success: false, error: 'No JSON in response' }
      }

      const parsed = ArbiterResponseSchema.safeParse(raw)
      if (!parsed.success) {
        const errMsg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        return { verdict: null, modelLabel: label, success: false, error: errMsg }
      }

      const data = parsed.data
      const verdict: ArbiterVerdict = {
        finalDecision: data.finalDecision,
        dpScore: data.dpScore,
        requiredChanges: data.requiredChanges,
        optionalImprovements: data.optionalImprovements,
        rationale: data.rationale,
        conflictResolution: data.conflictResolution ?? null,
        nextAgent: data.finalDecision !== 'ACCEPT' ? 'dev' as AgentRole : null,
        processNote: data.processNote,
      }

      return { verdict, modelLabel: label, success: true }
    } catch (error) {
      return { verdict: null, modelLabel: label, success: false, error: String(error) }
    }
  }

  // ─── 聚合逻辑 ──────────────────────────────────────────────

  private aggregate(
    primary: MoAVoteResult,
    secondary: MoAVoteResult,
    reviewFeedback: string,
    daResult: DAResult | null,
  ): MoAAggregation {
    // Case 1：两者都失败 → 规则系统（通过父类私有方法无法直接调用，改为返回规则降级标记）
    if (!primary.success && !secondary.success) {
      this.log('[MoA Arbiter] 两个模型均失败，降级到规则系统')
      const fallback = this.ruleBasedFallback(reviewFeedback, daResult)
      return {
        ...fallback,
        moaNote: `⚠️ MoA 双模型均失败（${primary.error} / ${secondary.error}），降级到规则系统`,
      }
    }

    // Case 2：仅一个成功 → 单模型结果
    if (!primary.success || !secondary.success) {
      const winner = primary.success ? primary : secondary
      const loserLabel = primary.success ? secondary.modelLabel : primary.modelLabel
      const loserError = primary.success ? secondary.error : primary.error
      const v = winner.verdict!
      return {
        finalDecision: v.finalDecision,
        dpScore: v.dpScore,
        requiredChanges: v.requiredChanges,
        optionalImprovements: v.optionalImprovements,
        rationale: v.rationale,
        conflictResolution: v.conflictResolution,
        processNote: v.processNote,
        moaNote: `⚠️ MoA ${loserLabel} 失败（${loserError}），使用 ${winner.modelLabel} 单模型结果`,
      }
    }

    // Case 3：两者都成功 → 聚合
    const pv = primary.verdict!
    const sv = secondary.verdict!

    const decisionsAgree = pv.finalDecision === sv.finalDecision

    // finalDecision：一致则直接使用；分歧则取保守
    const finalDecision = decisionsAgree
      ? pv.finalDecision
      : moreConservative(pv.finalDecision, sv.finalDecision)

    // dpScore：加权平均（主 60% + 副 40%）
    const dpScore = Math.round(pv.dpScore * 0.6 + sv.dpScore * 0.4)

    // requiredChanges & optionalImprovements：去重合并
    const requiredChanges = deduplicateStrings([
      ...pv.requiredChanges,
      ...sv.requiredChanges,
    ])
    const optionalImprovements = deduplicateStrings([
      ...pv.optionalImprovements,
      ...sv.optionalImprovements,
    ])

    // rationale：主模型为主，附上副模型的补充
    const rationale = decisionsAgree
      ? pv.rationale
      : `[Primary] ${pv.rationale}\n\n[Secondary 补充] ${sv.rationale}`

    // conflictResolution：若有分歧，记录裁决说明
    const conflictResolution = !decisionsAgree
      ? `MoA 分歧：Primary=${pv.finalDecision} vs Secondary=${sv.finalDecision}。` +
        `保守原则：采用 ${finalDecision}。${pv.conflictResolution ?? ''}`
      : (pv.conflictResolution ?? sv.conflictResolution ?? null)

    const moaNote = decisionsAgree
      ? `✅ MoA 共识：${primary.modelLabel} 与 ${secondary.modelLabel} 均裁决 ${finalDecision}（DP: ${pv.dpScore} / ${sv.dpScore} → 加权 ${dpScore}）`
      : `⚡ MoA 分歧：${primary.modelLabel}=${pv.finalDecision}(${pv.dpScore}) vs ${secondary.modelLabel}=${sv.finalDecision}(${sv.dpScore})，采纳保守决策 ${finalDecision}（加权 DP: ${dpScore}）`

    return {
      finalDecision,
      dpScore,
      requiredChanges,
      optionalImprovements,
      rationale,
      conflictResolution,
      processNote: `MoA: ${primary.modelLabel}=${pv.finalDecision}(${pv.dpScore}) | ${secondary.modelLabel}=${sv.finalDecision}(${sv.dpScore}) | Final=${finalDecision}(${dpScore})`,
      moaNote,
    }
  }

  /**
   * 规则系统降级（当两个 LLM 都失败时）
   * 复用父类的 ruleBasedDeliberation（通过调用父类 deliberate 的规则分支）
   */
  private ruleBasedFallback(
    reviewFeedback: string,
    daResult: DAResult | null,
  ): Omit<MoAAggregation, 'moaNote'> {
    // 简化的规则降级（直接复用 ArbiterVerdict 的字段映射）
    const reviewApproved = reviewFeedback.includes('审查通过') ||
      reviewFeedback.includes('approved: true') ||
      reviewFeedback.includes('✅')

    const daVerdict = daResult?.verdict ?? null
    const hasFatal = (daResult?.fatalCount ?? 0) > 0

    let finalDecision: ArbiterDecision = 'REVISE'
    let rationale = '规则系统裁决（MoA LLM 降级）'

    if (hasFatal || daVerdict === 'FATAL') {
      finalDecision = 'REJECT'
      rationale = `DA 发现 ${daResult?.fatalCount ?? 1} 个 fatal 问题，规则系统裁定拒绝`
    } else if (reviewApproved && daVerdict === 'CONVINCED') {
      finalDecision = 'ACCEPT'
      rationale = 'Reviewer 批准 + DA CONVINCED，规则系统裁定接受'
    } else if (!reviewApproved || (daVerdict === 'UNCONVINCED' && (daResult?.openCount ?? 0) > 0)) {
      finalDecision = 'REVISE'
      rationale = '存在未解决问题，规则系统裁定修改'
    }

    return {
      finalDecision,
      dpScore: 50,
      requiredChanges: daResult?.actionableRecommendations ?? [],
      optionalImprovements: [],
      rationale,
      conflictResolution: null,
      processNote: '规则系统降级（MoA LLM 双失败）',
    }
  }

  // ─── 格式化输出 ──────────────────────────────────────────────

  private formatMoAReport(agg: MoAAggregation, task: Task): string {
    const decisionEmoji = { ACCEPT: '✅', REVISE: '🔄', REJECT: '🚫' }
    const decisionLabel = { ACCEPT: '接受', REVISE: '需要修改', REJECT: '拒绝' }

    const lines: string[] = [
      `## ⚖️ MoA Arbiter 最终裁决`,
      ``,
      `**任务：** ${task.title}`,
      ``,
      `> ${agg.moaNote}`,
      ``,
      `### 判决结果`,
      `${decisionEmoji[agg.finalDecision]} **${decisionLabel[agg.finalDecision]}**`,
      ``,
      `**DP Score：** ${agg.dpScore} / 100`,
      `> 多模型加权平均（Primary 60% + Secondary 40%）`,
      ``,
      `### 裁决理由`,
      agg.rationale,
      ``,
    ]

    if (agg.conflictResolution) {
      lines.push(`### ⚡ 分歧处理`, agg.conflictResolution, ``)
    }

    if (agg.requiredChanges.length > 0) {
      lines.push(`### 🔧 必须修改的点（${agg.requiredChanges.length} 项）`, ``)
      agg.requiredChanges.forEach((c, i) => lines.push(`${i + 1}. ${c}`))
      lines.push(``)
    }

    if (agg.optionalImprovements.length > 0) {
      lines.push(`### 💡 可选改进`, ``)
      agg.optionalImprovements.forEach((c, i) => lines.push(`${i + 1}. ${c}`))
      lines.push(``)
    }

    lines.push(`---`, `*${agg.processNote}*`)

    if (agg.finalDecision !== 'ACCEPT') {
      lines.push(``, `➡️ 转交 **DEV Claw** 处理。`)
    } else {
      lines.push(``, `✅ **流程完成。** PM Claw 可标记任务为 Done。`)
    }

    return lines.join('\n')
  }

  // ─── Prompt ──────────────────────────────────────────────────

  private getMoASystemPrompt(): string {
    return `你是 ClawCompany 的 Arbiter（仲裁者），参与 Mixture of Agents 并行裁决。

你是多个独立 Arbiter 实例之一。你的裁决将与另一个实例的裁决通过加权聚合合并。

## 你的职责
在 Critic（代码审查员）和 Devil's Advocate（魔鬼代言人）的评估之后，
做出终局性的、可解释的判决。

## 裁决框架
1. 无立场：不偏袒 Reviewer 或 DA，只看论证质量
2. DA FATAL/critical > Review 细节：假设层面的问题优先于实现细节
3. 可执行性：判决必须是 ACCEPT / REVISE / REJECT 之一

## DP Score 计算
Review 质量分（40%）+ DA 通过率（60%）

## 裁决矩阵
- Review 批准 + DA CONVINCED → ACCEPT
- Review 批准 + DA UNCONVINCED（仅 warning）→ ACCEPT（建议改进）
- Review 批准 + DA UNCONVINCED（含 critical）→ REVISE（DA 优先）
- Review 拒绝 + DA CONVINCED → REVISE（以 Review 具体建议为准）
- 任何情况 + DA FATAL → REJECT

## 输出格式（严格 JSON）
{
  "finalDecision": "ACCEPT" | "REVISE" | "REJECT",
  "dpScore": 0-100,
  "requiredChanges": ["必须修改项1"],
  "optionalImprovements": ["可选改进1"],
  "rationale": "裁决理由（具体，引用证据）",
  "conflictResolution": "分歧处理说明或 null",
  "processNote": "流程质量评注"
}`
  }

  private buildMoAUserPrompt(
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
作为 MoA Arbiter 的一个独立实例，基于以上证据做出裁决。
- 聚焦于证据质量，不依赖直觉
- requiredChanges 必须具体可操作
- 输出严格 JSON 格式`
  }

  // ─── 公开辅助（绕过父类 private 访问限制） ──────────────────

  mapDecisionToStatusPublic(decision: ArbiterDecision): 'success' | 'error' | 'need_input' {
    switch (decision) {
      case 'ACCEPT': return 'success'
      case 'REVISE': return 'need_input'
      case 'REJECT': return 'error'
    }
  }
}

// ─── 工厂函数 ─────────────────────────────────────────────────

/**
 * 根据环境变量返回合适的 Arbiter 实例。
 * USE_MOA_ARBITER=true → MoAArbiter（多模型并行）
 * 其他 → ArbiterAgent（原始单模型）
 */
export function createArbiter(): ArbiterAgent {
  const useMoA = process.env.USE_MOA_ARBITER === 'true'
  if (useMoA) {
    console.log('[Arbiter Factory] 🤝 MoA Arbiter 已启用（多模型并行裁决）')
    return new MoAArbiter()
  }
  return new ArbiterAgent()
}

// ─── 工具函数 ─────────────────────────────────────────────────

/**
 * 对字符串数组去重（保留首次出现顺序）
 * 简单相似度匹配：如果两个字符串的前 30 个字符相同，视为重复
 */
function deduplicateStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    const key = item.trim().slice(0, 30).toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }

  return result
}
