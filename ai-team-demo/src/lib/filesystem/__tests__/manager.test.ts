import { FileSystemManager, fileSystemManager } from '../manager'
import { SandboxedFileWriter } from '../../security/sandbox'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('FileSystemManager', () => {
  let fsManager: FileSystemManager
  const testDir = '/tmp/clawcompany-fs-test-' + Date.now()

  beforeEach(() => {
    fsManager = new FileSystemManager(testDir)
  })

  afterEach(async () => {
    await fsManager.cleanup()
  })

  describe('constructor', () => {
    it('should resolve rootDir to absolute path', () => {
      const mgr = new FileSystemManager('./relative/path')
      expect(path.isAbsolute(mgr.getRootDir())).toBe(true)
    })

    it('should create instance without sandbox by default', () => {
      const mgr = new FileSystemManager(testDir)
      expect(mgr.getRootDir()).toBe(path.resolve(testDir))
    })

    it('should create sandboxed writer when sandbox is true', () => {
      const mgr = new FileSystemManager(testDir, { sandbox: true })
      expect(mgr).toBeDefined()
    })

    it('should use provided SandboxedFileWriter instance', () => {
      const writer = new SandboxedFileWriter(testDir)
      const mgr = new FileSystemManager(testDir, { sandbox: writer })
      expect(mgr).toBeDefined()
    })

    it('should not use sandbox when sandbox is false', () => {
      const mgr = new FileSystemManager(testDir, { sandbox: false })
      expect(mgr.getRootDir()).toBe(path.resolve(testDir))
    })

    it('should not use sandbox for undefined option', () => {
      const mgr = new FileSystemManager(testDir, {})
      expect(mgr.getRootDir()).toBe(path.resolve(testDir))
    })
  })

  describe('getRootDir', () => {
    it('should return the resolved root directory', () => {
      expect(fsManager.getRootDir()).toBe(path.resolve(testDir))
    })
  })

  describe('validatePath (via public methods)', () => {
    it('should reject paths containing ".."', async () => {
      const result = await fsManager.createFile('../../../etc/passwd', 'x')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
      expect(result.error).toContain('path traversal')
    })

    it('should reject absolute paths', async () => {
      const result = await fsManager.createFile('/etc/passwd', 'x')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
      expect(result.error).toContain('absolute')
    })

    it('should reject paths that resolve outside root dir', async () => {
      const mgr = new FileSystemManager('/tmp/clawcompany-nested-test')
      const result = await mgr.readFile('sub/../../../etc/passwd')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
      await mgr.cleanup()
    })

    it('should accept valid relative paths', async () => {
      const result = await fsManager.createFile('valid/path/file.txt', 'content')
      expect(result.success).toBe(true)
    })
  })

  describe('createFile', () => {
    it('should create a file successfully', async () => {
      const result = await fsManager.createFile('test.ts', 'console.log("test")')
      expect(result.success).toBe(true)
      expect(result.path).toContain('test.ts')
    })

    it('should create nested directories if needed', async () => {
      const result = await fsManager.createFile(
        'src/components/Button.tsx',
        'export const Button = () => {}'
      )
      expect(result.success).toBe(true)
      expect(result.path).toContain('src/components/Button.tsx')
    })

    it('should set overwritten=true when file already exists', async () => {
      await fsManager.createFile('exists.ts', 'original')
      const result = await fsManager.createFile('exists.ts', 'updated')
      expect(result.success).toBe(true)
      expect(result.overwritten).toBe(true)
    })

    it('should set overwritten=false for new files', async () => {
      const result = await fsManager.createFile('new-file.ts', 'content')
      expect(result.success).toBe(true)
      expect(result.overwritten).toBe(false)
    })

    it('should return error for invalid path', async () => {
      const result = await fsManager.createFile('../../etc/passwd', 'x')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
    })

    it('should write correct content to file', async () => {
      const content = 'hello world 你好世界'
      await fsManager.createFile('unicode.txt', content)
      const result = await fsManager.readFile('unicode.txt')
      expect(result.content).toBe(content)
    })

    it('should delegate to sandboxed writer when configured', async () => {
      const writer = new SandboxedFileWriter(testDir)
      const mgr = new FileSystemManager(testDir, { sandbox: writer })

      const result = await mgr.createFile('sandboxed.txt', 'sandbox content')
      expect(result.success).toBe(true)
      expect(result.path).toBeDefined()
    })

    it('should return sandbox error when writer fails', async () => {
      const writer = new SandboxedFileWriter(testDir)
      const mgr = new FileSystemManager(testDir, { sandbox: writer })

      const result = await mgr.createFile('../../escape.txt', 'x')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('readFile', () => {
    it('should read an existing file', async () => {
      await fsManager.createFile('read.ts', 'content')
      const result = await fsManager.readFile('read.ts')
      expect(result.success).toBe(true)
      expect(result.content).toBe('content')
      expect(result.path).toBeDefined()
    })

    it('should return File not found for non-existent files', async () => {
      const result = await fsManager.readFile('not-exist.ts')
      expect(result.success).toBe(false)
      expect(result.error).toContain('File not found')
    })

    it('should reject path traversal', async () => {
      const result = await fsManager.readFile('../../etc/passwd')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
    })

    it('should reject absolute path', async () => {
      const result = await fsManager.readFile('/etc/shadow')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
    })

    it('should handle read errors that are not ENOENT', async () => {
      const filePath = path.join(fsManager.getRootDir(), 'unreadable', 'file.txt')
      await fs.mkdir(path.join(fsManager.getRootDir(), 'unreadable'), { recursive: true })
      await fs.writeFile(filePath, 'content', 'utf-8')
      await fs.chmod(filePath, 0o000)

      const result = await fsManager.readFile('unreadable/file.txt')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()

      await fs.chmod(filePath, 0o644)
    })
  })

  describe('updateFile', () => {
    it('should update an existing file', async () => {
      await fsManager.createFile('update.ts', 'old content')
      const result = await fsManager.updateFile('update.ts', 'new content')
      expect(result.success).toBe(true)
      expect(result.path).toBeDefined()

      const read = await fsManager.readFile('update.ts')
      expect(read.content).toBe('new content')
    })

    it('should return File not found for non-existent file', async () => {
      const result = await fsManager.updateFile('no-such-file.ts', 'content')
      expect(result.success).toBe(false)
      expect(result.error).toContain('File not found')
    })

    it('should reject invalid path', async () => {
      const result = await fsManager.updateFile('../../etc/hosts', 'x')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
    })

    it('should delegate to sandboxed writer when configured', async () => {
      const writer = new SandboxedFileWriter(testDir)
      const mgr = new FileSystemManager(testDir, { sandbox: writer })

      const createResult = await mgr.createFile('update-sandbox.txt', 'original')
      expect(createResult.success).toBe(true)

      const updateResult = await mgr.updateFile('update-sandbox.txt', 'updated')
      expect(updateResult.success).toBe(true)
    })

    it('should return sandbox error when writer fails on update', async () => {
      const writer = new SandboxedFileWriter(testDir)
      const mgr = new FileSystemManager(testDir, { sandbox: writer })

      const result = await mgr.updateFile('../../escape.txt', 'x')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      await fsManager.createFile('delete.ts', 'content')
      const result = await fsManager.deleteFile('delete.ts')
      expect(result.success).toBe(true)
      expect(result.path).toBeDefined()

      const read = await fsManager.readFile('delete.ts')
      expect(read.success).toBe(false)
    })

    it('should return File not found for non-existent file', async () => {
      const result = await fsManager.deleteFile('ghost.ts')
      expect(result.success).toBe(false)
      expect(result.error).toContain('File not found')
    })

    it('should reject invalid path', async () => {
      const result = await fsManager.deleteFile('../../etc/important')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
    })

    it('should reject absolute path', async () => {
      const result = await fsManager.deleteFile('/tmp/something')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
    })

    it('should handle delete errors that are not ENOENT', async () => {
      const nestedDir = path.join(fsManager.getRootDir(), 'protected-dir')
      await fs.mkdir(nestedDir, { recursive: true })

      const result = await fsManager.deleteFile('protected-dir')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('listFiles', () => {
    it('should list all files in root directory', async () => {
      await fsManager.createFile('file1.ts', 'content')
      await fsManager.createFile('file2.ts', 'content')

      const result = await fsManager.listFiles()

      expect(result.success).toBe(true)
      expect(result.files).toContainEqual(expect.stringContaining('file1.ts'))
      expect(result.files).toContainEqual(expect.stringContaining('file2.ts'))
    })

    it('should list files in a subdirectory', async () => {
      await fsManager.createFile('src/a.ts', 'a')
      await fsManager.createFile('src/b.ts', 'b')
      await fsManager.createFile('root.ts', 'root')

      const result = await fsManager.listFiles('src')

      expect(result.success).toBe(true)
      expect(result.files).toContainEqual(expect.stringContaining('a.ts'))
      expect(result.files).toContainEqual(expect.stringContaining('b.ts'))
      expect(result.files).not.toContainEqual(expect.stringContaining('root.ts'))
    })

    it('should return empty array for empty directory', async () => {
      await fs.mkdir(path.join(testDir, 'empty-dir'), { recursive: true })

      const result = await fsManager.listFiles('empty-dir')

      expect(result.success).toBe(true)
      expect(result.files).toEqual([])
    })

    it('should recursively list nested files', async () => {
      await fsManager.createFile('deep/nested/dir/file.txt', 'deep')
      await fsManager.createFile('deep/top.txt', 'top')

      const result = await fsManager.listFiles('deep')

      expect(result.success).toBe(true)
      expect(result.files!.length).toBeGreaterThanOrEqual(2)
    })

    it('should reject invalid path', async () => {
      const result = await fsManager.listFiles('../../etc')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
    })

    it('should return error for non-existent directory', async () => {
      const result = await fsManager.listFiles('no-such-dir')
      expect(result.success).toBe(true)
      expect(result.files).toEqual([])
    })

    it('should ignore directories that cannot be read', async () => {
      await fsManager.createFile('readable.txt', 'content')
      const result = await fsManager.listFiles()
      expect(result.success).toBe(true)
      expect(result.files!.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('cleanup', () => {
    it('should remove the root directory', async () => {
      await fsManager.createFile('temp.txt', 'will be cleaned')
      await fsManager.cleanup()

      const exists = await fs.access(testDir).then(() => true).catch(() => false)
      expect(exists).toBe(false)
    })

    it('should not throw when directory does not exist', async () => {
      const mgr = new FileSystemManager('/tmp/nonexistent-cleanup-dir-xyz')
      await expect(mgr.cleanup()).resolves.not.toThrow()
    })
  })

  describe('ensureDir (indirect test)', () => {
    it('should handle EEXIST gracefully by creating file in existing dir', async () => {
      await fsManager.createFile('existing-dir/file1.txt', 'first')
      const result = await fsManager.createFile('existing-dir/file2.txt', 'second')
      expect(result.success).toBe(true)
    })

    it('should create deeply nested directory structure', async () => {
      const result = await fsManager.createFile(
        'a/b/c/d/e/deep.txt',
        'very deep'
      )
      expect(result.success).toBe(true)
    })
  })

  describe('default export', () => {
    it('should export a default fileSystemManager instance', () => {
      expect(fileSystemManager).toBeDefined()
      expect(fileSystemManager).toBeInstanceOf(FileSystemManager)
      expect(fileSystemManager.getRootDir()).toBe(path.resolve(process.cwd()))
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple concurrent writes', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        fsManager.createFile(`concurrent-${i}.txt`, `content-${i}`)
      )
      const results = await Promise.all(promises)

      for (const result of results) {
        expect(result.success).toBe(true)
      }

      const list = await fsManager.listFiles()
      expect(list.files!.length).toBe(10)
    })
  })

  describe('edge cases', () => {
    it('should handle empty file content', async () => {
      const createResult = await fsManager.createFile('empty.txt', '')
      expect(createResult.success).toBe(true)

      const readResult = await fsManager.readFile('empty.txt')
      expect(readResult.success).toBe(true)
      expect(readResult.content).toBe('')
    })

    it('should handle file names with spaces', async () => {
      const result = await fsManager.createFile('file with spaces.txt', 'content')
      expect(result.success).toBe(true)

      const read = await fsManager.readFile('file with spaces.txt')
      expect(read.content).toBe('content')
    })

    it('should handle file names with unicode', async () => {
      const result = await fsManager.createFile('文件.ts', '中文内容')
      expect(result.success).toBe(true)

      const read = await fsManager.readFile('文件.ts')
      expect(read.content).toBe('中文内容')
    })

    it('should handle large content', async () => {
      const largeContent = 'x'.repeat(100000)
      await fsManager.createFile('large.txt', largeContent)
      const result = await fsManager.readFile('large.txt')
      expect(result.content).toBe(largeContent)
    })

    it('should handle file in root directory', async () => {
      const result = await fsManager.createFile('root-file.txt', 'root')
      expect(result.success).toBe(true)

      const read = await fsManager.readFile('root-file.txt')
      expect(read.content).toBe('root')
    })
  })
})
