// Dev Agent - 开发 Agent

import { BaseAgent } from './base'
import { Task, AgentResponse, AgentContext } from './types'
import { getLLMProvider } from '../llm/factory'

export class DevAgent extends BaseAgent {
  constructor() {
    super(
      'dev-agent-1',
      'Dev Agent',
      'dev',
      '负责代码实现和功能开发'
    )
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`开始开发: ${task.title}`)

    // Dev Agent 的核心逻辑：
    // 1. 理解任务需求
    // 2. 生成/修改代码
    // 3. 提交给 Review Agent

    const llmProvider = getLLMProvider()
    
    if (llmProvider) {
      const response = await this.implementWithLLM(task, context, llmProvider)
      return response
    } else {
      const response = await this.implement(task, context)
      return response
    }
  }

  private async implementWithLLM(
    task: Task,
    context: AgentContext,
    llmProvider: NonNullable<ReturnType<typeof getLLMProvider>>
  ): Promise<AgentResponse> {
    const systemPrompt = `你是一个资深的全栈开发者（Dev Agent），拥有 10 年以上的开发经验。你的职责是：
1. 深入理解任务需求和业务场景
2. 编写生产级别、高质量、可维护的代码
3. 确保代码遵循最佳实践和安全标准
4. 提供完整、可运行的实现，而不是模板或占位符

请用 JSON 格式回复，包含以下字段：
{
  "analysis": "详细的任务分析和实现思路",
  "files": [
    {
      "path": "文件路径（相对于 src/）",
      "content": "完整的文件内容（不要省略或使用 TODO）",
      "action": "create" | "modify"
    }
  ],
  "message": "给团队的回复消息（使用 Markdown 格式，说明实现细节）",
  "notes": ["重要的技术决策", "注意事项"]
}

代码质量要求：
✅ **完整性**：生成完整、可运行的代码，不要使用 TODO、FIXME 或占位符
✅ **类型安全**：所有变量、函数、组件都要有明确的 TypeScript 类型定义
✅ **错误处理**：完善的错误处理（try-catch、边界检查、用户友好的错误提示）
✅ **可访问性**：符合 WCAG 标准（aria-label、语义化 HTML、键盘导航）
✅ **性能优化**：避免不必要的重渲染、使用 React.memo/useMemo/useCallback
✅ **安全性**：输入验证、XSS 防护、敏感数据处理
✅ **可维护性**：清晰的代码结构、有意义的变量名、必要的注释
✅ **响应式设计**：适配不同屏幕尺寸（mobile-first）
✅ **用户体验**：加载状态、错误提示、成功反馈、空状态处理

技术栈规范：
- **框架**：Next.js 14 (App Router) + React 18
- **语言**：TypeScript (strict mode)
- **样式**：Tailwind CSS (使用 Tailwind 类，避免自定义 CSS)
- **状态管理**：React useState/useReducer (简单场景) 或 Zustand (复杂场景)
- **表单**：React Hook Form + Zod 验证
- **HTTP**：使用原生 fetch 或 ky 库
- **图标**：使用 Lucide React 或 Heroicons

实现原则：
1. **业务优先**：理解业务场景，实现真正有用的功能
2. **用户体验**：从用户角度思考，提供流畅的交互体验
3. **代码质量**：写出让团队成员易于理解和维护的代码
4. **测试友好**：代码结构便于编写单元测试和集成测试`

    const userPrompt = `## 任务信息
标题：${task.title}
描述：${task.description}

## 项目上下文
- **项目类型**：Next.js 14 (App Router) + React + TypeScript
- **样式方案**：Tailwind CSS
- **项目路径**：${context.projectId || 'ai-team-demo'}

## 已有资源
- 项目已有基础布局和配置
- 可以创建新的组件、API 路由、工具函数

## 实现要求
请生成**完整、可运行、生产级别**的代码实现。

**不要**：
- ❌ 使用 TODO、FIXME 或占位符
- ❌ 省略错误处理
- ❌ 忽略 TypeScript 类型
- ❌ 写模板代码或示例代码

**要**：
- ✅ 实现完整的业务逻辑
- ✅ 处理各种边界情况
- ✅ 提供良好的用户体验
- ✅ 遵循最佳实践

请开始实现。`

    try {
      const response = await llmProvider.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ])

      const parsed = this.parseLLMResponse(response)
      
      return {
        agent: 'dev',
        message: parsed.message,
        files: parsed.files,
        nextAgent: 'review',
        status: 'success'
      }
    } catch (error) {
      this.log(`LLM 调用失败，回退到规则系统: ${error}`)
      return this.implement(task, context)
    }
  }

  private parseLLMResponse(response: string): {
    analysis: string
    files: { path: string; content: string; action: 'create' | 'modify' }[]
    message: string
    notes: string[]
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        
        const files = (parsed.files || []).map((f: any) => ({
          path: f.path || 'unknown.ts',
          content: f.content || '',
          action: (f.action || 'create') as 'create' | 'modify'
        }))

        return {
          analysis: parsed.analysis || '',
          files,
          message: parsed.message || '代码实现完成',
          notes: parsed.notes || []
        }
      }
    } catch (e) {
      this.log(`解析 LLM 响应失败: ${e}`)
    }

    return {
      analysis: '',
      files: [],
      message: response,
      notes: []
    }
  }

  private async implement(task: Task, context: AgentContext): Promise<AgentResponse> {
    // 根据任务类型生成代码
    const code = this.generateCode(task, context)

    return {
      agent: 'dev',
      message: this.generateImplementationMessage(task, code),
      files: code ? [code] : undefined,
      nextAgent: 'review',
      status: 'success'
    }
  }

  private generateCode(
    task: Task,
    context: AgentContext
  ): { path: string; content: string; action: 'create' | 'modify' | 'delete' } | null {
    // 模拟代码生成逻辑
    const title = task.title.toLowerCase()

    if (title.includes('表单') || title.includes('form')) {
      return {
        path: `src/components/${this.toPascalCase(task.title)}.tsx`,
        content: this.generateFormComponent(task),
        action: 'create'
      }
    }

    if (title.includes('api') || title.includes('接口')) {
      return {
        path: `src/app/api/${this.toKebabCase(task.title)}/route.ts`,
        content: this.generateAPIRoute(task),
        action: 'create'
      }
    }

    // 默认生成一个通用组件
    return {
      path: `src/components/${this.toPascalCase(task.title)}.tsx`,
      content: this.generateGenericComponent(task),
      action: 'create'
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
    // TODO: 实现提交逻辑
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
    
    // TODO: 实现业务逻辑
    // ${task.description}
    
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
      message += `Review Agent，请帮我审查代码质量。`
    }

    return message
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '')
  }

  private toKebabCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }
}
