// Agent Manager - 协调和管理所有 Agent

import { PMAgent } from './pm-agent'
import { DevAgent } from './dev-agent'
import { ReviewAgent } from './review-agent'
import { TestAgent } from './test-agent'
import { DevilAdvocateAgent, shouldTriggerDA } from './devil-advocate-agent'
import { BaseAgent } from '../core/base-agent'
import { AgentRole, Task, AgentResponse, AgentContext } from './types'

export class AgentManager {
  private agents: Map<AgentRole, BaseAgent>

  constructor() {
    this.agents = new Map<AgentRole, BaseAgent>([
      ['pm' as AgentRole, new PMAgent()],
      ['dev' as AgentRole, new DevAgent()],
      ['review' as AgentRole, new ReviewAgent()],
      ['tester' as AgentRole, new TestAgent()],
      ['devil-advocate' as AgentRole, new DevilAdvocateAgent()],
    ])
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
   * 执行 Review Pipeline（含可选 Devil's Advocate）
   *
   * 流程：
   * 1. Review Agent 审查
   * 2. 判断是否触发 DA（根据任务关键词 + Review 分数）
   * 3. 若触发 DA，串行执行（DA 读取 Review 输出）
   * 4. 返回最终结果
   */
  async executeReviewPipeline(
    task: Task,
    context: AgentContext,
    options?: { forceDA?: boolean; skipDA?: boolean }
  ): Promise<{ reviewResult: AgentResponse; daResult?: AgentResponse }> {
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
    return { reviewResult, daResult }
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

