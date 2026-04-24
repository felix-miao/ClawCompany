import { NextRequest } from 'next/server'

import { GLMProvider } from '@/lib/llm/glm'
import { withAuth, withRateLimit, successResponse, errorResponse } from '@/lib/api/route-utils'

export const POST = withAuth(withRateLimit(async () => {
  if (process.env.NODE_ENV === 'production') {
    return errorResponse('This endpoint is not available in production', 403)
  }

  const apiKey = process.env.GLM_API_KEY

  if (!apiKey) {
    return errorResponse('GLM_API_KEY not configured', 500)
  }

  const provider = new GLMProvider({
    provider: 'glm',
    apiKey,
    model: 'glm-4',
    temperature: 0.7,
    maxTokens: 100,
  })

  const response = await provider.chat([
    {
      role: 'system',
      content: '你是一个友好的助手。',
    },
    {
      role: 'user',
      content: '说"你好，我是 GLM-4！"',
    },
  ])

  return successResponse({
    message: 'GLM integration test passed!',
    response,
  })
  }, 'GLM Test API'))
