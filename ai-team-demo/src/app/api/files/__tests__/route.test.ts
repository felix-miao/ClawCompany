// Mock Next.js server components
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      json: async () => data,
      status: options?.status || 200,
    }),
  },
}))

// Helper to create mock request
function createMockRequest(options?: any): any {
  return {
    url: 'http://localhost/api/files',
    method: options?.method || 'GET',
    headers: {
      get: (name: string) => options?.headers?.[name] || null
    },
    json: () => Promise.resolve(options?.body || {})
  }
}

jest.mock('@/lib/filesystem/manager')
jest.mock('@/lib/security/utils')

// Import after mocks
import { POST, GET, PUT, DELETE } from '../route'
import { FileSystemManager } from '@/lib/filesystem/manager'
import { RateLimiter } from '@/lib/security/utils'

describe('/api/files', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(true)
    
    ;(FileSystemManager as jest.Mock).mockImplementation(() => ({
      createFile: jest.fn(),
      readFile: jest.fn(),
      updateFile: jest.fn(),
      deleteFile: jest.fn(),
      listFiles: jest.fn()
    }))
  })

  describe('POST - Create File', () => {
    it('should create file successfully', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.createFile as jest.Mock).mockResolvedValue({
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
      const fsManager = new FileSystemManager()
      ;(fsManager.createFile as jest.Mock).mockResolvedValue({
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
      const fsManager = new FileSystemManager()
      ;(fsManager.createFile as jest.Mock).mockResolvedValue({
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
      const fsManager = new FileSystemManager()
      ;(fsManager.readFile as jest.Mock).mockResolvedValue({
        success: true,
        content: 'file content',
        path: '/test/file.ts'
      })

      const request = createMockRequest({
        method: 'GET',
        body: { path: 'test/file.ts' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.content).toBe('file content')
    })

    it('should list files', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.listFiles as jest.Mock).mockResolvedValue({
        success: true,
        files: ['file1.ts', 'file2.ts']
      })

      const request = createMockRequest({
        method: 'GET',
        body: { path: 'test' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.files).toBeDefined()
    })

    it('should reject missing path', async () => {
      const request = createMockRequest({
        method: 'GET',
        body: {}
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should reject invalid path', async () => {
      const request = createMockRequest({
        method: 'GET',
        body: { path: '../../../etc/passwd' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should handle non-existent file', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.readFile as jest.Mock).mockResolvedValue({
        success: false,
        error: 'File not found'
      })

      const request = createMockRequest({
        method: 'GET',
        body: { path: 'nonexistent.ts' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    it('should list files in directory', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.listFiles as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          { name: 'file1.ts', type: 'file', size: 100 },
          { name: 'file2.ts', type: 'file', size: 200 }
        ]
      })

      const request = createMockRequest({
        method: 'GET',
        body: { path: 'src' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data.files)).toBe(true)
    })
  })

  describe('PUT - Update File', () => {
    it('should update file successfully', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.updateFile as jest.Mock).mockResolvedValue({
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
      const fsManager = new FileSystemManager()
      ;(fsManager.updateFile as jest.Mock).mockResolvedValue({
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

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })
  })

  describe('DELETE - Delete File', () => {
    it('should delete file successfully', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.deleteFile as jest.Mock).mockResolvedValue({
        success: true
      })

      const request = createMockRequest({
        method: 'DELETE',
        body: { path: 'test/file.ts' }
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid path', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        body: { path: '../../../etc/passwd' }
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should reject missing path', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        body: {}
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should handle non-existent file', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.deleteFile as jest.Mock).mockResolvedValue({
        success: false,
        error: 'File not found'
      })

      const request = createMockRequest({
        method: 'DELETE',
        body: { path: 'nonexistent.ts' }
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
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

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should handle file system errors', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.createFile as jest.Mock).mockRejectedValue(new Error('Disk full'))

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
      expect(data.error).toContain('error')
    })
  })
})
