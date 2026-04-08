import { ReviewAgent } from '../review-agent'
import { Task, AgentContext } from '../types'

describe('ReviewAgent', () => {
  let reviewAgent: ReviewAgent
  let mockTask: Task
  let mockContext: AgentContext

  beforeEach(() => {
    reviewAgent = new ReviewAgent()

    mockTask = {
      id: 'test-task-1',
      title: '创建登录表单组件',
      description: '实现用户登录表单',
      status: 'review',
      assignedTo: 'review',
      dependencies: [],
      files: ['src/components/LoginForm.tsx'],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockContext = {
      projectId: 'test-project',
      tasks: [],
      files: {},
      chatHistory: []
    }
  })

  it('应该正确初始化', () => {
    expect(reviewAgent.id).toBe('review-agent-1')
    expect(reviewAgent.name).toBe('Reviewer Claw')
    expect(reviewAgent.role).toBe('review')
  })

  it('应该能审查代码并生成报告', async () => {
    const response = await reviewAgent.execute(mockTask, mockContext)

    expect(response.agent).toBe('review')
    expect(response.message).toContain('代码审查报告')
    expect(response.message).toContain(mockTask.title)
    expect(response.status).toBeDefined()
  })

  it('审查报告应该包含检查项', async () => {
    const response = await reviewAgent.execute(mockTask, mockContext)

    expect(response.message).toContain('代码风格')
    expect(response.message).toContain('TypeScript')
    expect(response.message).toContain('错误处理')
    expect(response.message).toContain('可访问性')
  })

  describe('确定性代码审查 - 基于内容的代码质量检查', () => {
    describe('高质量代码应该通过审查', () => {
      it('包含完整特征的代码应该通过全部检查', async () => {
        mockContext.files = {
          'src/components/LoginForm.tsx': `
"use client";
import { useState, FormEvent } from 'react';

interface FormData { email: string; password: string; }

export default function LoginForm() {
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/login', { method: 'POST', body: JSON.stringify(formData) });
      if (!response.ok) throw new Error('Login failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="登录表单" role="form">
      <label htmlFor="email">邮箱</label>
      <input type="email" id="email" value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
      <button type="submit">提交</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.status).toBe('success')
        expect(response.message).toContain('审查通过')
      })

      it('包含 try-catch 和 aria 标签的代码应通过错误处理和可访问性检查', async () => {
        mockContext.files = {
          'src/components/Form.tsx': `
export default function Form() {
  const handleSubmit = async () => {
    try { await fetch('/api'); } catch (e) { console.error(e); }
  };
  return <form aria-label="表单"><button onClick={handleSubmit}>Submit</button></form>;
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.status).toBe('success')
      })
    })

    describe('缺少错误处理的代码应该被标记', () => {
      it('没有 try-catch 的代码应该触发错误处理警告', async () => {
        mockContext.files = {
          'src/components/Form.tsx': `
export default function Form() {
  const data = fetch('/api/data');
  return <div>{data}</div>;
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.status).toBe('need_input')
        expect(response.message).toContain('错误处理')
        expect(response.nextAgent).toBe('dev')
      })

      it('有 async 但没有 try-catch 的代码应被标记', async () => {
        mockContext.files = {
          'src/api/route.ts': `
export async function GET() {
  const data = await fetch('/api');
  return { data };
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.status).toBe('need_input')
        expect(response.message).toContain('错误处理')
      })
    })

    describe('缺少可访问性标记的代码应该被警告', () => {
      it('没有 aria 标签的表单应被标记为可访问性不足', async () => {
        mockContext.files = {
          'src/components/Form.tsx': `
export default function Form() {
  try { return <form><input /><button>Submit</button></form>; } catch(e) {}
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.message).toContain('可访问性')
      })
    })

    describe('缺少类型定义的代码应该被标记', () => {
      it('使用 any 类型的代码应被标记为类型安全不足', async () => {
        mockContext.files = {
          'src/utils.ts': `
export function processData(data: any) {
  try { return data.map((item: any) => item.value); } catch(e) { return []; }
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.message).toContain('TypeScript')
      })
    })

    describe('安全性检查', () => {
      it('使用 dangerouslySetInnerHTML 应被标记为安全问题', async () => {
        mockContext.files = {
          'src/components/Preview.tsx': `
export default function Preview({ html }: { html: string }) {
  try { return <div dangerouslySetInnerHTML={{ __html: html }} />; } catch(e) { return <div />; }
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.message).toContain('安全性')
      })

      it('使用 eval 应被标记为安全问题', async () => {
        mockContext.files = {
          'src/utils.ts': `
export function execute(code: string) {
  try { return eval(code); } catch(e) { return null; }
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.message).toContain('安全性')
      })
    })

    describe('性能优化检查', () => {
      it('在循环中使用 await 应被标记为性能问题', async () => {
        mockContext.files = {
          'src/services.ts': `
export async function processItems(items: string[]) {
  try {
    for (const item of items) {
      await fetch('/api/' + item);
    }
  } catch(e) {}
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.message).toContain('性能')
      })
    })

    describe('测试覆盖检查', () => {
      it('没有测试代码时应标记为建议', async () => {
        mockContext.files = {
          'src/components/Good.tsx': `
import { useState, FormEvent } from 'react';
export default function Good() {
  try { return <form aria-label="form"><button type="submit">OK</button></form>; } catch(e) { return null; }
}`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.message).toContain('测试覆盖')
      })

      it('有测试代码时测试覆盖检查应通过', async () => {
        mockContext.files = {
          'src/components/Good.test.tsx': `import { render } from '@testing-library/react';
describe('Good', () => {
  it('renders', () => { expect(true).toBe(true); });
});`
        }

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.message).toMatch(/✅.*测试覆盖/)
      })
    })

    describe('没有关联文件时的处理', () => {
      it('context 中没有文件内容时应基于任务描述给出建议', async () => {
        mockContext.files = {}
        mockTask.description = '实现一个简单的功能'

        const response = await reviewAgent.execute(mockTask, mockContext)

        expect(response.agent).toBe('review')
        expect(response.message).toContain('代码审查报告')
        expect(response.message).toContain(mockTask.title)
      })
    })
  })

  describe('通过审查后应该通知 PM Claw', () => {
    it('审查通过时消息应包含完成标记', async () => {
      mockContext.files = {
        'src/components/Good.tsx': `
import { useState, FormEvent } from 'react';
interface Props { name: string; }
export default function Good({ name }: Props) {
  try { return <form aria-label="表单" role="form"><button type="submit">{name}</button></form>; } catch(e) { return null; }
}`
      }

      const response = await reviewAgent.execute(mockTask, mockContext)

      if (response.status === 'success') {
        expect(response.message).toContain('PM Claw')
        expect(response.message).toContain('Done')
      }
    })
  })

  describe('需要修改时应该指定 Dev Claw', () => {
    it('审查不通过时 nextAgent 应为 dev', async () => {
      mockContext.files = {
        'src/components/Bad.tsx': `
export default function Bad() {
  const data: any = fetch('/api');
  return <div dangerouslySetInnerHTML={{ __html: data }} />;
}`
      }

      const response = await reviewAgent.execute(mockTask, mockContext)

      expect(response.status).toBe('need_input')
      expect(response.nextAgent).toBe('dev')
      expect(response.message).toContain('需要修改')
    })
  })
})
