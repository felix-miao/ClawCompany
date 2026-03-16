import { NextRequest, NextResponse } from 'next/server'
import { GitManager } from '@/lib/git/manager'
import { InputValidator, RateLimiter } from '@/lib/security/utils'

/**
 * Git API - Git 操作接口
 * 
 * 功能：
 * - 状态检查
 * - 自动提交
 * - 推送
 * - 分支管理
 * - 提交历史
 */

const gitManager = new GitManager(process.cwd())

/**
 * POST - 提交更改
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
    const { message, autoPush = false } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Commit message is required'
      }, { status: 400 })
    }

    // 清理消息（防止注入）
    const sanitizedMessage = InputValidator.sanitize(message)

    // 提交
    const result = autoPush 
      ? await gitManager.commitAndPush(sanitizedMessage)
      : await gitManager.commit(sanitizedMessage)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      commitHash: result.commitHash,
      message: result.message
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET - 获取状态或历史
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'

    if (action === 'status') {
      const status = await gitManager.status()
      
      return NextResponse.json({
        success: true,
        status
      })
    }

    if (action === 'log') {
      const limit = parseInt(searchParams.get('limit') || '10')
      const log = await gitManager.log(limit)
      
      return NextResponse.json({
        success: true,
        log
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PUT - 分支操作
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, branchName } = body

    if (action === 'create') {
      if (!branchName || !InputValidator.validateAgentId(branchName)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid branch name'
        }, { status: 400 })
      }

      await gitManager.createBranch(branchName)

      return NextResponse.json({
        success: true,
        branch: branchName
      })
    }

    if (action === 'checkout') {
      if (!branchName) {
        return NextResponse.json({
          success: false,
          error: 'Branch name is required'
        }, { status: 400 })
      }

      await gitManager.checkout(branchName)

      return NextResponse.json({
        success: true,
        branch: branchName
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
