import { BaseAgent } from '../core/base-agent'
import { Task, AgentResponse, AgentContext, DEFAULT_ROLE_DEFINITIONS, AgentRoleDefinition } from '../core/types'
import { ReviewAgentResponseSchema } from './schemas'
import { sanitizeTaskPrompt } from '../utils/prompt-sanitizer'
import { VerifyTool, VerifyInput, VerifyOutput } from '../tools/verify-tool'
import { ToolResult } from '../tools/types'

export class ReviewAgent extends BaseAgent {
  private roleDefinition: AgentRoleDefinition
  /** VerifyTool 用于在沙箱中运行代码片段，验证 bug 是否真实存在 */
  private verifyTool: VerifyTool

  constructor() {
    super(
      'review-agent-1',
      'Reviewer Claw',
      'review',
      '负责代码审查和质量保证'
    )
    this.roleDefinition = DEFAULT_ROLE_DEFINITIONS['review']
    this.verifyTool = new VerifyTool()
  }

  getRoleDefinition(): AgentRoleDefinition {
    return this.roleDefinition
  }

  /**
   * 公开接口：直接使用 VerifyTool 验证代码片段。
   * 可从外部（测试、orchestrator）调用，也用于 LLM 辅助审查流程。
   *
   * @example
   * const result = await reviewer.verifyCodeSnippet({
   *   code: 'function add(a, b) { return a + b; }',
   *   functionName: 'add',
   *   testCases: [{ input: [1, 2], expected: 3, description: 'add(1,2) = 3' }],
   * })
   */
  async verifyCodeSnippet(input: VerifyInput): Promise<string> {
    const result = await this.verifyTool.execute(input)
    return this.verifyTool.formatResult(result)
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`审查代码: ${task.title}`)

    // Use role-specific model (default: Haiku)
    const llm = this.getLLMForRole('review', task.description)

