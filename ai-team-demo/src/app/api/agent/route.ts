import { NextRequest, NextResponse } from 'next/server'

/**
 * Agent API - 直接调用 GLM-5 API
 * 
 * 这是一个可工作的原型
 * 真实版本会通过 OpenClaw Gateway API 调用 sessions_spawn
 */

const GLM_API_KEY = process.env.GLM_API_KEY || '55ed2b3e458a4043be3831caad6984eb.iz4NIdWwivHZNC3E'
const GLM_API_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, userMessage, systemPrompt } = body

    console.log('[Agent API] 收到请求:', { agentId, userMessage })

    // 调用 GLM-5 API
    const response = await fetch(GLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-5',
        messages: [
          {
            role: 'system',
            content: systemPrompt
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
      throw new Error(`GLM API 错误: ${response.status}`)
    }

    const data = await response.json()
    const message = data.choices[0]?.message?.content || 'No response'

    console.log('[Agent API] 成功:', message.substring(0, 100))

    return NextResponse.json({
      success: true,
      message,
      agentId
    })

  } catch (error) {
    console.error('[Agent API] 错误:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
