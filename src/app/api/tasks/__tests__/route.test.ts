/**
 * Tests for GET /api/tasks/:id/status and POST /api/tasks/:id/resume
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      _data: data,
      json: async () => data,
      status: options?.status ?? 200,
    }),
  },
}))

jest.mock('@/lib/security/utils', () => ({
  InputValidator: { validatePath: () => true },
  RateLimiter: {
    isAllowed: () => true,
    getRemaining: () => 100,
  },
}))

// Mock CheckpointService
const mockGetStatus = jest.fn()
const mockGetCheckpoints = jest.fn()
const mockGetResumePoint = jest.fn()
const mockGetResumable = jest.fn()

jest.mock('@/lib/tasks/checkpoint-service', () => ({
  CheckpointService: {
    getInstance: () => ({
      getStatus: mockGetStatus,
      getCheckpoints: mockGetCheckpoints,
      getResumePoint: mockGetResumePoint,
      getResumable: mockGetResumable,
    }),
  },
}))

// Mock route-utils to avoid real crypto/auth
jest.mock('@/lib/api/route-utils', () => ({
  requireApiKey: () => null,   // no auth error
  checkRateLimit: () => null,  // no rate limit
  successResponse: (data: Record<string, unknown>) => ({
    _data: { success: true, ...data },
    json: async () => ({ success: true, ...data }),
    status: 200,
  }),
  errorResponse: (msg: unknown, status?: number) => ({
    _data: { success: false, error: String(msg) },
    json: async () => ({ success: false, error: String(msg) }),
    status: status ?? 500,
  }),
}))

// Mock orchestrator
jest.mock('@/lib/core/services', () => ({
  getDefaultContainer: () => ({
    resolve: () => ({
      executeUserRequest: jest.fn().mockResolvedValue({
        success: true,
        messages: [],
        tasks: [{ id: 'new-task-1' }],
        stats: {},
        failedTasks: undefined,
      }),
    }),
  }),
  Services: { Orchestrator: Symbol('Orchestrator') },
}))

import { GET } from '@/app/api/tasks/[id]/status/route'
import { POST } from '@/app/api/tasks/[id]/resume/route'

function makeRequest() {
  return {
    json: async () => ({}),
    headers: { get: (name: string) => (name === 'x-api-key' ? 'test-key' : null) },
  } as unknown as import('next/server').NextRequest
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/tasks/:id/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetStatus.mockReturnValue({
      found: true, status: 'pm_complete', stage: 'pm',
      outputs: { userMessage: 'test', subTasks: [{}] },
      updatedAt: 1000,
    })
    mockGetCheckpoints.mockReturnValue([])
    mockGetResumePoint.mockReturnValue({ point: 'after_pm', checkpoint: {}, outputs: { subTasks: [{}] } })
  })

  it('should return task status when found', async () => {
    const res = await GET(makeRequest(), makeParams('task-abc'))
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.found).toBe(true)
    expect(data.status).toBe('pm_complete')
    expect(data.resumable).toBe(true)
    expect(data.resumePoint).toBe('after_pm')
  })

  it('should return not found when checkpoint missing', async () => {
    mockGetStatus.mockReturnValue({ found: false, status: null, stage: null, outputs: {}, updatedAt: null })
    mockGetResumePoint.mockReturnValue({ point: 'fresh', checkpoint: null, outputs: {} })

    const res = await GET(makeRequest(), makeParams('task-xyz'))
    const data = await res.json()
    expect(data.found).toBe(false)
    expect(data.resumable).toBe(false)
    expect(data.resumePoint).toBe('fresh')
  })
})

describe('POST /api/tasks/:id/resume', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return resumed: false when already completed', async () => {
    mockGetResumePoint.mockReturnValue({ point: 'completed', checkpoint: {}, outputs: {} })
    const res = await POST(makeRequest(), makeParams('task-done'))
    const data = await res.json()
    expect(data.resumed).toBe(false)
    expect(data.resumePoint).toBe('completed')
  })

  it('should return resumed: false when no checkpoint (fresh)', async () => {
    mockGetResumePoint.mockReturnValue({ point: 'fresh', checkpoint: null, outputs: {} })
    const res = await POST(makeRequest(), makeParams('task-new'))
    const data = await res.json()
    expect(data.resumed).toBe(false)
    expect(data.resumePoint).toBe('fresh')
  })

  it('should return error info when failed', async () => {
    mockGetResumePoint.mockReturnValue({
      point: 'failed', checkpoint: {},
      outputs: { error: 'LLM timeout' },
    })
    const res = await POST(makeRequest(), makeParams('task-fail'))
    const data = await res.json()
    expect(data.resumed).toBe(false)
    expect(data.resumePoint).toBe('failed')
    expect(data.reason).toContain('LLM timeout')
  })

  it('should resume and return new workflow result when after_pm', async () => {
    mockGetResumePoint.mockReturnValue({
      point: 'after_pm',
      checkpoint: {},
      outputs: { userMessage: 'build app', subTasks: [{ title: 'sub1' }] },
    })

    const res = await POST(makeRequest(), makeParams('task-resume'))
    const data = await res.json()
    expect(data.resumed).toBe(true)
    expect(data.resumePoint).toBe('after_pm')
    expect(data.workflowResult).toBeDefined()
    expect(data.workflowResult.success).toBe(true)
  })

  it('should return 422 when after_pm but subTasks empty', async () => {
    mockGetResumePoint.mockReturnValue({
      point: 'after_pm',
      checkpoint: {},
      outputs: { userMessage: 'build', subTasks: [] },
    })

    const res = await POST(makeRequest(), makeParams('task-empty'))
    const data = await res.json()
    expect(data.success).toBe(false)
    expect(res.status).toBe(422)
  })
})
