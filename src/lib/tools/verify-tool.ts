/**
 * VerifyTool - 代码运行时验证工具
 *
 * 让 Reviewer Agent 能在沙箱中实际运行代码片段，验证：
 * - "这个函数在输入 X 时真的返回 Y 吗？"
 * - "这段代码真的会抛出异常吗？"
 * - "这个 async 函数的行为符合预期吗？"
 *
 * 安全策略：
 * - 通过 Node.js vm 模块在隔离上下文中执行
 * - 超时保护（默认 5 秒）
 * - 禁止 require / import（只允许纯逻辑验证）
 * - 捕获并格式化运行时错误
 */

import * as vm from 'vm'
import { AgentTool, ToolResult, ToolParameterSchema } from './types'

// ---------------------------------------------------------------------------
// 输入/输出类型
// ---------------------------------------------------------------------------

export interface VerifyInput {
  /** 要验证的代码片段（TypeScript/JavaScript） */
  code: string
  /**
   * 可选：测试用例（以 JSON 形式描述输入/期望输出）
   * 格式：[{ input: any[], expected: any, description?: string }]
   * 例如：[{ input: [1, 2], expected: 3, description: "add(1,2) should be 3" }]
   */
  testCases?: VerifyTestCase[]
  /**
   * 要调用的函数名（配合 testCases 使用）
   * 若不填，则直接执行 code 并捕获最后一个表达式的值
   */
  functionName?: string
  /** 执行超时（毫秒），默认 5000 */
  timeoutMs?: number
  /** 代码语言（typescript | javascript），默认 javascript */
  language?: 'typescript' | 'javascript'
}

export interface VerifyTestCase {
  /** 函数入参列表 */
  input: unknown[]
  /** 期望的返回值（用 JSON.stringify 比较） */
  expected: unknown
  /** 测试用例描述 */
  description?: string
}

export interface VerifyTestResult {
  description: string
  input: unknown[]
  expected: unknown
  actual: unknown
  passed: boolean
  error?: string
  durationMs: number
}

export interface VerifyOutput {
  /** 直接执行（无 testCases）时的结果 */
  executionResult?: {
    value: unknown
    stdout: string[]
    error?: string
    durationMs: number
  }
  /** 测试用例结果列表 */
  testResults?: VerifyTestResult[]
  /** 汇总：通过/总数 */
  summary: {
    total: number
    passed: number
    failed: number
  }
}

// ---------------------------------------------------------------------------
// 沙箱执行辅助
// ---------------------------------------------------------------------------

/** 剥离 TypeScript 类型注解，降级为可在 vm 中执行的 JS */
function stripTypeScriptSyntax(code: string): string {
  // 移除 TypeScript 特有语法（简化处理，覆盖常见场景）
  return code
    // 移除 : type 注解（变量、参数、返回类型）
    .replace(/:\s*(?:string|number|boolean|void|null|undefined|any|never|unknown|object)[[\]|&,\s]*/g, ' ')
    // 移除泛型 <T> <T extends ...>
    .replace(/<[^>()]*>/g, '')
    // 移除 interface/type 声明块（简单处理）
    .replace(/\binterface\s+\w+\s*\{[^}]*\}/g, '')
    .replace(/\btype\s+\w+\s*=\s*[^;]+;/g, '')
    // 移除 as 类型断言
    .replace(/\s+as\s+\w[\w.[\]|&<>, ]*/g, '')
    // 移除 access modifiers
    .replace(/\b(public|private|protected|readonly)\s+/g, '')
    // 移除 export/import 类型关键字（让代码可以在 vm 中跑）
    .replace(/^export\s+default\s+/gm, 'var __defaultExport = ')
    .replace(/^export\s+(?:const|let|var|function|class)/gm, (m) => m.replace('export ', ''))
}

