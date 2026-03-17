import { NextRequest, NextResponse } from 'next/server'

/**
 * OpenClaw Integration API
 * 
 * 通过 OpenClaw Gateway 调用真实的 AI 团队协作
 * 
 * 用法：
 * POST /api/openclaw
 * {
 *   "action": "orchestrate",
 *   "userRequest": "帮我创建一个登录页面"
 * }
 * 
 * 响应：
 * {
 *   "success": true,
 *   "messages": [
 *     { "agent": "pm", "content": "...", "timestamp": "..." },
 *     { "agent": "dev", "content": "...", "timestamp": "..." },
 *     { "agent": "review", "content": "...", "timestamp": "..." }
 *   ]
 * }
 */

const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userRequest } = body

    if (action !== 'orchestrate') {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Supported: orchestrate'
      }, { status: 400 })
    }

    if (!userRequest) {
      return NextResponse.json({
        success: false,
        error: 'userRequest is required'
      }, { status: 400 })
    }

    console.log('[OpenClaw API] Starting orchestration for:', userRequest)

    // 调用 OpenClaw Gateway
    const response = await fetch(`${OPENCLAW_GATEWAY_URL}/api/sessions/spawn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        runtime: 'subagent',
        task: `你是 PM Agent (产品经理)。

用户需求：${userRequest}

请分析需求并给出专业回复。使用 Markdown 格式。`,
        thinking: 'high',
        mode: 'run',
        runTimeoutSeconds: 60
      })
    })

    if (!response.ok) {
      throw new Error(`OpenClaw Gateway error: ${response.status}`)
    }

    const data = await response.json()
    console.log('[OpenClaw API] Session spawned:', data.sessionKey)

    // 轮询等待结果
    const result = await pollForResult(data.sessionKey)

    return NextResponse.json({
      success: true,
      messages: result.messages,
      sessionKey: data.sessionKey
    })

  } catch (error) {
    console.error('[OpenClaw API] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * 轮询等待 session 完成
 */
async function pollForResult(sessionKey: string): Promise<{ messages: any[] }> {
  const maxAttempts = 30
  const interval = 2000 // 2 秒

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${OPENCLAW_GATEWAY_URL}/api/sessions/history?sessionKey=${sessionKey}&limit=10`)
      
      if (!response.ok) {
        throw new Error(`History fetch error: ${response.status}`)
      }

      const history = await response.json()

      // 检查是否完成
      if (history && history.length > 0) {
        const lastMessage = history[0]
        
        if (lastMessage.status === 'completed') {
          return {
            messages: [{
              agent: 'pm',
              content: lastMessage.content,
              timestamp: new Date().toISOString()
            }]
          }
        }
        
        if (lastMessage.status === 'failed') {
          throw new Error(`Session failed: ${lastMessage.content}`)
        }
      }

      // 等待下一次轮询
      await new Promise(resolve => setTimeout(resolve, interval))
    } catch (error) {
      console.error('[OpenClaw API] Poll error:', error)
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }

  throw new Error('Timeout waiting for session completion')
}

/**
 * GET - 检查 OpenClaw Gateway 连接状态
 */
export async function GET() {
  try {
    const response = await fetch(`${OPENCLAW_GATEWAY_URL}/api/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 秒超时
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: `Gateway returned ${response.status}`
      })
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      connected: true,
      gateway: data
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
