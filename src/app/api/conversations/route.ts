import { NextRequest } from 'next/server'

import { StorageManager } from '@/lib/storage/manager'
import { InputValidator } from '@/lib/security/utils'
import { withAuth, withRateLimit, successResponse, errorResponse } from '@/lib/api/route-utils'

const storageManager = new StorageManager()

export const POST = withAuth(withRateLimit(async (request: NextRequest) => {
  const body = await request.json()
  const { title } = body

  if (!title || typeof title !== 'string') {
    return errorResponse(new Error('Conversation title is required'), 400)
  }

  const sanitizedTitle = InputValidator.sanitize(title)
  const conversation = storageManager.createConversation(sanitizedTitle)
  await storageManager.saveConversation(conversation)

  return successResponse({ conversation }, request)
}, 'Conversations API'))

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('id')

  if (conversationId) {
    const conversation = await storageManager.loadConversation(conversationId)

    if (!conversation) {
      return errorResponse(new Error('Conversation not found'), 404)
    }

    return successResponse({ conversation })
  }

  const conversations = await storageManager.listConversations()

  return successResponse({ conversations, total: conversations.length })
}, 'Conversations API')

export const PUT = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const { conversationId, title } = body

  if (!conversationId) {
    return errorResponse(new Error('Conversation ID is required'), 400)
  }

  const conversation = await storageManager.loadConversation(conversationId)

  if (!conversation) {
    return errorResponse(new Error('Conversation not found'), 404)
  }

  if (title) {
    conversation.title = InputValidator.sanitize(title)
    conversation.updatedAt = new Date().toISOString()
  }

  await storageManager.saveConversation(conversation)

  return successResponse({ conversation })
}, 'Conversations API')

export const DELETE = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('id')

  if (!conversationId) {
    return errorResponse(new Error('Conversation ID is required'), 400)
  }

  await storageManager.deleteConversation(conversationId)

  return successResponse({})
}, 'Conversations API')
