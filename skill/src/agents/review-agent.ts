import { BaseOpenClawAgent } from '../core/base-agent'
import type { Task, DevResult, ReviewResult, AgentConfig } from '../core/types'

type SessionLike = { sessionKey?: string } | null | undefined

export interface ReviewAgentConfig extends AgentConfig {
  checklist?: string[]
}

const DEFAULT_CHECKLIST = [
  '代码风格',
  'TypeScript 类型安全',
  '错误处理',
  '可访问性 (a11y)',
  '性能优化',
  '安全性检查',
  '代码可读性',
  '测试覆盖',
]

export class ReviewAgent extends BaseOpenClawAgent<ReviewAgentConfig> {
  constructor(config: ReviewAgentConfig = {}) {
    super('review', {
      thinking: 'high',
      checklist: DEFAULT_CHECKLIST,
      ...config,
    })
  }

  async review(task: Task, devResult: DevResult): Promise<ReviewResult> {
    const prompt = this.buildPrompt(task, devResult)

    try {
      const session = await this.spawnAgent(prompt)
      return await this.parseJSONFromSession<ReviewResult>(session as SessionLike, {
        approved: false,  // 安全修复：解析失败时拒绝通过审查
        issues: ['无法解析审查结果'],
        suggestions: [],
        summary: '审查失败：无法解析审查结果',
      })
    } catch (error) {
      console.warn('Review Agent spawnAgent 失败，使用降级模式:', error)
      // 降级到默认审查结果
      return {
        approved: false,  // 安全第一：降级模式下拒绝通过
        issues: ['审查环境不可用 (降级模式)', `具体错误: ${error instanceof Error ? error.message : '未知错误'}`],
        suggestions: ['请在完整 OpenClaw 环境中重新审查'],
        summary: `审查失败：sessions_spawn 不可用 (${task.title})`,
      }
    }
  }

  protected buildPrompt(task: Task, devResult: DevResult): string {
    const checklist = this.config.checklist || DEFAULT_CHECKLIST

    return `你是 Review Agent (代码审查)。

任务：${task.title}
描述：${task.description}

Dev Agent 的实现：
${JSON.stringify(devResult, null, 2)}

你的职责：
1. 检查代码质量
2. 安全性审查
3. 性能优化建议
4. 提出改进建议

审查清单：
${checklist.map(item => `- ${item}`).join('\n')}

审查标准：
- **通过 (approved: true)**: 代码质量良好，无严重问题
- **不通过 (approved: false)**: 存在严重问题需要修改

返回格式 (JSON):
{
  "approved": true 或 false,
  "issues": ["发现的问题1", "发现的问题2"],
  "suggestions": ["改进建议1", "改进建议2"],
  "summary": "审查总结"
}

注意：
- 只返回 JSON
- issues 只列出严重问题
- suggestions 可以包含优化建议
- summary 简洁总结审查结果`
  }
}

export async function reviewResult(
  task: Task,
  devResult: DevResult,
  config?: ReviewAgentConfig
): Promise<ReviewResult> {
  const agent = new ReviewAgent(config)
  return await agent.review(task, devResult)
}
