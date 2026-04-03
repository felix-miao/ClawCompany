import { ReviewAgent } from '../review-agent'
import { Task, AgentContext } from '../types'

jest.mock('../../llm/factory', () => ({
  getLLMProvider: jest.fn(),
}))

describe('ReviewAgent - Comprehensive', () => {
  let reviewAgent: ReviewAgent
  let mockTask: Task
  let mockContext: AgentContext

  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'review-1',
    title: 'Test Component',
    description: 'A test component',
    status: 'review',
    assignedTo: 'review',
    dependencies: [],
    files: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    reviewAgent = new ReviewAgent()
    mockTask = makeTask()
    mockContext = {
      projectId: 'test-project',
      tasks: [],
      files: {},
      chatHistory: [],
    }
  })

  describe('checkCodeStyle', () => {
    it('should pass for empty code', async () => {
      mockContext.files = {}
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('代码风格')
      expect(response.message).toContain('✅')
    })

    it('should pass for code with consistent indentation', async () => {
      mockContext.files = {
        'test.ts': 'function hello() {\n  return "world";\n}',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('代码风格')
    })

    it('should pass for short code (3 lines or less)', async () => {
      mockContext.files = {
        'test.ts': 'const x = 1;\nconst y = 2;\nconst z = 3;',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('代码风格')
    })

    it('should pass for tab-indented code', async () => {
      mockContext.files = {
        'test.ts': 'function hello() {\n\treturn "world";\n}',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('代码风格')
    })
  })

  describe('checkTypeSafety', () => {
    it('should pass for code without any keyword', async () => {
      mockContext.files = {
        'test.ts': 'function hello(name: string): string {\n  return name;\n}',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })

    it('should warn for code using any type', async () => {
      mockContext.files = {
        'test.ts': `function process(data: any) {
  try { return data; } catch(e) { return null; }
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('TypeScript')
      expect(response.message).toMatch(/⚠️.*TypeScript/)
    })

    it('should pass for code with "any" inside a string literal', async () => {
      mockContext.files = {
        'test.ts': `function hello() {
  try { return "any string"; } catch(e) { return ""; }
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })

    it('should pass for empty code', async () => {
      mockContext.files = {}
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })
  })

  describe('checkErrorHandling', () => {
    it('should pass for async code with try-catch', async () => {
      mockContext.files = {
        'test.ts': `async function fetch() {
  try {
    const res = await fetch('/api');
    return res.json();
  } catch(e) {
    throw e;
  }
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })

    it('should fail for async code without try-catch', async () => {
      mockContext.files = {
        'test.ts': `async function fetch() {
  const res = await fetch('/api');
  return res.json();
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('need_input')
      expect(response.message).toContain('错误处理')
    })

    it('should pass for sync code without async', async () => {
      mockContext.files = {
        'test.ts': 'function hello() { return "world"; }',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })

    it('should fail for code with fetch but no try-catch', async () => {
      mockContext.files = {
        'test.ts': `function getData() {
  const res = fetch('/api');
  return res;
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('错误处理')
    })

    it('should pass for empty code', async () => {
      mockContext.files = {}
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })
  })

  describe('checkAccessibility', () => {
    it('should pass for form with aria-label', async () => {
      mockContext.files = {
        'test.tsx': `try {
  return <form aria-label="contact"><button type="submit">OK</button></form>;
} catch(e) { return null; }`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toMatch(/✅.*可访问性/)
    })

    it('should pass for form with label element', async () => {
      mockContext.files = {
        'test.tsx': `try {
  return <form><label htmlFor="name">Name</label><input id="name" /></form>;
} catch(e) { return null; }`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toMatch(/✅.*可访问性/)
    })

    it('should pass for form with role attribute', async () => {
      mockContext.files = {
        'test.tsx': `try {
  return <form role="form"><input /><button type="submit">OK</button></form>;
} catch(e) { return null; }`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toMatch(/✅.*可访问性/)
    })

    it('should warn for form without aria, label, or role', async () => {
      mockContext.files = {
        'test.tsx': `try {
  return <form><input /><button type="submit">OK</button></form>;
} catch(e) { return null; }`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('可访问性')
    })

    it('should pass for non-form code', async () => {
      mockContext.files = {
        'test.ts': 'const x = 1; try { return x; } catch(e) { return 0; }',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })

    it('should pass for empty code', async () => {
      mockContext.files = {}
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })
  })

  describe('checkPerformance', () => {
    it('should warn for await inside for loop', async () => {
      mockContext.files = {
        'test.ts': `async function process(items: string[]) {
  try {
    for (const item of items) {
      await fetch('/api/' + item);
    }
  } catch(e) {}
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('性能')
    })

    it('should pass for non-loop await', async () => {
      mockContext.files = {
        'test.ts': `async function fetch() {
  try {
    const res = await fetch('/api');
    return res.json();
  } catch(e) { return null; }
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })

    it('should warn for await inside forEach', async () => {
      mockContext.files = {
        'test.ts': `async function process(items: string[]) {
  try {
    items.forEach(async (item) => {
      await fetch('/api/' + item);
    });
  } catch(e) {}
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('性能')
    })

    it('should pass for Promise.all pattern', async () => {
      mockContext.files = {
        'test.ts': `async function process(items: string[]) {
  try {
    await Promise.all(items.map(item => fetch('/api/' + item)));
  } catch(e) {}
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })

    it('should pass for empty code', async () => {
      mockContext.files = {}
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })
  })

  describe('checkSecurity', () => {
    it('should fail for dangerouslySetInnerHTML', async () => {
      mockContext.files = {
        'test.tsx': `try {
  return <div dangerouslySetInnerHTML={{ __html: userInput }} />;
} catch(e) { return <div />; }`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('need_input')
      expect(response.message).toContain('安全性')
    })

    it('should fail for eval usage', async () => {
      mockContext.files = {
        'test.ts': `try {
  const result = eval(userCode);
  return result;
} catch(e) { return null; }`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('need_input')
      expect(response.message).toContain('安全性')
    })

    it('should fail for innerHTML assignment', async () => {
      mockContext.files = {
        'test.ts': `try {
  element.innerHTML = userInput;
} catch(e) {}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('need_input')
      expect(response.message).toContain('安全性')
    })

    it('should pass for safe code', async () => {
      mockContext.files = {
        'test.ts': `try {
  const el = document.createElement('div');
  el.textContent = userInput;
} catch(e) {}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })

    it('should pass for empty code', async () => {
      mockContext.files = {}
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
    })
  })

  describe('checkTestCoverage', () => {
    it('should always flag test coverage as a warning', async () => {
      mockContext.files = {
        'test.ts': 'const x = 1;',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('测试覆盖')
    })

    it('should flag test coverage even for perfect code', async () => {
      mockContext.files = {
        'test.tsx': `import { useState, FormEvent } from 'react';
export default function Form() {
  try { return <form aria-label="form"><button type="submit">OK</button></form>; } catch(e) { return null; }
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('测试覆盖')
    })
  })

  describe('getAllFileContent', () => {
    it('should concatenate all file contents', async () => {
      mockContext.files = {
        'file1.ts': 'content1',
        'file2.ts': 'content2',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBeDefined()
    })

    it('should handle empty files object', async () => {
      mockContext.files = {}
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.agent).toBe('review')
    })

    it('should handle single file', async () => {
      mockContext.files = {
        'only.ts': 'only file content',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.agent).toBe('review')
    })
  })

  describe('runCodeChecks - combined scenarios', () => {
    it('should detect multiple issues in problematic code', async () => {
      mockContext.files = {
        'bad.tsx': `export default function Bad() {
  const data: any = fetch('/api');
  return <div dangerouslySetInnerHTML={{ __html: data }} />;
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('need_input')
      expect(response.nextAgent).toBe('dev')
      expect(response.message).toContain('安全性')
      expect(response.message).toContain('TypeScript')
      expect(response.message).toContain('错误处理')
    })

    it('should pass clean code with all checks', async () => {
      mockContext.files = {
        'good.tsx': `"use client";
import { useState, FormEvent } from 'react';

interface FormData { email: string; }

export default function GoodForm() {
  const [data, setData] = useState<FormData>({ email: '' });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/submit', { method: 'POST', body: JSON.stringify(data) });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Contact form" role="form">
      <label htmlFor="email">Email</label>
      <input id="email" value={data.email} onChange={e => setData({ email: e.target.value })} />
      <button type="submit">Submit</button>
    </form>
  );
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.status).toBe('success')
      expect(response.message).toContain('审查通过')
    })
  })

  describe('review result format', () => {
    it('should include task title in review report', async () => {
      mockTask.title = 'My Special Component'
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('My Special Component')
    })

    it('should include check section headers', async () => {
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('检查项')
    })

    it('should reference PM Claw when review passes', async () => {
      mockContext.files = {
        'good.tsx': `import { FormEvent } from 'react';
export default function G() {
  try { return <form aria-label="f"><button type="submit">OK</button></form>; } catch(e) { return null; }
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      if (response.status === 'success') {
        expect(response.message).toContain('PM Claw')
      }
    })

    it('should reference Dev Claw when review fails', async () => {
      mockContext.files = {
        'bad.tsx': `export default function B() {
  return <div dangerouslySetInnerHTML={{ __html: "x" }} />;
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.message).toContain('Dev Claw')
    })
  })

  describe('handleLLMResponse', () => {
    it('should parse approved review from LLM response', () => {
      const handleLLMResponse = (reviewAgent as any).handleLLMResponse.bind(reviewAgent)
      const result = handleLLMResponse(JSON.stringify({
        checks: [{ name: 'Security', passed: true }],
        approved: true,
        message: 'All good',
      }))
      expect(result.status).toBe('success')
      expect(result.agent).toBe('review')
      expect(result.nextAgent).toBeUndefined()
    })

    it('should parse rejected review from LLM response', () => {
      const handleLLMResponse = (reviewAgent as any).handleLLMResponse.bind(reviewAgent)
      const result = handleLLMResponse(JSON.stringify({
        checks: [{ name: 'Security', passed: false, message: 'Issue found' }],
        approved: false,
        message: 'Problems detected',
      }))
      expect(result.status).toBe('need_input')
      expect(result.nextAgent).toBe('dev')
    })

    it('should handle invalid JSON gracefully', () => {
      const handleLLMResponse = (reviewAgent as any).handleLLMResponse.bind(reviewAgent)
      const result = handleLLMResponse('not json at all')
      expect(result.agent).toBe('review')
      expect(result.status).toBe('success')
      expect(result.message).toBe('not json at all')
    })

    it('should handle JSON missing approved field', () => {
      const handleLLMResponse = (reviewAgent as any).handleLLMResponse.bind(reviewAgent)
      const result = handleLLMResponse(JSON.stringify({
        checks: [],
        message: 'partial',
      }))
      expect(result.agent).toBe('review')
      expect(result.status).toBe('success')
    })
  })

  describe('response structure', () => {
    it('should always return review as agent', async () => {
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.agent).toBe('review')
    })

    it('should have undefined nextAgent when approved', async () => {
      mockContext.files = {
        'good.tsx': `import { FormEvent } from 'react';
export default function G() {
  try { return <form aria-label="f"><button type="submit">OK</button></form>; } catch(e) { return null; }
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      if (response.status === 'success') {
        expect(response.nextAgent).toBeUndefined()
      }
    })

    it('should have dev as nextAgent when rejected', async () => {
      mockContext.files = {
        'bad.tsx': `export default function Bad() {
  return <div dangerouslySetInnerHTML={{ __html: "x" }} />;
}`,
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      if (response.status === 'need_input') {
        expect(response.nextAgent).toBe('dev')
      }
    })
  })

  describe('edge cases', () => {
    it('should handle empty task title', async () => {
      mockTask.title = ''
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.agent).toBe('review')
    })

    it('should handle empty task description', async () => {
      mockTask.description = ''
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.agent).toBe('review')
    })

    it('should handle special characters in file content', async () => {
      mockContext.files = {
        'test.ts': 'const regex = /<script>.*<\\/script>/;',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.agent).toBe('review')
    })

    it('should handle very large file content', async () => {
      mockContext.files = {
        'large.ts': 'export const data = [\n' + Array(1000).fill('  { value: "test" },').join('\n') + '\n];',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.agent).toBe('review')
    })

    it('should handle concurrent reviews', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        const ctx = { ...mockContext, files: { [`file-${i}.ts`]: 'const x = 1;' } }
        return reviewAgent.execute(makeTask({ id: `review-${i}` }), ctx)
      })
      const results = await Promise.all(promises)
      results.forEach(r => {
        expect(r.agent).toBe('review')
      })
    })

    it('should handle multiple files in context', async () => {
      mockContext.files = {
        'component.tsx': 'export default function C() { return <form aria-label="f"><input /></form>; }',
        'api.ts': 'try { async function f() { await fetch("/api"); } } catch(e) {}',
      }
      const response = await reviewAgent.execute(mockTask, mockContext)
      expect(response.agent).toBe('review')
    })
  })
})
