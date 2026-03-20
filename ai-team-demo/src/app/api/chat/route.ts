// API 路由 - 处理聊天请求

import { NextRequest, NextResponse } from 'next/server'
import { orchestrator } from '@/lib/orchestrator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userMessage = body.message

    if (!userMessage) {
      return NextResponse.json(
        { error: '消息不能为空' },
        { status: 400 }
      )
    }

    // 执行完整的 Agent 协作流程
    const result = await orchestrator.executeUserRequest(userMessage)

    return NextResponse.json({
      success: result.success,
      message: result.messages[result.messages.length - 1]?.content,
      tasks: result.tasks,
      chatHistory: result.messages,
      files: result.files,
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // 获取当前状态
  const status = orchestrator.getStatus()
  
  return NextResponse.json({
    tasks: status.tasks,
    chatHistory: status.messages,
    stats: status.stats,
    agents: [
      { id: 'pm-agent-1', name: 'PM Claw', role: 'pm', description: '负责需求分析、任务拆分和团队协调' },
      { id: 'dev-agent-1', name: 'Dev Claw', role: 'dev', description: '负责代码实现和功能开发' },
      { id: 'review-agent-1', name: 'Reviewer Claw', role: 'review', description: '负责代码审查和质量保证' },
    ],
  })
}