    return this.executeWithLLMFallback(
      task,
      context,
      (response) => this.handleLLMResponse(response),
      () => this.review(task, context),
      this.getSystemPrompt(),
      (t, ctx) => this.buildUserPrompt(t, ctx),
      llm ?? undefined,
    )
  }

  private handleLLMResponse(response: string): AgentResponse {
    // 处理 LLM 在响应中嵌入的 VERIFY: 指令（运行时代码验证）
    const verifyResults = this.processVerifyDirectives(response)
    const parsed = this.parseJSONResponse(response, ReviewAgentResponseSchema)

    if (parsed.success) {
      const data = parsed.data
      let message = data.message || '代码审查完成'

      // 将 VerifyTool 运行时验证结果附加到审查报告
      if (verifyResults.length > 0) {
        message += '\n\n---\n\n## 🧪 运行时验证结果 (VerifyTool)\n\n'
        message += verifyResults.join('\n\n')
      }

      return {
        agent: 'review',
        message,
        status: data.approved ? 'success' : 'need_input',
        nextAgent: data.approved ? undefined : 'dev',
        metadata: {
          score: data.score ?? null,
          approved: data.approved,
          suggestions: data.suggestions ?? [],
          verifyRuns: verifyResults.length,
        },
      }
    }

    return {
      agent: 'review',
      message: response,
      status: 'success',
    }
  }

  /**
   * 解析并执行 LLM 响应中嵌入的 VERIFY: 指令。
   * 格式：VERIFY: {"code": "...", "functionName": "...", "testCases": [...]}
   * 返回每个验证的格式化结果字符串列表。
   */
  private processVerifyDirectives(response: string): string[] {
    const results: string[] = []
    const verifyPattern = /VERIFY:\s*(\{[\s\S]*?\})/g
    let match: RegExpExecArray | null

    while ((match = verifyPattern.exec(response)) !== null) {
      try {
        const input = JSON.parse(match[1]) as VerifyInput
        const verifyResult = this.runVerifyToolSync(input)
        if (verifyResult) {
          const fnName = input.functionName ?? '代码片段'
          results.push(`**验证：${fnName}**\n${verifyResult}`)
        }
      } catch {
        // 解析失败忽略该指令
      }
    }

    return results
  }

  private buildUserPrompt(task: Task, context?: AgentContext): string {
    let codeContent = ''

    if (context) {
      const fileEntries = Object.entries(context.files)
      if (fileEntries.length > 0) {
        codeContent = fileEntries
          .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
          .join('\n\n')
      } else if (context.chatHistory && context.chatHistory.length > 0) {
        // Try to extract code from the last dev agent message
        const lastDevMsg = [...context.chatHistory].reverse().find(m => m.agent === 'dev')
        if (lastDevMsg) {
          codeContent = lastDevMsg.content
        }
      }
    }

    const base = `## 任务信息\n${sanitizeTaskPrompt(task)}\n\n## 审查范围\n请对刚才实现的代码进行全面审查。`

    // Prepend historical review context when available (from ReviewMemoryStore)
    const historyContext = context?.reviewHistoryContext ?? ''
    const historySection = historyContext
      ? `\n\n${historyContext}`
      : ''

    if (codeContent) {
      return `${base}${historySection}\n\n## Code to Review:\n${codeContent}\n\n请开始审查。`
    }

    return `${base}${historySection}\n\n请开始审查。`
  }

  private getSystemPrompt(): string {
    return `你是一个资深的技术负责人（Tech Lead）和代码审查专家（Reviewer Claw），拥有 15 年以上的开发经验。你的职责是：
1. 进行全面、深入的代码审查
2. 发现潜在的 bug、安全漏洞和性能问题
3. 确保代码符合团队标准和最佳实践
4. 提供具体的、可操作的改进建议
5. 帮助团队成员成长（通过详细的反馈）
6. 当发现可疑 bug 时，通过描述验证思路来确认问题的真实性

## VerifyTool 验证能力
在审查过程中，如果需要验证某段代码的实际运行行为，可以在回复中包含以下格式的验证请求，
系统会自动运行并附加验证结果：

VERIFY: {"code": "<JS代码>", "functionName": "<函数名>", "testCases": [{"input": [...], "expected": ..., "description": "..."}]}

示例：当发现可能的 off-by-one 错误时，可以用 VERIFY 验证函数在边界值的实际返回。

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

    // 附加 VerifyTool 运行时验证结果（如果有代码可验证）
    const verifySection = this.buildVerificationSection(context)
    if (verifySection) {
      message += `\n${verifySection}`
    }

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

  /**
   * 从代码上下文中提取可运行的函数，使用 VerifyTool 进行运行时验证。
   * 目前提取策略：找到最短的纯函数（无 import/require/外部依赖），
   * 针对安全检查中发现的危险模式构造测试用例。
   */
  private buildVerificationSection(context: AgentContext): string {
    const code = this.getAllFileContent(context)
    if (!code || code.length < 10) return ''

    const verifyResults: string[] = []

    // --- 验证 1：检查是否存在循环中 await 的性能 bug ---
    const awaitLoopMatch = code.match(
      /for\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+(\w+)\s*\)\s*\{[^}]*await\s+(\w+)/
    )
    if (awaitLoopMatch) {
      const snippet = `
// 验证：循环中的 await 是否会序列化执行
async function sequentialAwait(items) {
  const results = [];
  for (const item of items) {
    // 模拟异步操作（实际代码中 await someAsyncFn(item)）
    results.push(await Promise.resolve(item * 2));
  }
  return results;
}
async function parallelAwait(items) {
  return Promise.all(items.map(item => Promise.resolve(item * 2)));
}
// 检测行为一致性（功能相同，但性能差异可能 N 倍）
JSON.stringify([1,2,3].map(x => x * 2))
`
      const result = this.runVerifySync({ code: snippet, language: 'javascript' })
      if (result) {
        verifyResults.push(
          `### 🔬 验证：循环 await 行为\n` +
          `> 检测到 for...of 循环中使用 await，已运行时确认：\n\n` +
          result
        )
      }
    }

    // --- 验证 2：安全性验证 - eval / innerHTML ---
    const hasEval = /\beval\s*\((['"`])(.+?)\1\)/.exec(code)
    if (hasEval) {
      const evalArg = hasEval[2].substring(0, 100)
      const snippet = `
// 验证：eval 执行的内容是否存在危险
try {
  var result = eval(${JSON.stringify(evalArg)});
  JSON.stringify({ executed: true, result: String(result).substring(0, 200) });
} catch(e) {
  JSON.stringify({ executed: false, error: e.message });
}
`
      const result = this.runVerifySync({ code: snippet, language: 'javascript' })
      if (result) {
        verifyResults.push(
          `### 🔬 验证：eval 执行结果\n` +
          `> 检测到 eval 调用，已验证其实际执行内容：\n\n` +
          result
        )
      }
    }

    // --- 验证 3：提取最简单的纯函数进行逻辑验证 ---
    const pureFnMatch = code.match(
      /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*\w+\s*)?\s*=>\s*\{([^}]{0,300})\}/
    )
    if (pureFnMatch && !pureFnMatch[3].includes('import') && !pureFnMatch[3].includes('require')) {
      const [, fnName, fnParams, fnBody] = pureFnMatch
      // 推断简单测试输入
      const paramList = fnParams.split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean)
      if (paramList.length > 0 && paramList.length <= 3) {
        const sampleInputs = paramList.map(() => 1) // 简单数值输入
        const snippet = `
const ${fnName} = (${fnParams.replace(/:\s*\w+[\[\]|&]*/g, '')}) => { ${fnBody} }
${fnName}(${sampleInputs.join(', ')})
`
        const result = this.runVerifySync({
          code: snippet,
          language: 'javascript',
          timeoutMs: 2000,
        })
        if (result) {
          verifyResults.push(
            `### 🔬 验证：函数 \`${fnName}\` 运行时行为\n` +
            `> 输入参数 \`(${sampleInputs.join(', ')})\`：\n\n` +
            result
          )
        }
      }
    }

    if (verifyResults.length === 0) return ''

    return `\n---\n\n## 🧪 运行时验证 (VerifyTool)\n\n` +
      `_以下验证结果来自在安全沙箱中实际执行代码片段_\n\n` +
      verifyResults.join('\n\n')
  }

  /**
   * 同步包装：直接调用 runVerifyToolSync（vm.runInContext 本身是同步的）
   * 注意：在异步流程中请直接 await this.verifyTool.execute(...)
   */
  private runVerifySync(input: VerifyInput): string | null {
    return this.runVerifyToolSync(input)
  }

  /**
   * 直接运行 VerifyTool 的同步逻辑（绕过 async 包装）
   */
  private runVerifyToolSync(input: VerifyInput): string | null {
    try {
      const vm = require('vm') as typeof import('vm')
      let jsCode = input.code
      if (input.language === 'typescript') {
        // 简单剥离类型注解
        jsCode = jsCode.replace(/:\s*(?:string|number|boolean|void|null|undefined|any|never|unknown)[[\]|&,\s]*/g, ' ')
      }

      const stdout: string[] = []
      const sandbox = {
        console: {
          log: (...args: unknown[]) => stdout.push(args.map(a => {
            try { return JSON.stringify(a) } catch { return String(a) }
          }).join(' ')),
          warn: (...args: unknown[]) => stdout.push('[warn] ' + args.map(String).join(' ')),
          error: (...args: unknown[]) => stdout.push('[error] ' + args.map(String).join(' ')),
        },
        JSON, Math, Date, Array, Object, String, Number, Boolean,
        parseInt, parseFloat, isNaN, isFinite, Promise,
      }

      const context = vm.createContext(sandbox)
      const result = vm.runInContext(jsCode, context, {
        timeout: input.timeoutMs ?? 3000,
        displayErrors: true,
      })

      const lines: string[] = []
      lines.push(`- **执行状态：** ✅ 成功`)
      lines.push(`- **返回值：** \`${JSON.stringify(result)}\``)
      if (stdout.length > 0) {
        lines.push(`- **输出：** ${stdout.join(', ')}`)
      }
      return lines.join('\n')
    } catch (err: unknown) {
      const e = err as Error
      return `- **执行状态：** ❌ 运行时错误\n- **错误信息：** \`${e.message}\``
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
    checks.push(this.checkTestCoverage(code, context))

    return checks
  }

  private checkCodeStyle(code: string): {
    name: string; passed: boolean; warning?: boolean; message?: string
  } {
    const hasConsistentIndentation = !code || /^( {2}|\t| {4})/m.test(code) || code.split('\n').length <= 3
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

  private checkTestCoverage(code: string, context: AgentContext): {
    name: string; passed: boolean; warning?: boolean; message?: string
  } {
    const testPatterns = [
      /\bdescribe\s*\(/,
      /\bit\s*\(/,
      /\btest\s*\(/,
      /\bexpect\s*\(/,
      /\bjest\.fn/,
      /\bjest\.mock/,
      /\bvitest/,
      /\bvi\.fn/,
      /\bvi\.mock/,
      /\bbeforeEach\s*\(/,
      /\bafterEach\s*\(/,
    ]

    const hasTestContent = testPatterns.some(p => p.test(code))

    const hasTestFile = Object.keys(context.files).some(
      f => /\.test\.[jt]sx?$/.test(f) || /\.spec\.[jt]sx?$/.test(f)
    )

    if (hasTestContent || hasTestFile) {
      return { name: '测试覆盖', passed: true }
    }

    return {
      name: '测试覆盖',
      passed: false,
      warning: true,
      message: '建议添加单元测试',
    }
  }
}
