// Agent Manager - 协调和管理所有 Agent

import { PMAgent } from './pm-agent'
import { DevAgent } from './dev-agent'
import { ReviewAgent } from './review-agent'
import { BaseAgent } from '../core/base-agent'
import { AgentRole, Task, AgentResponse, AgentContext } from './types'

export class AgentManager {
  private agents: Map<AgentRole, BaseAgent>

  constructor() {
    this.agents = new Map<AgentRole, BaseAgent>([
      ['pm' as AgentRole, new PMAgent()],
      ['dev' as AgentRole, new DevAgent()],
      ['review' as AgentRole, new ReviewAgent()]
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

  getAgentInfo(): Array<{ id: string; name: string; role: AgentRole; description: string }> {
    return this.getAllAgents().map(agent => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description
    }))
  }
}

// 单例实例
export const agentManager = new AgentManager()