/** 在 vm 沙箱中运行代码，返回结果和捕获的 console.log 输出 */
function runInSandbox(
  code: string,
  sandboxExtras: Record<string, unknown> = {},
  timeoutMs = 5000
): { value: unknown; stdout: string[]; error?: string; durationMs: number } {
  const stdout: string[] = []
  const start = Date.now()

  const sandbox: Record<string, unknown> = {
    console: {
      log: (...args: unknown[]) => stdout.push(args.map(a => JSON.stringify(a)).join(' ')),
      warn: (...args: unknown[]) => stdout.push('[warn] ' + args.map(a => JSON.stringify(a)).join(' ')),
      error: (...args: unknown[]) => stdout.push('[error] ' + args.map(a => JSON.stringify(a)).join(' ')),
    },
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Promise,
    setTimeout: undefined,  // 禁止异步延迟（避免绕过超时）
    setInterval: undefined,
    ...sandboxExtras,
  }

  try {
    const context = vm.createContext(sandbox)
    const result = vm.runInContext(code, context, {
      timeout: timeoutMs,
      displayErrors: true,
      filename: 'verify-sandbox.js',
    })
    return { value: result, stdout, durationMs: Date.now() - start }
  } catch (err: unknown) {
    const e = err as Error
    return {
      value: undefined,
      stdout,
      error: e.message,
      durationMs: Date.now() - start,
    }
  }
}

// ---------------------------------------------------------------------------
// VerifyTool 实现
// ---------------------------------------------------------------------------

export class VerifyTool implements AgentTool<VerifyInput, VerifyOutput> {
  readonly name = 'verify'
  readonly description = [
    '在安全沙箱中运行 JavaScript/TypeScript 代码片段，验证其实际行为。',
    '用于 Reviewer 确认："这个函数真的有 bug 吗？" 或 "这段逻辑在边界条件下是否崩溃？"',
    '支持：(1) 直接执行代码并捕获输出；(2) 指定函数名 + testCases 批量验证。',
    '不允许 require/import，适合纯逻辑验证。',
  ].join(' ')

