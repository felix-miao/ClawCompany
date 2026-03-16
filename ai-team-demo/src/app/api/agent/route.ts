import { NextRequest, NextResponse } from 'next/server'
import { SecurityManager, InputValidator, RateLimiter } from '@/lib/security/utils'
import { FileSystemManager } from '@/lib/filesystem/manager'
import { StorageManager } from '@/lib/storage/manager'
import { GitManager } from '@/lib/git/manager'

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

    // 6. 获取 Agent 配置
    const agentConfig = await storageManager.loadAgent(agentId)
    if (!agentConfig) {
      return NextResponse.json({
        success: false,
        error: 'Agent not found'
      }, { status: 404 })
    }

    // 7. 调用 GLM-5 API
    const apiKey = SecurityManager.getFromEnv()
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not configured'
      }, { status: 500 })
    }

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
          ...conversation.messages.map(m => ({
            role: m.agentId === 'user' ? 'user' : 'assistant',
            content: m.content
          })),
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
    const agentMessage = data.choices[0]?.message?.content || 'No response'

    // 8. 添加 Agent 消息
    conversation = storageManager.addMessageToConversation(conversation, {
      agentId: agentConfig.id,
      agentName: agentConfig.name,
      content: agentMessage
    })

    // 9. 保存对话
    await storageManager.saveConversation(conversation)

    // 10. 如果是 Dev Agent，尝试解析并创建文件
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
