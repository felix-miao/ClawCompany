// Helper to create mock request
function createMockRequest(url: string, options?: any): any {
  return {
    url,
    method: options?.method || 'GET',
    headers: {
      get: (name: string) => options?.headers?.[name] || null
    },
    json: () => Promise.resolve(options?.body ? JSON.parse(options.body) : {})
  }
}

jest.mock('@/lib/filesystem/manager')
jest.mock('@/lib/security/utils')

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

      const request = new NextRequest('http://localhost/api/files', {
        method: 'POST',
        body: JSON.stringify({
          path: 'test/file.ts',
          content: 'console.log("test")'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.path).toBeDefined()
    })

    it('should reject invalid path', async () => {
      const request = new NextRequest('http://localhost/api/files', {
        method: 'POST',
        body: JSON.stringify({
          path: '../../../etc/passwd',
          content: 'malicious'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid')
    })

    it('should reject non-string content', async () => {
      const request = new NextRequest('http://localhost/api/files', {
        method: 'POST',
        body: JSON.stringify({
          path: 'test.ts',
          content: 123
        })
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

      const request = new NextRequest('http://localhost/api/files', {
        method: 'POST',
        body: JSON.stringify({
          path: 'test.ts',
          content: 'test'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should enforce rate limiting', async () => {
      ;(RateLimiter.isAllowed as jest.Mock).mockReturnValue(false)

      const request = new NextRequest('http://localhost/api/files', {
        method: 'POST',
        body: JSON.stringify({
          path: 'test.ts',
          content: 'test'
        })
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

      const request = new NextRequest('http://localhost/api/files', {
        method: 'POST',
        body: JSON.stringify({
          path: 'test/file.ts',
          content: 'updated'
        })
      })

      const response = await POST(request)
      const data = await response.json()

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

      const request = new NextRequest('http://localhost/api/files?path=test/file.ts', {
        method: 'GET'
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

      const request = new NextRequest('http://localhost/api/files?list=true', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.files).toHaveLength(2)
    })

    it('should reject missing path', async () => {
      const request = new NextRequest('http://localhost/api/files', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should reject invalid path', async () => {
      const request = new NextRequest('http://localhost/api/files?path=../../etc/passwd', {
        method: 'GET'
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

      const request = new NextRequest('http://localhost/api/files?path=not-exist.ts', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it('should list files in directory', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.listFiles as jest.Mock).mockResolvedValue({
        success: true,
        files: ['src/file1.ts', 'src/file2.ts']
      })

      const request = new NextRequest('http://localhost/api/files?list=true&path=src', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(data.files).toHaveLength(2)
    })
  })

  describe('PUT - Update File', () => {
    it('should update file successfully', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.updateFile as jest.Mock).mockResolvedValue({
        success: true,
        path: '/test/file.ts'
      })

      const request = new NextRequest('http://localhost/api/files', {
        method: 'PUT',
        body: JSON.stringify({
          path: 'test/file.ts',
          content: 'updated content'
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid path', async () => {
      const request = new NextRequest('http://localhost/api/files', {
        method: 'PUT',
        body: JSON.stringify({
          path: '../../../etc/passwd',
          content: 'hacked'
        })
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

      const request = new NextRequest('http://localhost/api/files', {
        method: 'PUT',
        body: JSON.stringify({
          path: 'not-exist.ts',
          content: 'content'
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('DELETE - Delete File', () => {
    it('should delete file successfully', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.deleteFile as jest.Mock).mockResolvedValue({
        success: true,
        path: '/test/file.ts'
      })

      const request = new NextRequest('http://localhost/api/files?path=test/file.ts', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject invalid path', async () => {
      const request = new NextRequest('http://localhost/api/files?path=../../etc/passwd', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should reject missing path', async () => {
      const request = new NextRequest('http://localhost/api/files', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid')
    })

    it('should handle non-existent file', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.deleteFile as jest.Mock).mockResolvedValue({
        success: false,
        error: 'File not found'
      })

      const request = new NextRequest('http://localhost/api/files?path=not-exist.ts', {
        method: 'DELETE'
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle JSON parse errors', async () => {
      const request = new NextRequest('http://localhost/api/files', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })

    it('should handle file system errors', async () => {
      const fsManager = new FileSystemManager()
      ;(fsManager.createFile as jest.Mock).mockRejectedValue(new Error('Disk full'))

      const request = new NextRequest('http://localhost/api/files', {
        method: 'POST',
        body: JSON.stringify({
          path: 'test.ts',
          content: 'test'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Disk full')
    })
  })
})
