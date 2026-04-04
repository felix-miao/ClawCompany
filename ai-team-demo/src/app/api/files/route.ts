import { NextRequest } from 'next/server'

import { FileSystemManager } from '@/lib/filesystem/manager'
import { InputValidator } from '@/lib/security/utils'
import { withAuth, withRateLimit, withErrorHandling, successResponse, errorResponse } from '@/lib/api/route-utils'

const fsManager = new FileSystemManager(process.cwd())

export const POST = withAuth(withRateLimit(async (request: NextRequest) => {
  const body = await request.json()
  const { path, content } = body

  if (!InputValidator.validatePath(path)) {
    return errorResponse('Invalid file path', 400)
  }

  if (typeof content !== 'string') {
    return errorResponse('Content must be a string', 400)
  }

  const result = await fsManager.createFile(path, content)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to create file', 400)
  }

  return successResponse({
    path: result.path,
    overwritten: result.overwritten
  }, request)
}, 'Files API'))

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  const list = searchParams.get('list')

  if (list === 'true') {
    const result = await fsManager.listFiles(path || '')
    return successResponse({ files: result.files })
  }

  if (!path) {
    return errorResponse('File path is required', 400)
  }

  if (!InputValidator.validatePath(path)) {
    return errorResponse('Invalid file path', 400)
  }

  const result = await fsManager.readFile(path)

  if (!result.success) {
    return errorResponse(result.error || 'File not found', 404)
  }

  return successResponse({
    content: result.content,
    path: result.path
  })
}, 'Files API')

export const PUT = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const { path, content } = body

  if (!InputValidator.validatePath(path)) {
    return errorResponse('Invalid file path', 400)
  }

  const result = await fsManager.updateFile(path, content)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to update file', 400)
  }

  return successResponse({ path: result.path })
}, 'Files API')

export const DELETE = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')

  if (!path || !InputValidator.validatePath(path)) {
    return errorResponse('Invalid file path', 400)
  }

  const result = await fsManager.deleteFile(path)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to delete file', 400)
  }

  return successResponse({})
}, 'Files API')
