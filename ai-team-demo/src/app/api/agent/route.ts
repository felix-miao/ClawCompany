import { NextRequest, NextResponse } from 'next/server'
import { SecurityManager, InputValidator, RateLimiter } from '@/lib/security/utils'
import { FileSystemManager } from '@/lib/filesystem/manager'
import { StorageManager } from '@/lib/storage/manager'
import { GitManager } from '@/lib/git/manager'
import { defaultAgents } from '@/lib/agents/config'

/**
 * Agent API - 完整重构版本
 * 
 * 功能：
 * 1. 调用 GLM-5 API
 * 2. 文件系统操作
 * 3. 持久化存储
 * 4. Git 自动提交
 * 5. 安全验证
 * 6. Rate Limiting
 * 
 * 安全措施：
 * - API Key 验证
 * - 输入验证和清理
 * - Rate Limiting（60次/分钟）
 * - 路径验证
 */

// 初始化管理器
const fsManager = new FileSystemManager(process.cwd())
const storageManager = new StorageManager()
const gitManager = new GitManager(process.cwd())

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const clientId = request.headers.get('x-forwarded-for') || 'unknown'
    if (!RateLimiter.isAllowed(clientId)) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        remaining: RateLimiter.getRemaining(clientId)
      }, { status: 429 })
    }

    // 2. 解析请求
    const body = await request.json()
    const { agentId, userMessage, conversationId } = body

    // 3. 输入验证
    if (!InputValidator.validateAgentId(agentId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid agent ID'
      }, { status: 400 })
    }

    const messageValidation = InputValidator.validateMessage(userMessage)
    if (!messageValidation.valid) {
      return NextResponse.json({
        success: false,
        error: messageValidation.error
      }, { status: 400 })
    }

    // 4. 获取或创建对话
    let conversation = conversationId 
      ? await storageManager.loadConversation(conversationId)
      : storageManager.createConversation(`New conversation`)

    if (!conversation) {
      conversation = storageManager.createConversation(`New conversation`)
    }

    // 5. 添加用户消息
    conversation = storageManager.addMessageToConversation(conversation, {
      agentId: 'user',
      agentName: 'You',
      content: userMessage
    })

    // 6. 获取 Agent 配置（优先从存储加载，否则使用默认配置）
    let agentConfig = await storageManager.loadAgent(agentId)
    
    if (!agentConfig) {
      // 使用默认配置
      const defaultAgent = defaultAgents.find(a => a.id === agentId)
      if (!defaultAgent) {
        return NextResponse.json({
          success: false,
          error: 'Agent not found'
        }, { status: 404 })
      }
      
      // 转换为存储格式
      agentConfig = {
        ...defaultAgent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // 保存到存储（以便下次使用）
      await storageManager.saveAgent(agentConfig)
    }

    // 7. 调用 GLM-5 API（或 Mock 模式）
    const apiKey = SecurityManager.getFromEnv()
    const useMock = process.env.USE_MOCK_LLM === 'true'

    console.log('[Agent API] useMock:', useMock)
    console.log('[Agent API] hasApiKey:', !!apiKey)

    let agentMessage: string

    if (useMock || !apiKey) {
      // Mock 模式：快速响应，用于 Demo
      console.log('[Agent API] Using Mock mode')
      await new Promise(resolve => setTimeout(resolve, 800)) // 模拟延迟
      
      agentMessage = generateMockResponse(agentId, userMessage)
    } else {
      // 真实调用 GLM-5
      console.log('[Agent API] Calling real GLM-5 API')
      const response = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'glm-5',
          messages: [
            {
              role: 'system',
              content: agentConfig.systemPrompt
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        throw new Error(`GLM API error: ${response.status}`)
      }

      const data = await response.json()
      agentMessage = data.choices[0]?.message?.content || 'No response'
    }

    // 8. 添加 Agent 消息
    conversation = storageManager.addMessageToConversation(conversation, {
      agentId: agentConfig.id,
      agentName: agentConfig.name,
      content: agentMessage
    })

    // 9. 保存对话
    await storageManager.saveConversation(conversation)

    // 10. 如果是 Dev Claw，尝试解析并创建文件
    if (agentId === 'dev-agent' && agentMessage.includes('```')) {
      const files = parseCodeBlocks(agentMessage)
      
      for (const file of files) {
        if (InputValidator.validatePath(file.path)) {
          await fsManager.createFile(file.path, file.content)
        }
      }

      // 自动 Git commit
      if (files.length > 0) {
        await gitManager.commit(`feat: ${agentConfig.name} 生成代码\n\n文件：${files.map(f => f.path).join(', ')}`)
      }
    }

    // 11. 返回响应
    return NextResponse.json({
      success: true,
      message: agentMessage,
      conversationId: conversation.id,
      agentId: agentConfig.id,
      agentName: agentConfig.name,
      remaining: RateLimiter.getRemaining(clientId)
    })

  } catch (error) {
    console.error('[Agent API] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * 从 Markdown 中解析代码块
 */
function parseCodeBlocks(markdown: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = []
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  let match

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const language = match[1] || 'text'
    const code = match[2]

    // 尝试从注释中提取文件路径
    const pathMatch = code.match(/\/\/\s*file:\s*(.+)/i)
    if (pathMatch) {
      files.push({
        path: pathMatch[1].trim(),
        content: code
      })
    }
  }

  return files
}

/**
 * Mock 响应生成器（用于 Demo）
 */
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
    console.log('Login:', { email, password })
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

/**
 * GET - 获取 Agent 信息
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')

  if (!agentId) {
    // 列出所有 Agent
    const agents = await storageManager.listAgents()
    return NextResponse.json({
      success: true,
      agents
    })
  }

  // 获取单个 Agent
  const agent = await storageManager.loadAgent(agentId)
  if (!agent) {
    return NextResponse.json({
      success: false,
      error: 'Agent not found'
    }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    agent
  })
}

/**
 * PUT - 更新 Agent 配置
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, ...updates } = body

    if (!InputValidator.validateAgentId(agentId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid agent ID'
      }, { status: 400 })
    }

    const agent = await storageManager.loadAgent(agentId)
    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent not found'
      }, { status: 404 })
    }

    // 更新配置
    const updated = {
      ...agent,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    await storageManager.saveAgent(updated)

    return NextResponse.json({
      success: true,
      agent: updated
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * DELETE - 删除 Agent
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId || !InputValidator.validateAgentId(agentId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid agent ID'
      }, { status: 400 })
    }

    await storageManager.deleteAgent(agentId)

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
