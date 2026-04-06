import { BaseOpenClawAgent } from '../core/base-agent'
import type { PMResult, AgentConfig } from '../core/types'

type SessionLike = { sessionKey?: string } | null | undefined

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PMAgentConfig extends AgentConfig {}

export class PMAgent extends BaseOpenClawAgent<PMAgentConfig> {
  constructor(config: PMAgentConfig = {}) {
    super('pm', {
      thinking: 'high',
      model: 'glm-5',
      ...config,
    })
  }

  async analyze(userRequest: string): Promise<PMResult> {
    const prompt = this.buildPrompt(userRequest)

    try {
      const session = await this.spawnAgent(prompt)
      return await this.parseJSONFromSession<PMResult>(session as SessionLike, {
        analysis: '自动生成的任务分解',
        tasks: [{
          id: 'task-1',
          title: '实现用户需求',
          description: '根据用户需求实现核心功能',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending',
          files: [],
        }],
      })
    } catch (error) {
      console.warn('PM Agent spawnAgent 失败，使用降级模式:', error)
      // 降级到简单的本地解析
      return {
        analysis: `用户需求: ${userRequest} (降级模式 - 无法使用 sessions_spawn)`,
        tasks: [{
          id: 'task-1',
          title: '实现用户需求',
          description: `根据用户需求 "${userRequest}" 实现核心功能 (降级模式)`,
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending',
          files: [],
        }],
      }
    }
  }

  protected buildPrompt(userRequest: string): string {
    return `你是 PM Agent (产品经理)。

用户需求：${userRequest}

你的职责：
1. 分析用户需求，理解核心功能
2. 拆分成可执行的子任务（2-5 个）
3. 为每个任务指定负责人 (dev)
4. 设置任务依赖关系

任务拆分原则：
- 每个任务应该独立可完成
- 任务粒度适中（不要太细也不要太粗）
- 考虑依赖关系（先完成依赖项）

返回格式 (JSON):
{
  "analysis": "需求分析，包括核心功能和技术要点...",
  "tasks": [
    {
      "id": "task-1",
      "title": "任务标题",
      "description": "详细的任务描述",
      "assignedTo": "dev",
      "dependencies": [],
      "status": "pending"
    }
  ]
}

注意：只返回 JSON，不要有其他内容。`
  }
}

export async function analyzeRequest(
  userRequest: string,
  config?: PMAgentConfig
): Promise<PMResult> {
  const agent = new PMAgent(config)
  return await agent.analyze(userRequest)
}