  readonly parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: '要验证的 TypeScript/JavaScript 代码片段。可以包含函数定义。',
      },
      functionName: {
        type: 'string',
        description: '（可选）配合 testCases 使用，指定要测试的函数名。',
      },
      testCases: {
        type: 'string', // JSON 字符串形式（ToolParameterSchema 不支持 array of object）
        description: 'JSON 格式的测试用例数组。例：[{"input":[1,2],"expected":3,"description":"add(1,2)"}]',
      },
      timeoutMs: {
        type: 'number',
        description: '执行超时毫秒数，默认 5000。',
      },
      language: {
        type: 'string',
        enum: ['javascript', 'typescript'],
        description: '代码语言，默认 javascript。TypeScript 会先剥离类型注解。',
        default: 'javascript',
      },
    },
    required: ['code'],
  } as ToolParameterSchema

  async execute(input: VerifyInput): Promise<ToolResult<VerifyOutput>> {
    const start = Date.now()

    // 预处理代码：TypeScript → JavaScript
    let jsCode = input.code
    if (input.language === 'typescript') {
      jsCode = stripTypeScriptSyntax(input.code)
    }

    const timeoutMs = input.timeoutMs ?? 5000

    // 解析 testCases（可能是字符串 JSON 或已解析的对象）
    let testCases: VerifyTestCase[] | undefined = input.testCases
    if (typeof (input as Record<string, unknown>).testCases === 'string') {
      try {
        testCases = JSON.parse((input as Record<string, unknown>).testCases as string) as VerifyTestCase[]
      } catch {
        return {
          success: false,
          error: 'testCases 格式错误，请提供合法的 JSON 数组',
          durationMs: Date.now() - start,
        }
      }
    }

    // 模式一：有测试用例 → 运行函数测试
    if (testCases && testCases.length > 0 && input.functionName) {
      return this.runTestCases(jsCode, input.functionName, testCases, timeoutMs, start)
    }

    // 模式二：仅有 testCases 但没有 functionName（尝试从代码中推断）
    if (testCases && testCases.length > 0) {
      // 尝试提取第一个函数名
      const fnMatch = jsCode.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/)
      const inferredName = fnMatch?.[1] ?? fnMatch?.[2]
      if (inferredName) {
        return this.runTestCases(jsCode, inferredName, testCases, timeoutMs, start)
      }
    }

    // 模式三：直接执行代码，捕获结果
    const execResult = runInSandbox(jsCode, {}, timeoutMs)
    const output: VerifyOutput = {
      executionResult: {
        value: execResult.value,
        stdout: execResult.stdout,
        error: execResult.error,
        durationMs: execResult.durationMs,
      },
      summary: {
        total: 1,
        passed: execResult.error ? 0 : 1,
        failed: execResult.error ? 1 : 0,
      },
    }

    return {
      success: !execResult.error,
      data: output,
      error: execResult.error,
      durationMs: Date.now() - start,
    }
  }

  private runTestCases(
    code: string,
    functionName: string,
    testCases: VerifyTestCase[],
    timeoutMs: number,
    overallStart: number
  ): ToolResult<VerifyOutput> {
    const testResults: VerifyTestResult[] = []

    for (const tc of testCases) {
      const caseStart = Date.now()
      const argsJSON = JSON.stringify(tc.input)
      // 将函数定义 + 调用包裹在一起
      const runCode = `${code}\n(${functionName})(${tc.input.map(a => JSON.stringify(a)).join(', ')})`

      const execResult = runInSandbox(runCode, {}, Math.min(timeoutMs, 10000))

      const actual = execResult.value
      let passed = false
      if (execResult.error) {
        passed = false
      } else {
        // 使用 JSON.stringify 深比较
        try {
          passed = JSON.stringify(actual) === JSON.stringify(tc.expected)
        } catch {
          passed = actual === tc.expected
        }
      }

      testResults.push({
        description: tc.description ?? `${functionName}(${argsJSON})`,
        input: tc.input,
        expected: tc.expected,
        actual: execResult.error ? `[Error: ${execResult.error}]` : actual,
        passed,
        error: execResult.error,
        durationMs: Date.now() - caseStart,
      })
    }

    const passed = testResults.filter(r => r.passed).length
    const failed = testResults.length - passed

    const output: VerifyOutput = {
      testResults,
      summary: { total: testResults.length, passed, failed },
    }

    return {
      success: failed === 0,
      data: output,
      durationMs: Date.now() - overallStart,
    }
  }

  formatResult(result: ToolResult<VerifyOutput>): string {
    if (!result.data) {
      return `[verify error] ${result.error ?? 'unknown error'}`
    }

    const d = result.data
    const lines: string[] = ['## 🔬 代码验证结果\n']

    // 直接执行模式
    if (d.executionResult) {
      const r = d.executionResult
      lines.push(`**执行时间：** ${r.durationMs}ms`)
      if (r.error) {
        lines.push(`**状态：** ❌ 运行时错误`)
        lines.push(`**错误：** \`${r.error}\``)
      } else {
        lines.push(`**状态：** ✅ 执行成功`)
        lines.push(`**返回值：** \`${JSON.stringify(r.value)}\``)
      }
      if (r.stdout.length > 0) {
        lines.push(`**控制台输出：**`)
        r.stdout.forEach(line => lines.push(`  ${line}`))
      }
      return lines.join('\n')
    }

    // 测试用例模式
    if (d.testResults) {
      const { total, passed, failed } = d.summary
      lines.push(`**汇总：** ${passed}/${total} 通过${failed > 0 ? ` ❌ ${failed} 失败` : ' ✅'}`)
      lines.push('')

      d.testResults.forEach((r, i) => {
        const icon = r.passed ? '✅' : '❌'
        lines.push(`**Case ${i + 1}** ${icon} - ${r.description}`)
        lines.push(`  输入: \`${JSON.stringify(r.input)}\``)
        lines.push(`  期望: \`${JSON.stringify(r.expected)}\``)
        lines.push(`  实际: \`${JSON.stringify(r.actual)}\``)
        if (r.error) lines.push(`  错误: \`${r.error}\``)
        lines.push(`  耗时: ${r.durationMs}ms`)
        lines.push('')
      })
    }

    return lines.join('\n')
  }
}
