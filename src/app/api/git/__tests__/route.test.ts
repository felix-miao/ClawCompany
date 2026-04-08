jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

import { MockGitManager, GitCommitResult, GitStatusResult, GitLogEntry } from '@/types/__mocks__/git-mock-types'

jest.mock('@/lib/git/manager', () => {
  const mockManager: MockGitManager = {
    commit: jest.fn(),
    commitAndPush: jest.fn(),
    status: jest.fn(),
    log: jest.fn(),
    createBranch: jest.fn(),
    checkout: jest.fn(),
  }
  
  ;(global as typeof globalThis & { __mockGitRouteManager__: MockGitManager }).__mockGitRouteManager__ = mockManager
  
  return {
    GitManager: jest.fn().mockImplementation(() => mockManager),
  }
})

jest.mock('@/lib/security/utils', () => ({
  InputValidator: {
    sanitize: (str: string) => str.replace(/[`$]/g, ''),
    validateAgentId: (id: string) => /^[a-z0-9-]+$/.test(id),
  },
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60),
  },
}))

import { POST, GET, PUT } from '../route'

import { RateLimiter } from '@/lib/security/utils'

const API_KEY = 'test-api-key-12345678901234567890'

interface MockRequestOptions {
  url?: string
  noAuth?: boolean
  headers?: Record<string, string>
  body?: Record<string, unknown> | string
}

function createMockRequest(options?: MockRequestOptions) {
  const url = options?.url || 'http://localhost/api/git'
  const headers: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
    'content-type': 'application/json',
    ...(options?.noAuth ? {} : { 'x-api-key': API_KEY }),
    ...(options?.headers || {}),
  }
  return {
    url,
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
    json: () => Promise.resolve(options?.body || {}),
    clone: () => createMockRequest({ ...options, url }),
    text: async () => options?.body ? JSON.stringify(options.body) : '',
  }
}

describe('Authentication', () => {
  const originalApiKey = process.env.AGENT_API_KEY

  beforeAll(() => {
    process.env.AGENT_API_KEY = API_KEY
  })

  afterAll(() => {
    if (originalApiKey) {
      process.env.AGENT_API_KEY = originalApiKey
    } else {
      delete process.env.AGENT_API_KEY
    }
  })

  it('POST should return 401 without API key', async () => {
    const request = createMockRequest({ noAuth: true, body: { message: 'test' } })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('GET should return 401 without API key', async () => {
    const request = createMockRequest({ noAuth: true, url: 'http://localhost/api/git' })
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('PUT should return 401 without API key', async () => {
    const request = createMockRequest({ noAuth: true, body: { action: 'create', branchName: 'test' } })
    const response = await PUT(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })
})

const getMockGit = () => (global as typeof globalThis & { __mockGitRouteManager__: MockGitManager }).__mockGitRouteManager__

describe('/api/git', () => {
  const originalApiKey = process.env.AGENT_API_KEY

  beforeAll(() => {
    process.env.AGENT_API_KEY = API_KEY
  })

  afterAll(() => {
    if (originalApiKey) {
      process.env.AGENT_API_KEY = originalApiKey
    } else {
      delete process.env.AGENT_API_KEY
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
    ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(60)

    const git = getMockGit()
    git.commit.mockReset()
    git.commitAndPush.mockReset()
    git.status.mockReset()
    git.log.mockReset()
    git.createBranch.mockReset()
    git.checkout.mockReset()
  })

  describe('POST - Commit', () => {
    it('should commit with valid message', async () => {
      const git = getMockGit()
      git.commit.mockResolvedValue({
        success: true,
        commitHash: 'abc123',
        message: 'test commit',
      } as GitCommitResult)

      const request = createMockRequest({
        body: { message: 'feat: add new feature' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.commitHash).toBe('abc123')
      expect(git.commit).toHaveBeenCalledWith('feat: add new feature')
    })

    it('should commit and push when autoPush is true', async () => {
      const git = getMockGit()
      git.commitAndPush.mockResolvedValue({
        success: true,
        commitHash: 'abc123',
        message: 'test commit',
      } as GitCommitResult)

      const request = createMockRequest({
        body: { message: 'feat: add feature', autoPush: true },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(git.commitAndPush).toHaveBeenCalled()
      expect(git.commit).not.toHaveBeenCalled()
    })

    it('should reject missing commit message', async () => {
      const request = createMockRequest({ body: {} })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should reject non-string commit message', async () => {
      const request = createMockRequest({ body: { message: 123 } })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
    })

    it('should reject empty commit message', async () => {
      const request = createMockRequest({ body: { message: '' } })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
    })

    it('should sanitize commit message', async () => {
      const git = getMockGit()
      git.commit.mockResolvedValue({
        success: true,
        commitHash: 'abc123',
        message: 'clean',
      } as GitCommitResult)

      const request = createMockRequest({
        body: { message: 'feat: `test` $var' },
      })

      await POST(request)
      expect(git.commit).toHaveBeenCalledWith('feat: test var')
    })

    it('should handle commit failure', async () => {
      const git = getMockGit()
      git.commit.mockResolvedValue({
        success: false,
        error: 'Nothing to commit',
      } as GitCommitResult)

      const request = createMockRequest({
        body: { message: 'empty commit' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Nothing to commit')
    })

    it('should handle commit failure without error message', async () => {
      const git = getMockGit()
      git.commit.mockResolvedValue({
        success: false,
      } as GitCommitResult)

      const request = createMockRequest({
        body: { message: 'test' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Commit failed')
    })

    it('should enforce rate limiting', async () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(false)
      ;(RateLimiter.getRemaining as jest.Mock).mockReturnValue(0)

      const request = createMockRequest({ body: { message: 'test' } })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
    })
  })

  describe('GET - Status/Log', () => {
    it('should return git status by default', async () => {
      const git = getMockGit()
      git.status.mockResolvedValue({ branch: 'main', modified: [] } as GitStatusResult)

      const request = createMockRequest({
        url: 'http://localhost/api/git',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBeDefined()
    })

    it('should return git status with action=status', async () => {
      const git = getMockGit()
      git.status.mockResolvedValue({ branch: 'main', clean: true } as GitStatusResult)

      const request = createMockRequest({
        url: 'http://localhost/api/git?action=status',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(git.status).toHaveBeenCalled()
    })

    it('should return git log with action=log', async () => {
      const git = getMockGit()
      git.log.mockResolvedValue([
        { hash: 'abc123', message: 'first commit' },
        { hash: 'def456', message: 'second commit' },
      ] as GitLogEntry[])

      const request = createMockRequest({
        url: 'http://localhost/api/git?action=log',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.log).toHaveLength(2)
      expect(git.log).toHaveBeenCalledWith(10)
    })

    it('should respect limit parameter for log', async () => {
      const git = getMockGit()
      git.log.mockResolvedValue([])

      const request = createMockRequest({
        url: 'http://localhost/api/git?action=log&limit=5',
      })

      await GET(request)
      expect(git.log).toHaveBeenCalledWith(5)
    })

    it('should return error for invalid action', async () => {
      const request = createMockRequest({
        url: 'http://localhost/api/git?action=invalid',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid action')
    })

    it('should handle internal errors', async () => {
      const git = getMockGit()
      git.status.mockRejectedValue(new Error('git not found'))

      const request = createMockRequest({
        url: 'http://localhost/api/git',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
    })
  })

  describe('PUT - Branch Operations', () => {
    it('should create branch with valid name', async () => {
      const git = getMockGit()
      git.createBranch.mockResolvedValue(undefined)

      const request = createMockRequest({
        body: { action: 'create', branchName: 'feature-test' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.branch).toBe('feature-test')
    })

    it('should reject invalid branch name for create', async () => {
      const request = createMockRequest({
        body: { action: 'create', branchName: 'Invalid Branch!' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should reject missing branch name for create', async () => {
      const request = createMockRequest({
        body: { action: 'create' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
    })

    it('should checkout branch', async () => {
      const git = getMockGit()
      git.checkout.mockResolvedValue(undefined)

      const request = createMockRequest({
        body: { action: 'checkout', branchName: 'main' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.branch).toBe('main')
    })

    it('should reject missing branch name for checkout', async () => {
      const request = createMockRequest({
        body: { action: 'checkout' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should return error for invalid action', async () => {
      const request = createMockRequest({
        body: { action: 'invalid', branchName: 'test' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid action')
    })

    it('should handle internal errors', async () => {
      const git = getMockGit()
      git.createBranch.mockRejectedValue(new Error('branch exists'))

      const request = createMockRequest({
        body: { action: 'create', branchName: 'existing' },
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
    })
  })
})
