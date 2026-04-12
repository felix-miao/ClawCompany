import { NextRequest } from 'next/server'

import { getDefaultContainer, Services } from '@/lib/core/services'
import type { Orchestrator } from '@/lib/orchestrator'
import { withAuth, withRateLimit, successResponse } from '@/lib/api/route-utils'
import { ChatRequestSchema, parseRequestBody } from '@/lib/api/schemas'

/**
 * /api/chat - 聚合工作流 API
 *
 * 职责：触发 Orchestrator 完整多 Agent 工作流（PM → Dev → Review）
 * - POST: 发送消息，触发 Orchestrator.executeUserRequest，返回完整工作流结果
 * - GET: 聚合视图，返回 tasks、chatHistory、stats、agents 列表
 *
 * 与 /api/agent 的分工：
 * - /api/chat: 多 Agent 协作的聚合结果（tasks、chatHistory、files）
 * - /api/agent: 单 Agent 交互，返回 conversationId、agentId）
 */

export const POST = withAuth(withRateLimit(async (request: NextRequest) => {
  const body = await request.json()
  const parsed = parseRequestBody(ChatRequestSchema, body)
  if ('error' in parsed) return parsed.error

  const { message, taskId } = parsed.data

  const orchestrator = getDefaultContainer().resolve(Services.Orchestrator) as Orchestrator
  const result = await orchestrator.executeUserRequest(message, { taskId })

  return successResponse({
    apiSource: '/api/chat',
    workflowType: 'orchestrator',
    taskId,
    message: result.messages[result.messages.length - 1]?.content,
    tasks: result.tasks,
    chatHistory: result.messages,
    files: result.files,
  }, request)
}, 'Chat API'))

export const GET = withAuth(async () => {
  const orchestrator = getDefaultContainer().resolve(Services.Orchestrator) as Orchestrator
  const status = orchestrator.getStatus()

  return successResponse({
    tasks: status.tasks,
    chatHistory: status.messages,
    stats: status.stats,
    agents: [
      { id: 'pm-agent-1', name: 'PM Claw', role: 'pm', description: '负责需求分析、任务拆分和团队协调' },
      { id: 'dev-agent-1', name: 'Dev Claw', role: 'dev', description: '负责代码实现和功能开发' },
      { id: 'review-agent-1', name: 'Reviewer Claw', role: 'review', description: '负责代码审查和质量保证' },
    ],
  })
}, 'Chat Status API')
