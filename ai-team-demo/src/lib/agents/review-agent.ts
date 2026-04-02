import { BaseAgent } from '../core/base-agent'
import { Task, AgentResponse, AgentContext } from './types'

export class ReviewAgent extends BaseAgent {
  constructor() {
    super(
      'review-agent-1',
      'Reviewer Claw',
      'review',
      '负责代码审查和质量保证'
    )
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`审查代码: ${task.title}`)

    return this.executeWithLLMFallback(
      task,
      context,
      (response) => this.handleLLMResponse(response),
      () => this.review(task, context),
      this.getSystemPrompt(),
      (t) => `## 任务信息\n标题：${t.title}\n描述：${t.description}\n\n## 审查范围\n请对刚才实现的代码进行全面审查。\n\n请开始审查。`,
    )
  }

  private handleLLMResponse(response: string): AgentResponse {
    const parsed = this.parseJSONResponse<{
      checks: Array<{ name: string; passed: boolean; warning?: boolean; message?: string }>
      approved: boolean
      message: string
      suggestions: string[]
    }>(response)

    if (parsed) {
      return {
        agent: 'review',
        message: parsed.message || '代码审查完成',
        status: parsed.approved ? 'success' : 'need_input',
        nextAgent: parsed.approved ? undefined : 'dev',
      }
    }

    return {
      agent: 'review',
      message: response,
      status: 'success',
    }
  }

  private getSystemPrompt(): string {
    return `你是一个资深的技术负责人（Tech Lead）和代码审查专家（Reviewer Claw），拥有 15 年以上的开发经验。你的职责是：
1. 进行全面、深入的代码审查
2. 发现潜在的 bug、安全漏洞和性能问题
3. 确保代码符合团队标准和最佳实践
4. 提供具体的、可操作的改进建议
5. 帮助团队成员成长（通过详细的反馈）

请用 JSON 格式回复，包含以下字段：
{
  "checks": [
    {
      "name": "检查项名称",
      "passed": true | false,
      "warning": true | false,
      "message": "详细的问题描述、代码示例和改进建议"
    }
  ],
  "approved": true | false,
  "message": "完整的审查报告（使用 Markdown 格式，包含总结、问题列表、改进建议）",
  "suggestions": ["具体的改进建议1", "具体的改进建议2"],
  "score": 0-100 (代码质量评分)
}

审查原则：
- **严格但公正**：高标准，但给予建设性反馈
- **具体可行**：提供具体的代码示例和改进方案
- **教育性**：解释为什么这是个问题，如何避免
- **优先级**：区分 Critical、Warning、Info
- **鼓励**：肯定好的实现，不只是批评`
  }

  private async review(task: Task, context: AgentContext): Promise<AgentResponse> {
    const reviewResult = this.performCodeReview(task, context)

    return {
      agent: 'review',
      message: reviewResult.message,
      status: reviewResult.approved ? 'success' : 'need_input',
      nextAgent: reviewResult.approved ? undefined : 'dev',
    }
  }

  private performCodeReview(
    task: Task,
    context: AgentContext
  ): { message: string; approved: boolean } {
    const checks = this.runCodeChecks(task, context)
    const issues = checks.filter(c => !c.passed && !c.warning)
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
      message += `\n\nPM Claw，任务已完成，可以标记为 Done。`
      return { message, approved: true }
    } else {
      message += `\n## ❌ 需要修改\n\n`
      message += `请 Dev Claw 处理以下问题：\n`
      issues.forEach((issue, i) => {
        message += `${i + 1}. ${issue.message}\n`
      })
      return { message, approved: false }
    }
  }

  private getAllFileContent(context: AgentContext): string {
    return Object.values(context.files).join('\n')
  }

  private runCodeChecks(task: Task, context: AgentContext): Array<{
    name: string
    passed: boolean
    warning?: boolean
    message?: string
  }> {
    const checks = []
    const code = this.getAllFileContent(context)

    checks.push(this.checkCodeStyle(code))
    checks.push(this.checkTypeSafety(code))
    checks.push(this.checkErrorHandling(code))
    checks.push(this.checkAccessibility(code))
    checks.push(this.checkPerformance(code))
    checks.push(this.checkSecurity(code))
    checks.push(this.checkTestCoverage(code))

    return checks
  }

  private checkCodeStyle(code: string): {
    name: string; passed: boolean; warning?: boolean; message?: string
  } {
    const hasConsistentIndentation = !code || /^(  |\t|    )/m.test(code) || code.split('\n').length <= 3
    return {
      name: '代码风格',
      passed: hasConsistentIndentation,
      message: '建议使用 Prettier 格式化代码',
    }
  }

  private checkTypeSafety(code: string): {
    name: string; passed: boolean; warning?: boolean; message?: string
  } {
    if (!code) {
      return { name: 'TypeScript 类型安全', passed: true }
    }
    const hasAny = /\bany\b/.test(code)
    if (hasAny) {
      return {
        name: 'TypeScript 类型安全',
        passed: false,
        warning: true,
        message: '部分变量缺少类型定义',
      }
    }
    return { name: 'TypeScript 类型安全', passed: true }
  }

  private checkErrorHandling(code: string): {
    name: string; passed: boolean; warning?: boolean; message?: string
  } {
    if (!code) {
      return { name: '错误处理', passed: true }
    }
    const hasTryCatch = /try\s*\{/.test(code)
    const hasAsync = /async\s/.test(code) || /await\s/.test(code)
    const hasFetch = /fetch\s*\(/.test(code)
    if ((hasAsync || hasFetch) && !hasTryCatch) {
      return {
        name: '错误处理',
        passed: false,
        message: '建议添加 try-catch 错误处理',
      }
    }
    return { name: '错误处理', passed: true }
  }

  private checkAccessibility(code: string): {
    name: string; passed: boolean; warning?: boolean; message?: string
  } {
    if (!code) {
      return { name: '可访问性 (a11y)', passed: true }
    }
    const hasForm = /<form[\s>]/i.test(code) || /<input[\s>]/i.test(code) || /<button[\s>]/i.test(code)
    if (!hasForm) {
      return { name: '可访问性 (a11y)', passed: true }
    }
    const hasAria = /aria-/.test(code)
    const hasLabel = /<label[\s>]/i.test(code) || /htmlFor=/.test(code)
    const hasRole = /role=/.test(code)
    if (!hasAria && !hasLabel && !hasRole) {
      return {
        name: '可访问性 (a11y)',
        passed: false,
        warning: true,
        message: '建议添加 aria-label 属性',
      }
    }
    return { name: '可访问性 (a11y)', passed: true }
  }

  private checkPerformance(code: string): {
    name: string; passed: boolean; warning?: boolean; message?: string
  } {
    if (!code) {
      return { name: '性能优化', passed: true }
    }
    const hasAwaitInLoop = /for\s*\(.*\n?[\s\S]*?await\s/.test(code)
      || /\.forEach\(.*=>[\s\S]*?await\s/.test(code)
      || /for\s*\(\s*(?:const|let|var)\s+\w+\s+of\b[\s\S]*?await\s/.test(code)
    if (hasAwaitInLoop) {
      return {
        name: '性能优化',
        passed: false,
        warning: true,
        message: '循环中使用 await 可能导致性能问题，考虑使用 Promise.all',
      }
    }
    return { name: '性能优化', passed: true }
  }

  private checkSecurity(code: string): {
    name: string; passed: boolean; warning?: boolean; message?: string
  } {
    if (!code) {
      return { name: '安全性检查', passed: true }
    }
    const hasDangerousHTML = /dangerouslySetInnerHTML/.test(code)
    const hasEval = /\beval\s*\(/.test(code)
    const hasInnerHtml = /\.innerHTML\s*=/.test(code)
    if (hasDangerousHTML || hasEval || hasInnerHtml) {
      return {
        name: '安全性检查',
        passed: false,
        message: '请确保用户输入已正确验证，发现潜在安全风险',
      }
    }
    return { name: '安全性检查', passed: true }
  }

  private checkTestCoverage(_code: string): {
    name: string; passed: boolean; warning?: boolean; message?: string
  } {
    return {
      name: '测试覆盖',
      passed: false,
      warning: true,
      message: '建议添加单元测试',
    }
  }
}
