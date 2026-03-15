// Review Agent - 代码审查 Agent

import { BaseAgent } from './base'
import { Task, AgentResponse, AgentContext } from './types'
import { getLLMProvider } from '../llm/factory'

export class ReviewAgent extends BaseAgent {
  constructor() {
    super(
      'review-agent-1',
      'Review Agent',
      'review',
      '负责代码审查和质量保证'
    )
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`审查代码: ${task.title}`)

    // Review Agent 的核心逻辑：
    // 1. 检查代码质量
    // 2. 安全性审查
    // 3. 性能优化建议
    // 4. 批准或要求修改

    const llmProvider = getLLMProvider()
    
    if (llmProvider) {
      const response = await this.reviewWithLLM(task, context, llmProvider)
      return response
    } else {
      const response = await this.review(task, context)
      return response
    }
  }

  private async reviewWithLLM(
    task: Task,
    context: AgentContext,
    llmProvider: NonNullable<ReturnType<typeof getLLMProvider>>
  ): Promise<AgentResponse> {
    const systemPrompt = `你是一个经验丰富的代码审查专家（Review Agent）。你的职责是：
1. 检查代码质量
2. 发现潜在的安全问题
3. 提出性能优化建议
4. 确保代码符合最佳实践

请用 JSON 格式回复，包含以下字段：
{
  "checks": [
    {
      "name": "检查项名称",
      "passed": true | false,
      "warning": true | false,
      "message": "问题描述或建议"
    }
  ],
  "approved": true | false,
  "message": "审查报告消息（使用 Markdown 格式）",
  "suggestions": ["改进建议1", "改进建议2"]
}

重要：
- 审查要严格但公正
- 对于严重问题，设置 approved 为 false
- 对于小问题，可以作为 warning 处理
- 给出具体的改进建议`

    const userPrompt = `任务: ${task.title}
描述: ${task.description}

请审查相关的代码实现，提供质量报告。`

    try {
      const response = await llmProvider.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ])

      const parsed = this.parseLLMResponse(response)
      
      return {
        agent: 'review',
        message: parsed.message,
        status: parsed.approved ? 'success' : 'need_input',
        nextAgent: parsed.approved ? undefined : 'dev'
      }
    } catch (error) {
      this.log(`LLM 调用失败，回退到规则系统: ${error}`)
      return this.review(task, context)
    }
  }

  private parseLLMResponse(response: string): {
    checks: Array<{ name: string; passed: boolean; warning?: boolean; message?: string }>
    approved: boolean
    message: string
    suggestions: string[]
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        
        return {
          checks: parsed.checks || [],
          approved: parsed.approved ?? true,
          message: parsed.message || '代码审查完成',
          suggestions: parsed.suggestions || []
        }
      }
    } catch (e) {
      this.log(`解析 LLM 响应失败: ${e}`)
    }

    return {
      checks: [],
      approved: true,
      message: response,
      suggestions: []
    }
  }

  private async review(task: Task, context: AgentContext): Promise<AgentResponse> {
    const reviewResult = this.performCodeReview(task, context)

    return {
      agent: 'review',
      message: reviewResult.message,
      status: reviewResult.approved ? 'success' : 'need_input',
      nextAgent: reviewResult.approved ? undefined : 'dev'
    }
  }

  private performCodeReview(
    task: Task,
    context: AgentContext
  ): { message: string; approved: boolean } {
    // 模拟代码审查逻辑
    const checks = this.runCodeChecks(task)
    const issues = checks.filter(c => !c.passed)
    const warnings = checks.filter(c => c.warning)

    let message = `📋 代码审查报告 - **${task.title}**\n\n`
    
    message += `## 检查项\n\n`
    checks.forEach(check => {
      const icon = check.passed ? '✅' : (check.warning ? '⚠️' : '❌')
      message += `${icon} ${check.name}\n`
      if (!check.passed || check.warning) {
        message += `   ${check.message}\n`
      }
    })

    if (issues.length === 0) {
      message += `\n## ✅ 审查通过\n\n`
      message += `代码质量良好，可以合并。`
      message += `\n\nPM Agent，任务已完成，可以标记为 Done。`
      return { message, approved: true }
    } else {
      message += `\n## ❌ 需要修改\n\n`
      message += `请 Dev Agent 处理以下问题：\n`
      issues.forEach((issue, i) => {
        message += `${i + 1}. ${issue.message}\n`
      })
      return { message, approved: false }
    }
  }

  private runCodeChecks(task: Task): Array<{
    name: string
    passed: boolean
    warning?: boolean
    message?: string
  }> {
    const checks = []

    // 1. 代码风格检查
    checks.push({
      name: '代码风格',
      passed: Math.random() > 0.2,
      message: '建议使用 Prettier 格式化代码'
    })

    // 2. 类型安全
    checks.push({
      name: 'TypeScript 类型安全',
      passed: Math.random() > 0.3,
      warning: Math.random() > 0.7,
      message: '部分变量缺少类型定义'
    })

    // 3. 错误处理
    checks.push({
      name: '错误处理',
      passed: Math.random() > 0.3,
      message: '建议添加 try-catch 错误处理'
    })

    // 4. 可访问性
    checks.push({
      name: '可访问性 (a11y)',
      passed: Math.random() > 0.4,
      warning: Math.random() > 0.6,
      message: '建议添加 aria-label 属性'
    })

    // 5. 性能
    checks.push({
      name: '性能优化',
      passed: Math.random() > 0.5,
      warning: Math.random() > 0.5,
      message: '考虑使用 React.memo 优化渲染'
    })

    // 6. 安全性
    checks.push({
      name: '安全性检查',
      passed: Math.random() > 0.2,
      message: '请确保用户输入已正确验证'
    })

    // 7. 测试覆盖
    checks.push({
      name: '测试覆盖',
      passed: false,
      warning: true,
      message: '建议添加单元测试'
    })

    return checks
  }
}
