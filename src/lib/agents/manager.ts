// Agent Manager - 协调和管理所有 Agent

import { PMAgent } from './pm-agent'
import { DevAgent } from './dev-agent'
import { ReviewAgent } from './review-agent'
import { TestAgent } from './test-agent'
import { DevilAdvocateAgent, shouldTriggerDA } from './devil-advocate-agent'
import { ArbiterAgent } from './arbiter-agent'
import { BaseAgent } from '../core/base-agent'
import { AgentRole, Task, AgentResponse, AgentContext } from './types'

export class AgentManager {
  private agents: Map<AgentRole, BaseAgent>
  private arbiter: ArbiterAgent

  constructor() {
    this.agents = new Map<AgentRole, BaseAgent>([
      ['pm' as AgentRole, new PMAgent()],
      ['dev' as AgentRole, new DevAgent()],
      ['review' as AgentRole, new ReviewAgent()],
      ['tester' as AgentRole, new TestAgent()],
      ['devil-advocate' as AgentRole, new DevilAdvocateAgent()],
    ])
    this.arbiter = new ArbiterAgent()
  }

  getAgent(role: AgentRole): BaseAgent | undefined {
    return this.agents.get(role)
  }

  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values())
  }

  async executeAgent(
    role: AgentRole,
    task: Task,
    context: AgentContext
  ): Promise<AgentResponse> {
    const agent = this.agents.get(role)
    if (!agent) {
      throw new Error(`Agent not found: ${role}`)
    }

    return agent.execute(task, context)
  }

  /**
   * 执行 Review Pipeline（含可选 Devil's Advocate + Arbiter）
   *
   * 流程：
   * 1. Review Agent 审查
   * 2. 判断是否触发 DA（根据任务关键词 + Review 分数）
   * 3. 若触发 DA，串行执行（DA 读取 Review 输出）
   * 4. 若 DA 被触发，由 Arbiter 做最终裁决（综合 Critic + DA）
   * 5. 返回最终结果（含各阶段产出）
   *
   * Arbiter 调用时机：
   * - 当且仅当 DA 被触发时调用 Arbiter（有两份独立评估才需要仲裁）
   * - 若 DA 未触发，Review 结果即为最终结果（无需仲裁）
   */
  async executeReviewPipeline(
    task: Task,
    context: AgentContext,
    options?: { forceDA?: boolean; skipDA?: boolean; skipArbiter?: boolean }
  ): Promise<{ reviewResult: AgentResponse; daResult?: AgentResponse; arbiterResult?: AgentResponse }> {
    // Step 1: 常规 Review
    const reviewResult = await this.executeAgent('review', task, context)

    if (options?.skipDA) {
      return { reviewResult }
    }

    // Step 2: 判断是否触发 DA
    const reviewMeta = reviewResult.metadata as { approved?: boolean; score?: number } | undefined
    const reviewForDA = reviewMeta?.approved !== undefined
      ? { approved: reviewMeta.approved, score: reviewMeta.score }
      : undefined
    const triggerDA = shouldTriggerDA(task, reviewForDA, options)

    if (!triggerDA) {
      return { reviewResult }
    }

    // Step 3: 执行 DA（串行，读取 Review 输出）
    const daContext: AgentContext = {
      ...context,
      reviewFeedback: reviewResult.message,
    }

    const daResult = await this.executeAgent('devil-advocate', task, daContext)

    if (options?.skipArbiter) {
      return { reviewResult, daResult }
    }

    // Step 4: Arbiter 最终裁决（DA 触发后必然执行）
    // 将 DA 的结构化结果注入 context（若存在）
    const daMeta = daResult.metadata as { daResult?: unknown } | undefined
    const arbiterContext: AgentContext = {
      ...daContext,
      reviewFeedback: reviewResult.message,
      daFeedback: daMeta?.daResult
        ? JSON.stringify(daMeta.daResult)
        : daResult.message,
    }

    const arbiterResult = await this.arbiter.execute(task, arbiterContext)
    return { reviewResult, daResult, arbiterResult }
  }

  getAgentInfo(): Array<{ id: string; name: string; role: AgentRole; description: string }> {
    return this.getAllAgents().map(agent => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description
    }))
  }
}

export function createAgentManager(): AgentManager {
  return new AgentManager()
}

/** @deprecated Use DI container or createAgentManager() instead */
export const agentManager = new AgentManager()

