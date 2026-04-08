import { NextRequest } from 'next/server'

import { SandboxedFileWriter } from '@/lib/security/sandbox'
import { InputValidator } from '@/lib/security/utils'
import { withAuth, withRateLimit, successResponse, errorResponse } from '@/lib/api/route-utils'

const sandboxedWriter = new SandboxedFileWriter(process.cwd())

export const POST = withAuth(withRateLimit(async (request: NextRequest) => {
  const body = await request.json()
  const { path, content } = body

  if (!InputValidator.validatePath(path)) {
    return errorResponse('Invalid file path', 400)
  }

  if (typeof content !== 'string') {
    return errorResponse('Content must be a string', 400)
  }

  const result = await sandboxedWriter.writeFile(path, content)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to create file', 400)
  }

  const response: Record<string, unknown> = { path: result.path }
  if (result.warnings && result.warnings.length > 0) {
    response.warnings = result.warnings
  }

  return successResponse(response, request)
}, 'Files API'))

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')
  const list = searchParams.get('list')

  if (list === 'true') {
    const result = await sandboxedWriter.listFiles(filePath || undefined)
    return successResponse({ files: result.files })
  }

  if (!filePath) {
    return errorResponse('File path is required', 400)
  }

  if (!InputValidator.validatePath(filePath)) {
    return errorResponse('Invalid file path', 400)
  }

  const result = await sandboxedWriter.readAllowed(filePath)

  if (!result.success) {
    return errorResponse(result.error || 'File not found', 404)
  }

  return successResponse({
    content: result.content,
    path: filePath,
  })
}, 'Files API')

export const PUT = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const { path, content } = body

  if (!InputValidator.validatePath(path)) {
    return errorResponse('Invalid file path', 400)
  }

  if (typeof content !== 'string') {
    return errorResponse('Content must be a string', 400)
  }

  const result = await sandboxedWriter.writeFile(path, content)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to update file', 400)
  }

  return successResponse({ path: result.path })
}, 'Files API')

export const DELETE = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  if (!filePath || !InputValidator.validatePath(filePath)) {
    return errorResponse('Invalid file path', 400)
  }

  const result = await sandboxedWriter.deleteFile(filePath)

  if (!result.success) {
    return errorResponse(result.error || 'Failed to delete file', 400)
  }

  return successResponse({})
}, 'Files API')
