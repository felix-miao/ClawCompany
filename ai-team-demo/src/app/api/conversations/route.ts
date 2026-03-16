import { NextRequest, NextResponse } from 'next/server'
import { StorageManager } from '@/lib/storage/manager'
import { InputValidator, RateLimiter } from '@/lib/security/utils'

/**
 * Conversations API - 对话管理接口
 * 
 * 功能：
 * - 创建/读取/更新/删除对话
 * - 列出对话
 * - 添加消息
 * - 搜索对话
 */

const storageManager = new StorageManager()

/**
 * POST - 创建新对话
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-forwarded-for') || 'unknown'
    if (!RateLimiter.isAllowed(clientId)) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded'
      }, { status: 429 })
    }

    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Conversation title is required'
      }, { status: 400 })
    }

    // 清理标题
    const sanitizedTitle = InputValidator.sanitize(title)

    // 创建对话
    const conversation = storageManager.createConversation(sanitizedTitle)
    
    // 保存
    await storageManager.saveConversation(conversation)

    return NextResponse.json({
      success: true,
      conversation
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET - 获取对话或列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('id')

    if (conversationId) {
      // 获取单个对话
      const conversation = await storageManager.loadConversation(conversationId)

      if (!conversation) {
        return NextResponse.json({
          success: false,
          error: 'Conversation not found'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        conversation
      })
    }

    // 列出所有对话
    const conversations = await storageManager.listConversations()

    return NextResponse.json({
      success: true,
      conversations,
      total: conversations.length
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PUT - 更新对话
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, title } = body

    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: 'Conversation ID is required'
      }, { status: 400 })
    }

    const conversation = await storageManager.loadConversation(conversationId)

    if (!conversation) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found'
      }, { status: 404 })
    }

    // 更新
    if (title) {
      conversation.title = InputValidator.sanitize(title)
      conversation.updatedAt = new Date().toISOString()
    }

    await storageManager.saveConversation(conversation)

    return NextResponse.json({
      success: true,
      conversation
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * DELETE - 删除对话
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('id')

    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: 'Conversation ID is required'
      }, { status: 400 })
    }

    await storageManager.deleteConversation(conversationId)

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
