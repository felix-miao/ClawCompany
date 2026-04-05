import { NextRequest } from 'next/server'

import { InputValidator } from '@/lib/security/utils'
import { SandboxedFileWriter } from '@/lib/security/sandbox'
import { StorageManager } from '@/lib/storage/manager'
import { GitManager } from '@/lib/git/manager'
import { defaultAgents } from '@/lib/agents/config'
import { PersistedAgentConfigSchema } from '@/types/agent-config'
import type { PersistedAgentConfig } from '@/types/agent-config'
import { withRateLimit, withAuth, successResponse, errorResponse } from '@/lib/api/route-utils'
import { getLLMProvider } from '@/lib/llm/factory'
import { AgentPostRequestSchema, AgentPutRequestSchema, parseRequestBody } from '@/lib/api/schemas'
import { logger } from '@/lib/core/logger'
import { parseCodeBlocks } from './parse-code-blocks'

const sandboxedWriter = new SandboxedFileWriter(process.cwd())
const storageManager = new StorageManager()
const gitManager = new GitManager(process.cwd())

export const POST = withAuth(withRateLimit(async (request: NextRequest) => {
  const body: unknown = await request.json()
  const parsed = parseRequestBody(AgentPostRequestSchema, body)
  if ('error' in parsed) return parsed.error

  const { agentId, userMessage, conversationId } = parsed.data

  let conversation = conversationId
    ? await storageManager.loadConversation(conversationId)
    : storageManager.createConversation(`New conversation`)

  if (!conversation) {
    conversation = storageManager.createConversation(`New conversation`)
  }

  conversation = storageManager.addMessageToConversation(conversation, {
    agentId: 'user',
    agentName: 'You',
    content: userMessage
  })

  let agentConfig: PersistedAgentConfig | null = await storageManager.loadAgent(agentId)

  if (!agentConfig) {
    const defaultAgent = defaultAgents.find(a => a.id === agentId)
    if (!defaultAgent) {
      return errorResponse('Agent not found', 404)
    }

    agentConfig = PersistedAgentConfigSchema.parse({
      ...defaultAgent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    await storageManager.saveAgent(agentConfig)
  }

  const useMock = process.env.USE_MOCK_LLM === 'true'

  let agentMessage: string

  if (useMock) {
    await new Promise(resolve => setTimeout(resolve, 800))
    agentMessage = generateMockResponse(agentId, userMessage)
  } else {
    const llmProvider = getLLMProvider()
    if (llmProvider) {
      agentMessage = await llmProvider.chat([
        { role: 'system', content: agentConfig.systemPrompt },
        { role: 'user', content: userMessage }
      ])
    } else {
      await new Promise(resolve => setTimeout(resolve, 800))
      agentMessage = generateMockResponse(agentId, userMessage)
    }
  }

  conversation = storageManager.addMessageToConversation(conversation, {
    agentId: agentConfig.id,
    agentName: agentConfig.name,
    content: agentMessage
  })

  await storageManager.saveConversation(conversation)

  if (agentId === 'dev-agent' && agentMessage.includes('```')) {
    const files = parseCodeBlocks(agentMessage)
    const savedFiles: string[] = []

    for (const file of files) {
      if (!InputValidator.validatePath(file.path)) continue

      const result = await sandboxedWriter.writeFile(file.path, file.content)
      if (result.success) {
        savedFiles.push(result.path || file.path)
        if (result.warnings && result.warnings.length > 0) {
          console.warn('[Sandbox] Warnings for', file.path, ':', result.warnings)
        }
      } else {
        console.error('[Sandbox] Blocked write to', file.path, ':', result.error)
      }
    }

    if (savedFiles.length > 0) {
      await gitManager.commit(`feat: ${agentConfig.name} 生成代码\n\n文件：${savedFiles.join(', ')}`)
    }
  }

  return successResponse({
    message: agentMessage,
    conversationId: conversation.id,
    agentId: agentConfig.id,
    agentName: agentConfig.name,
  }, request)
}, 'Agent API'))

function generateMockResponse(agentId: string, userMessage: string): string {
  if (agentId === 'pm-agent') {
    return `## 需求分析

根据您的需求"${userMessage}"，我已完成分析：

### 功能需求
1. **核心功能**：实现基本功能模块
2. **用户界面**：设计友好的交互界面
3. **数据存储**：配置数据持久化

### 技术方案
- 前端：React + TypeScript
- 状态管理：React Hooks
- 样式：Tailwind CSS

### 任务拆分
1. 创建基础组件结构
2. 实现核心业务逻辑
3. 添加样式和交互
4. 测试和优化

✅ 分析完成，已分配给 Dev Claw 开始实现。`
  }

  if (agentId === 'dev-agent') {
    return `## 实现完成 ✅

已根据 PM Claw 的分析完成实现：

### 创建的文件

**1. src/components/LoginForm.tsx**
\`\`\`tsx
import { useState } from 'react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 登录逻辑
    // TODO: implement login logic
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full px-4 py-2 border rounded"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full px-4 py-2 border rounded"
      />
      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
        登录
      </button>
    </form>
  )
}
\`\`\`

**2. src/app/login/page.tsx**
\`\`\`tsx
import { LoginForm } from '@/components/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoginForm />
    </div>
  )
}
\`\`\`

✅ 代码已生成，提交给 Reviewer Claw 审查。`
  }

  if (agentId === 'review-agent') {
    return `## 代码审查报告 ✅

### 审查结果：**通过** ✅

### 优点
1. ✅ **代码结构清晰**：组件职责单一，易于维护
2. ✅ **类型安全**：使用了 TypeScript 类型注解
3. ✅ **用户体验**：表单交互友好
4. ✅ **可访问性**：使用了语义化 HTML

### 建议（非阻塞）
1. 💡 添加表单验证（邮箱格式、密码强度）
2. 💡 添加错误处理和提示
3. 💡 考虑添加"记住我"功能
4. 💡 添加 loading 状态

### 安全检查
- ✅ 无 XSS 风险
- ✅ 无敏感信息泄露
- ✅ 使用了受控组件

### 性能评估
- ✅ 无不必要的重渲染
- ✅ 组件轻量，加载快速

**总体评价：代码质量良好，可以投入使用！** 🎉`
  }

  return 'Agent response'
}

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')

  if (!agentId) {
    const agents = await storageManager.listAgents()
    return successResponse({ agents })
  }

  const agent = await storageManager.loadAgent(agentId)
  if (!agent) {
    return errorResponse('Agent not found', 404)
  }

  return successResponse({ agent })
}, 'Agent API')

export const PUT = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const parsed = parseRequestBody(AgentPutRequestSchema, body)
  if ('error' in parsed) return parsed.error

  const { agentId, ...updates } = parsed.data

  const agent = await storageManager.loadAgent(agentId)
  if (!agent) {
    return errorResponse('Agent not found', 404)
  }

  const updated = PersistedAgentConfigSchema.parse({
    ...agent,
    ...updates,
    updatedAt: new Date().toISOString()
  })

  await storageManager.saveAgent(updated)

  return successResponse({ agent: updated })
}, 'Agent API')

export const DELETE = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')

  if (!agentId || !InputValidator.validateAgentId(agentId)) {
    return errorResponse('Invalid agent ID', 400)
  }

  await storageManager.deleteAgent(agentId)

  return successResponse({})
}, 'Agent API')
