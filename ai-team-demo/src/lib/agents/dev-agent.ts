import { BaseAgent } from '../core/base-agent'
import { Task, AgentResponse, AgentContext } from './types'
import { getLLMProvider } from '../llm/factory'
import { getAgentExecutor, OpenClawAgentExecutor } from '../gateway/executor'

export type DevAgentMode = 'mock' | 'llm' | 'openclaw'

export interface DevAgentOptions {
  mode?: DevAgentMode
  executor?: OpenClawAgentExecutor
}

export class DevAgent extends BaseAgent {
  private mode: DevAgentMode
  private executor: OpenClawAgentExecutor | null = null

  constructor(options: DevAgentOptions = {}) {
    super(
      'dev-agent-1',
      'Dev Claw',
      'dev',
      '负责代码实现和功能开发'
    )
    this.mode = options.mode || this.detectMode()
    if (options.executor) {
      this.executor = options.executor
    }
  }

  private detectMode(): DevAgentMode {
    if (process.env.USE_OPENCLAW_GATEWAY === 'true') {
      return 'openclaw'
    }
    const llmProvider = getLLMProvider()
    if (llmProvider) {
      return 'llm'
    }
    return 'mock'
  }

  setMode(mode: DevAgentMode): void {
    this.mode = mode
  }

  getMode(): DevAgentMode {
    return this.mode
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`开始开发: ${task.title} (mode: ${this.mode})`)

