// Type definitions for mock file system manager
interface MockFsManager {
  writeFile: jest.Mock;
  readAllowed: jest.Mock;
  listFiles: jest.Mock;
  deleteFile: jest.Mock;
}

jest.mock('next/server', () => ({
  NextResponse: {
    json: <T = unknown>(data: T, options?: { status?: number }) => {
      const response = {
        json: async () => data,
        status: options?.status || 200,
      }
      return response
    },
  },
}))

jest.mock('@/lib/security/sandbox', () => {
  (global as Record<string, unknown>).__mockFsManager__ = {
    writeFile: jest.fn(),
    readAllowed: jest.fn(),
    listFiles: jest.fn(),
    deleteFile: jest.fn(),
  }
  return {
    SandboxedFileWriter: jest.fn().mockImplementation(() => (global as Record<string, unknown>).__mockFsManager__)
  }
})

jest.mock('@/lib/security/utils', () => ({
  InputValidator: {
    validatePath: (path: string) => {
      if (!path) return false
      if (path.includes('..') || path.startsWith('/') || path.match(/^[A-Z]:\\/)) {
        return false
      }
      return true
    }
  },
  RateLimiter: {
    isAllowed: jest.fn(() => true),
    getRemaining: jest.fn(() => 60)
  }
}))

import { POST, GET, PUT, DELETE } from '../route'

import { RateLimiter } from '@/lib/security/utils'

const API_KEY = 'test-api-key-12345678901234567890'
const getMockFsManager = (): MockFsManager => (global as Record<string, unknown>).__mockFsManager__ as MockFsManager

interface MockRequestOptions {
  method?: string;
  url?: string;
  body?: Record<string, unknown>;
  noAuth?: boolean;
  headers?: Record<string, string>;
}

interface MockRequest {
  url: string;
  method: string;
  headers: {
    get: (name: string) => string | null;
  };
  json: () => Promise<Record<string, unknown>>;
}

function createMockRequest(options?: MockRequestOptions): MockRequest {
  const url = options?.url || 'http://localhost/api/files'
  const headers: Record<string, string | undefined> = {
    'x-api-key': options?.noAuth ? undefined : API_KEY,
    ...(options?.headers || {})
  }
  return {
    url,
    method: options?.method || 'GET',
    headers: {
      get: (name: string) => headers[name] || null
    },
    json: () => Promise.resolve(options?.body || {})
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
    const request = createMockRequest({
      method: 'POST',
      noAuth: true,
      body: { path: 'test.ts', content: 'test' },
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('GET should return 401 without API key', async () => {
    const request = createMockRequest({
      method: 'GET',
      noAuth: true,
      url: 'http://localhost/api/files?path=test.ts',
    })
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('PUT should return 401 without API key', async () => {
    const request = createMockRequest({
      method: 'PUT',
      noAuth: true,
      body: { path: 'test.ts', content: 'updated' },
    })
    const response = await PUT(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })

  it('DELETE should return 401 without API key', async () => {
    const request = createMockRequest({
      method: 'DELETE',
      noAuth: true,
      url: 'http://localhost/api/files?path=test.ts',
    })
    const response = await DELETE(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.error).toContain('Unauthorized')
  })
})

describe('/api/files', () => {
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
    
    const mockFsManager = getMockFsManager()
    mockFsManager.writeFile.mockReset()
    mockFsManager.readAllowed.mockReset()
    mockFsManager.deleteFile.mockReset()
    mockFsManager.listFiles.mockReset()
  })

  describe('POST - Create File', () => {
    it('should create file successfully', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.writeFile.mockResolvedValue({
        success: true,
        path: 'output/test/file.ts',
      })

      const request = createMockRequest({
        method: 'POST',
        body: {
          path: 'test/file.ts',
          content: 'console.log("test")'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.path).toBeDefined()
    })

    it('should reject invalid path', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          path: '../../../etc/passwd',
          content: 'malicious'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid')
    })

    it('should reject non-string content', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          path: 'test.ts',
          content: 123
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('must be a string')
    })

    it('should handle file system errors', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.writeFile.mockResolvedValue({
        success: false,
        error: 'Permission denied'
      })

      const request = createMockRequest({
        method: 'POST',
        body: {
          path: 'test.ts',
          content: 'test'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should enforce rate limiting', async () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(false)

      const request = createMockRequest({
        method: 'POST',
        body: {
          path: 'test.ts',
          content: 'test'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('Rate limit')
    })

    it('should detect file overwrite', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.writeFile.mockResolvedValue({
        success: true,
        path: 'output/test/file.ts',
        warnings: ['File already exists, overwriting']
      })

      const request = createMockRequest({
        method: 'POST',
        body: {
          path: 'test.ts',
          content: 'new content'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.warnings).toBeDefined()
    })
  })

  describe('GET - Read/List Files', () => {
    it('should read file successfully', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.readAllowed.mockResolvedValue({
        success: true,
        content: 'file content',
      })

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/files?path=test/file.ts'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.content).toBe('file content')
    })

    it('should list files', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.listFiles.mockResolvedValue({
        success: true,
        files: ['file1.ts', 'file2.ts']
      })

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/files?list=true&path=test'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.files).toBeDefined()
    })

    it('should reject missing path', async () => {
      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/files'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should reject invalid path', async () => {
      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/files?path=../../../etc/passwd'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should handle non-existent file', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.readAllowed.mockResolvedValue({
        success: false,
        error: 'Failed to read file: ENOENT'
      })

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/files?path=nonexistent.ts'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBeDefined()
    })

    it('should list files in directory', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.listFiles.mockResolvedValue({
        success: true,
        files: [
          'file1.ts',
          'file2.ts'
        ]
      })

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/files?list=true&path=src'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data.files)).toBe(true)
    })
  })

  describe('PUT - Update File', () => {
    it('should update file successfully', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.writeFile.mockResolvedValue({
        success: true,
        path: 'output/test/file.ts'
      })

      const request = createMockRequest({
        method: 'PUT',
        body: {
          path: 'test/file.ts',
          content: 'updated content'
        }
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid path', async () => {
      const request = createMockRequest({
        method: 'PUT',
        body: {
          path: '../../../etc/passwd',
          content: 'malicious'
        }
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should handle non-existent file', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.writeFile.mockResolvedValue({
        success: false,
        error: 'Failed to write file: ENOENT'
      })

      const request = createMockRequest({
        method: 'PUT',
        body: {
          path: 'nonexistent.ts',
          content: 'content'
        }
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('DELETE - Delete File', () => {
    it('should delete file successfully', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.deleteFile.mockResolvedValue({
        success: true
      })

      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/files?path=test/file.ts'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid path', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/files?path=../../../etc/passwd'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should reject missing path', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/files'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should handle non-existent file', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.deleteFile.mockResolvedValue({
        success: false,
        error: 'Failed to delete file: ENOENT'
      })

      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/files?path=nonexistent.ts'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle JSON parse errors', async () => {
      const request = {
        url: 'http://localhost/api/files',
        method: 'POST',
        headers: { get: (name: string) => name === 'x-api-key' ? API_KEY : null },
        json: async () => { throw new SyntaxError('Unexpected token') }
      }

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should handle file system errors', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.writeFile.mockRejectedValue(new Error('Disk full'))

      const request = createMockRequest({
        method: 'POST',
        body: {
          path: 'test.ts',
          content: 'test'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Disk full')
    })
  })
})
