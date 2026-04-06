import { BaseOpenClawAgent } from '../core/base-agent'
import type { Task, DevResult, AgentConfig } from '../core/types'

type SessionLike = { sessionKey?: string } | null | undefined

export interface DevAgentConfig extends AgentConfig {
  runtime?: 'acp' | 'subagent'
  agentId?: string
}

export class DevAgent extends BaseOpenClawAgent<DevAgentConfig> {
  constructor(config: DevAgentConfig = {}) {
    super('dev', {
      runtime: 'acp',
      agentId: 'opencode',
      thinking: 'medium',
      ...config,
    })
  }

  async execute(task: Task, projectPath: string): Promise<DevResult> {
    const prompt = this.buildPrompt(task)

    try {
      if (this.config.runtime === 'acp') {
        const session = await this.spawnAgent(prompt, {
          runtime: 'acp',
          agentId: this.config.agentId || 'opencode',
          cwd: projectPath,
        })
        return await this.parseJSONFromSession<DevResult>(session as SessionLike, {
          success: true,
          files: [],
          summary: '任务完成',
        })
      }
    } catch (error) {
      this.log('ACP runtime 不可用，切换到 subagent')
    }

    try {
      const session = await this.spawnAgent(prompt)
      return await this.parseJSONFromSession<DevResult>(session as SessionLike, {
        success: true,
        files: [],
        summary: '任务完成',
      })
    } catch (error) {
      console.warn('Dev Agent spawnAgent 失败，使用降级模式:', error)
      // 降级到默认开发结果
      return {
        success: false,
        files: [],
        summary: `开发任务 "${task.title}" 无法执行 (降级模式 - 无法使用 sessions_spawn)`,
      }
    }
  }

  protected buildPrompt(task: Task): string {
    return `你是 Dev Agent (开发者)。

任务：${task.title}
描述：${task.description}

你的职责：
1. 理解任务需求
2. 设计技术方案
3. 实现/修改代码文件
4. 确保代码可运行

技术要求：
- 使用 TypeScript
- 遵循最佳实践
- 添加必要的注释
- 考虑错误处理
- 保持代码简洁

完成后返回 JSON:
{
  "success": true,
  "files": ["创建/修改的文件路径"],
  "summary": "实现总结"
}

注意：只返回 JSON。`
  }
}

export async function executeTask(
  task: Task,
  projectPath: string,
  config?: DevAgentConfig
): Promise<DevResult> {
  const agent = new DevAgent(config)
  return await agent.execute(task, projectPath)
}