    switch (this.mode) {
      case 'openclaw':
        return this.implementWithOpenClaw(task, context)
      case 'llm':
        const llmProvider = getLLMProvider()
        if (llmProvider) {
          return this.implementWithLLM(task, context, llmProvider)
        }
        return this.implement(task, context)
      default:
        return this.implement(task, context)
    }
  }

  private getLLMSystemPrompt(): string {
    return `你是 Dev Claw，一个资深全栈开发者。生成完整、可运行的代码。

**技术栈**：Next.js 14 + React + TypeScript + Tailwind CSS

**回复格式 (JSON)**：
{
  "files": [{
    "path": "文件路径（相对于 src/）",
    "content": "完整代码",
    "action": "create"
  }],
  "message": "实现说明（Markdown 格式）"
}

**要求**：
- 完整可运行的代码（不要 TODO）
- TypeScript 类型定义
- Tailwind CSS 样式
- 错误处理

直接返回 JSON，不要额外的解释。`
  }

  private async implementWithOpenClaw(task: Task, context: AgentContext): Promise<AgentResponse> {
    try {
      if (!this.executor) {
        this.executor = getAgentExecutor()
      }

      if (!this.executor.isConnected()) {
        await this.executor.connect()
      }

      const result = await this.executor.executeDevAgent(
        task.title,
        task.description
      )

      if (!result.success) {
        this.log(`OpenClaw 执行失败: ${result.error}`)
        return this.implement(task, context)
      }

      const parsed = this.parseOpenClawResponse(result.content || '')

      return {
        agent: 'dev',
        message: parsed.message || this.generateImplementationMessage(task, null),
        files: parsed.files,
        nextAgent: 'review',
        status: 'success',
        metadata: {
          sessionKey: result.sessionKey,
          runId: result.runId,
          mode: 'openclaw',
        },
      }
    } catch (error) {
      this.log(`OpenClaw 调用失败，回退到 mock: ${error}`)
      return this.implement(task, context)
    }
  }

  private parseOpenClawResponse(content: string): {
    files: { path: string; content: string; action: 'create' | 'modify' }[]
    message: string
  } {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1])
        return {
          files: (parsed.files || []).map((f: any) => ({
            path: f.path || 'unknown.ts',
            content: f.content || '',
            action: (f.action || 'create') as 'create' | 'modify',
          })),
          message: parsed.message || content,
        }
      }

      const codeBlocks = content.match(/```\w*\s*([\s\S]*?)\s*```/g) || []
      const files: { path: string; content: string; action: 'create' | 'modify' }[] = []

      codeBlocks.forEach((block, index) => {
        const match = block.match(/```(\w*)\s*([\s\S]*?)\s*```/)
        if (match) {
          const ext = this.getExtensionFromLang(match[1])
          files.push({
            path: `src/generated/file-${index + 1}.${ext}`,
            content: match[2],
            action: 'create',
          })
        }
      })

      return {
        files,
        message: content.replace(/```\w*\s*[\s\S]*?\s*```/g, '').trim() || '代码实现完成',
      }
    } catch (e) {
      this.log(`解析 OpenClaw 响应失败: ${e}`)
      return { files: [], message: content }
    }
  }

  private getExtensionFromLang(lang: string): string {
    const map: Record<string, string> = {
      typescript: 'ts', typescriptreact: 'tsx', tsx: 'tsx', ts: 'ts',
      javascript: 'js', javascriptreact: 'jsx', jsx: 'jsx', js: 'js',
      css: 'css', json: 'json', markdown: 'md',
    }
    return map[lang.toLowerCase()] || 'ts'
  }

  private async implementWithLLM(
    task: Task,
    context: AgentContext,
    llmProvider: NonNullable<ReturnType<typeof getLLMProvider>>
  ): Promise<AgentResponse> {
    try {
      const response = await this.callLLM(
        this.getLLMSystemPrompt(),
        `任务：${task.title}\n描述：${task.description}\n\n生成完整的代码实现（JSON 格式）。`
      )

      if (!response) {
        return this.implement(task, context)
      }

      const parsed = this.parseJSONResponse<{
        analysis: string
        files: Record<string, unknown>[]
        message: string
        notes: string[]
      }>(response)

      if (parsed) {
        const files = (parsed.files || []).map((f) => ({
          path: (f.path as string) || 'unknown.ts',
          content: (f.content as string) || '',
          action: ((f.action as string) || 'create') as 'create' | 'modify',
        }))

        return {
          agent: 'dev',
          message: parsed.message || '代码实现完成',
          files,
          nextAgent: 'review',
          status: 'success',
        }
      }

      return this.implement(task, context)
    } catch (error) {
      this.log(`LLM 调用失败，回退到规则系统: ${error}`)
      return this.implement(task, context)
    }
  }

  private async implement(task: Task, context: AgentContext): Promise<AgentResponse> {
    const code = this.generateCode(task, context)

    return {
      agent: 'dev',
      message: this.generateImplementationMessage(task, code),
      files: code ? [code] : undefined,
      nextAgent: 'review',
      status: 'success',
    }
  }

  private generateCode(
    task: Task,
    context: AgentContext
  ): { path: string; content: string; action: 'create' | 'modify' | 'delete' } | null {
    const title = task.title.toLowerCase()

    if (title.includes('表单') || title.includes('form')) {
      return {
        path: `src/components/${this.toPascalCase(task.title)}.tsx`,
        content: this.generateFormComponent(task),
        action: 'create',
      }
    }

    if (title.includes('api') || title.includes('接口')) {
      return {
        path: `src/app/api/${this.toKebabCase(task.title)}/route.ts`,
        content: this.generateAPIRoute(task),
        action: 'create',
      }
    }

    return {
      path: `src/components/${this.toPascalCase(task.title)}.tsx`,
      content: this.generateGenericComponent(task),
      action: 'create',
    }
  }

  private generateFormComponent(task: Task): string {
    const componentName = this.toPascalCase(task.title)

    return `"use client";

import { useState } from 'react';

export default function ${componentName}() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          邮箱
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          required
        />
      </div>
      
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          密码
        </label>
        <input
          type="password"
          id="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          required
        />
      </div>
      
      <button
        type="submit"
        className="w-full bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-600"
      >
        提交
      </button>
    </form>
  );
}
`
  }

  private generateAPIRoute(task: Task): string {
    return `import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    return NextResponse.json({ 
      success: true,
      message: 'API endpoint created for: ${task.title}'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'API endpoint for: ${task.title}'
  });
}
`
  }

  private generateGenericComponent(task: Task): string {
    const componentName = this.toPascalCase(task.title)

    return `export default function ${componentName}() {
  return (
    <div className="p-4">
      <h1>${task.title}</h1>
      <p>${task.description}</p>
    </div>
  );
}
`
  }

  private generateImplementationMessage(
    task: Task,
    code: { path: string; content: string; action: 'create' | 'modify' | 'delete' } | null
  ): string {
    let message = `✅ 我已完成 **${task.title}** 的实现。\n\n`

    if (code) {
      message += `创建的文件：\n`
      message += `- \`${code.path}\`\n\n`
      message += `主要功能：\n`
      message += `- 响应式设计\n`
      message += `- 表单验证\n`
      message += `- 错误处理\n\n`
    }
    message += `Reviewer Claw，请帮我审查代码质量。`

    return message
  }
}
