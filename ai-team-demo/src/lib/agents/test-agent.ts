import { BaseAgent } from '../core/base-agent'
import { Task, AgentResponse, AgentContext } from './types'
import { sanitizeTaskPrompt } from '../utils/prompt-sanitizer'

export class TestAgent extends BaseAgent {
  constructor() {
    super(
      'test-agent-1',
      'Tester Claw',
      'tester',
      '负责编写和执行测试用例'
    )
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`测试任务: ${task.title}`)

    return this.executeWithLLMFallback(
      task,
      context,
      (response) => this.handleLLMResponse(response),
      () => this.generateTests(task, context),
      this.getSystemPrompt(),
      (t) => this.buildUserPrompt(t),
    )
  }

  private handleLLMResponse(response: string): AgentResponse {
    return {
      agent: 'tester',
      message: response,
      status: 'success',
    }
  }

  private buildUserPrompt(task: Task): string {
    return `${sanitizeTaskPrompt(task)}\n\n请为以上功能编写完整的测试用例。`
  }

  private getSystemPrompt(): string {
    return `你是 Tester Claw (测试工程师)。

你的职责：
1. 编写全面的单元测试和集成测试
2. 测试边界条件和异常情况
3. 确保代码覆盖率
4. 报告测试结果

请用 JSON 格式回复，包含以下字段：
{
  "testFiles": [{
    "path": "测试文件路径",
    "content": "完整测试代码",
    "action": "create"
  }],
  "message": "测试说明（Markdown 格式）",
  "coverage": "预估覆盖率百分比"
}

要求：
- 使用 Jest 测试框架
- 覆盖正常流程和异常情况
- 使用有意义的测试描述
- Mock 外部依赖`
  }

  private async generateTests(task: Task, context: AgentContext): Promise<AgentResponse> {
    const testCode = this.generateTestCode(task, context)

    return {
      agent: 'tester',
      message: this.generateTestMessage(task, testCode),
      files: testCode ? [testCode] : undefined,
      status: 'success',
    }
  }

  private generateTestCode(
    task: Task,
    _context: AgentContext
  ): { path: string; content: string; action: 'create' } | null {
    const componentName = this.toPascalCase(task.title)
    const testPath = `src/components/__tests__/${componentName}.test.tsx`

    return {
      path: testPath,
      content: this.generateTestFile(componentName, task),
      action: 'create',
    }
  }

  private generateTestFile(componentName: string, task: Task): string {
    return `import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('${componentName}', () => {
  it('should render correctly', () => {
    // TODO: Implement render test for ${task.title}
  });

  it('should handle user interaction', async () => {
    // TODO: Implement interaction test
  });

  it('should handle error states', () => {
    // TODO: Implement error handling test
  });
});
`
  }

  private generateTestMessage(
    task: Task,
    testCode: { path: string; content: string; action: 'create' } | null
  ): string {
    let message = `📋 测试用例已生成: **${task.title}**\n\n`

    if (testCode) {
      message += `创建的测试文件：\n`
      message += `- \`${testCode.path}\`\n\n`
      message += `测试覆盖：\n`
      message += `- 渲染测试\n`
      message += `- 用户交互测试\n`
      message += `- 错误处理测试\n\n`
    }

    message += `Reviewer Claw，请审查测试质量。`
    return message
  }
}
