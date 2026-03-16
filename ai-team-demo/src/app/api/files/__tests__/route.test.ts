// Mock Next.js server components
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => {
      const response = {
        json: async () => data,
        status: options?.status || 200,
      }
      return response
    },
  },
}))

// Helper to create mock request
function createMockRequest(options?: any): any {
  const url = options?.url || 'http://localhost/api/files'
  return {
    url,
    method: options?.method || 'GET',
    headers: {
      get: (name: string) => options?.headers?.[name] || null
    },
    json: () => Promise.resolve(options?.body || {})
  }
}

// Use global to store mock functions (to work around jest hoisting)
jest.mock('@/lib/filesystem/manager', () => {
  ;(global as any).__mockFsManager__ = {
    createFile: jest.fn(),
    readFile: jest.fn(),
    updateFile: jest.fn(),
    deleteFile: jest.fn(),
    listFiles: jest.fn()
  }
  return {
    FileSystemManager: jest.fn().mockImplementation(() => (global as any).__mockFsManager__)
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

// Import after mocks
import { POST, GET, PUT, DELETE } from '../route'
import { RateLimiter } from '@/lib/security/utils'

const getMockFsManager = () => (global as any).__mockFsManager__

describe('/api/files', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
    
    // Reset mock implementations
    const mockFsManager = getMockFsManager()
    mockFsManager.createFile.mockReset()
    mockFsManager.readFile.mockReset()
    mockFsManager.updateFile.mockReset()
    mockFsManager.deleteFile.mockReset()
    mockFsManager.listFiles.mockReset()
  })

  describe('POST - Create File', () => {
    it('should create file successfully', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.createFile.mockResolvedValue({
        success: true,
        path: '/test/file.ts',
        overwritten: false
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
      mockFsManager.createFile.mockResolvedValue({
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
      mockFsManager.createFile.mockResolvedValue({
        success: true,
        path: '/test/file.ts',
        overwritten: true
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
      expect(data.overwritten).toBe(true)
    })
  })

  describe('GET - Read/List Files', () => {
    it('should read file successfully', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.readFile.mockResolvedValue({
        success: true,
        content: 'file content',
        path: '/test/file.ts'
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
      mockFsManager.readFile.mockResolvedValue({
        success: false,
        error: 'File not found'
      })

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost/api/files?path=nonexistent.ts'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    it('should list files in directory', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.listFiles.mockResolvedValue({
        success: true,
        files: [
          { name: 'file1.ts', type: 'file', size: 100 },
          { name: 'file2.ts', type: 'file', size: 200 }
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
      mockFsManager.updateFile.mockResolvedValue({
        success: true,
        path: '/test/file.ts'
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
      mockFsManager.updateFile.mockResolvedValue({
        success: false,
        error: 'File not found'
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
        error: 'File not found'
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
        headers: { get: () => null },
        json: async () => { throw new SyntaxError('Unexpected token') }
      }

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should handle file system errors', async () => {
      const mockFsManager = getMockFsManager()
      mockFsManager.createFile.mockRejectedValue(new Error('Disk full'))

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
