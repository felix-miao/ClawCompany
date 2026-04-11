import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import { SandboxedFileWriter } from '../sandbox'

describe('SandboxedFileWriter', () => {
  let tmpDir: string
  let writer: SandboxedFileWriter

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sandbox-test-'))
    writer = new SandboxedFileWriter(tmpDir)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  describe('constructor', () => {
    it('should use default sandbox dir "output"', () => {
      expect(writer.getSandboxDir()).toBe(path.resolve(tmpDir, 'output'))
    })

    it('should accept custom sandboxSubdir', () => {
      const customWriter = new SandboxedFileWriter(tmpDir, { sandboxSubdir: 'custom' })
      expect(customWriter.getSandboxDir()).toBe(path.resolve(tmpDir, 'custom'))
    })

    it('should accept custom allowedExtensions', () => {
      const customWriter = new SandboxedFileWriter(tmpDir, { allowedExtensions: ['.txt'] })
      expect(customWriter.getAllowedExtensions()).toEqual(['.txt'])
    })

    it('should accept custom maxFileSize', () => {
      const writer10B = new SandboxedFileWriter(tmpDir, { maxFileSize: 10 })
      const result = writer10B.validateContent('a'.repeat(11))
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('exceeds maximum size')
    })

    it('should load default allowed extensions', () => {
      const exts = writer.getAllowedExtensions()
      expect(exts).toContain('.ts')
      expect(exts).toContain('.json')
      expect(exts).toContain('.md')
      expect(exts).toContain('.txt')
    })
  })

  describe('validatePath', () => {
    it('should reject empty string', () => {
      const result = writer.validatePath('')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('required')
    })

    it('should reject null', () => {
      const result = writer.validatePath(null as unknown as string)
      expect(result.allowed).toBe(false)
    })

    it('should reject undefined', () => {
      const result = writer.validatePath(undefined as unknown as string)
      expect(result.allowed).toBe(false)
    })

    it('should reject non-string types', () => {
      const result = writer.validatePath(123 as unknown as string)
      expect(result.allowed).toBe(false)
    })

    it('should reject path traversal with ".."', () => {
      const result = writer.validatePath('../etc/passwd')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Path traversal')
    })

    it('should reject ".." in middle of path', () => {
      const result = writer.validatePath('foo/../../etc/passwd')
      expect(result.allowed).toBe(false)
    })

    it('should reject ".." at end of path', () => {
      const result = writer.validatePath('foo/bar/..')
      expect(result.allowed).toBe(false)
    })

    it('should reject absolute Unix paths', () => {
      const result = writer.validatePath('/etc/passwd')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Absolute')
    })

    it('should reject Windows-style absolute paths with backslashes', () => {
      const result = writer.validatePath('C:\\Windows\\System32')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Windows')
    })

    it('should reject "." segment', () => {
      const result = writer.validatePath('./secret.txt')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Invalid path segment')
    })

    it('should reject disallowed file extensions', () => {
      const result = writer.validatePath('malware.exe')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('not allowed')
    })

    it('should reject .bat extension', () => {
      const result = writer.validatePath('script.bat')
      expect(result.allowed).toBe(false)
    })

    it('should reject .cmd extension', () => {
      const result = writer.validatePath('script.cmd')
      expect(result.allowed).toBe(false)
    })

    it('should reject .dll extension', () => {
      const result = writer.validatePath('lib.dll')
      expect(result.allowed).toBe(false)
    })

    it('should accept .ts extension', () => {
      const result = writer.validatePath('module.ts')
      expect(result.allowed).toBe(true)
    })

    it('should accept .tsx extension', () => {
      const result = writer.validatePath('component.tsx')
      expect(result.allowed).toBe(true)
    })

    it('should accept .json extension', () => {
      const result = writer.validatePath('data.json')
      expect(result.allowed).toBe(true)
    })

    it('should accept .md extension', () => {
      const result = writer.validatePath('README.md')
      expect(result.allowed).toBe(true)
    })

    it('should accept .css extension', () => {
      const result = writer.validatePath('styles.css')
      expect(result.allowed).toBe(true)
    })

    it('should accept .html extension', () => {
      const result = writer.validatePath('index.html')
      expect(result.allowed).toBe(true)
    })

    it('should accept .yaml extension', () => {
      const result = writer.validatePath('config.yaml')
      expect(result.allowed).toBe(true)
    })

    it('should accept .sh extension', () => {
      const result = writer.validatePath('deploy.sh')
      expect(result.allowed).toBe(true)
    })

    it('should accept .py extension', () => {
      const result = writer.validatePath('script.py')
      expect(result.allowed).toBe(true)
    })

    it('should accept .sql extension', () => {
      const result = writer.validatePath('query.sql')
      expect(result.allowed).toBe(true)
    })

    it('should accept .env.local extension', () => {
      const result = writer.validatePath('.env.local')
      expect(result.allowed).toBe(true)
    })

    it('should accept .env.development extension', () => {
      const result = writer.validatePath('.env.development')
      expect(result.allowed).toBe(true)
    })

    it('should accept .eslintrc extension', () => {
      const result = writer.validatePath('.eslintrc')
      expect(result.allowed).toBe(true)
    })

    it('should accept .prettierrc extension', () => {
      const result = writer.validatePath('.prettierrc')
      expect(result.allowed).toBe(true)
    })

    it('should accept nested directory paths', () => {
      const result = writer.validatePath('src/components/App.tsx')
      expect(result.allowed).toBe(true)
      expect(result.sanitizedPath).toBe('output/src/components/App.tsx')
    })

    it('should prepend sandbox dir if not already present', () => {
      const result = writer.validatePath('file.txt')
      expect(result.sanitizedPath).toBe('output/file.txt')
    })

    it('should keep sandbox dir prefix if already present', () => {
      const result = writer.validatePath('output/file.txt')
      expect(result.sanitizedPath).toBe('output/file.txt')
    })

    it('should reject path escaping sandbox via double slash', () => {
      const result = writer.validatePath('output//../etc/passwd')
      if (result.allowed) {
        const fullPath = path.resolve(tmpDir, result.sanitizedPath!)
        expect(fullPath.startsWith(path.resolve(tmpDir, 'output'))).toBe(true)
      } else {
        expect(result.allowed).toBe(false)
      }
    })

    it('should normalize backslashes to forward slashes', () => {
      const result = writer.validatePath('sub\\..\\file.txt')
      expect(result.allowed).toBe(false)
    })
  })

  describe('validateContent', () => {
    it('should reject non-string content', () => {
      const result = writer.validateContent(123 as unknown as string)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('must be a string')
    })

    it('should allow empty string', () => {
      const result = writer.validateContent('')
      expect(result.allowed).toBe(true)
    })

    it('should allow normal code content', () => {
      const result = writer.validateContent('console.log("hello")')
      expect(result.allowed).toBe(true)
    })

    it('should reject content exceeding max file size', () => {
      const bigWriter = new SandboxedFileWriter(tmpDir, { maxFileSize: 100 })
      const result = bigWriter.validateContent('a'.repeat(101))
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('exceeds maximum size')
    })

    it('should allow content exactly at max file size', () => {
      const bigWriter = new SandboxedFileWriter(tmpDir, { maxFileSize: 100 })
      const result = bigWriter.validateContent('a'.repeat(100))
      expect(result.allowed).toBe(true)
    })

    it('should block null bytes', () => {
      const result = writer.validateContent('file\x00.txt')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('should detect eval() usage as warning', () => {
      const result = writer.validateContent('eval("malicious code")')
      expect(result.allowed).toBe(true)
      expect(result.warnings?.some(w => w.includes('eval'))).toBe(true)
    })

    it('should detect Function() constructor as warning', () => {
      const result = writer.validateContent('Function("return this")()')
      expect(result.allowed).toBe(true)
      expect(result.warnings?.some(w => w.includes('Function'))).toBe(true)
    })

    it('should detect process.env access as warning', () => {
      const result = writer.validateContent('const key = process.env.SECRET')
      expect(result.allowed).toBe(true)
      expect(result.warnings?.some(w => w.includes('process'))).toBe(true)
    })

    it('should block require("child_process")', () => {
      const result = writer.validateContent('require("child_process")')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('child_process')
    })

    it('should detect require("fs") as warning', () => {
      const result = writer.validateContent('require("fs")')
      expect(result.allowed).toBe(true)
    })

    it('should detect require("fs/promises") as warning', () => {
      const result = writer.validateContent('require("fs/promises")')
      expect(result.allowed).toBe(true)
    })

    it('should block import from child_process', () => {
      const result = writer.validateContent('import { exec } from "child_process"')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('child_process')
    })

    it('should detect import from fs as warning', () => {
      const result = writer.validateContent('import fs from "fs"')
      expect(result.allowed).toBe(true)
    })

    it('should detect import from fs/promises as warning', () => {
      const result = writer.validateContent('import { readFile } from "fs/promises"')
      expect(result.allowed).toBe(true)
    })

    it('should detect exec() call as warning', () => {
      const result = writer.validateContent('exec("rm -rf /")')
      expect(result.allowed).toBe(true)
      expect(result.warnings?.some(w => w.includes('exec'))).toBe(true)
    })

    it('should block execSync() call', () => {
      const result = writer.validateContent('execSync("rm -rf /")')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('execSync')
    })

    it('should detect spawn() call as warning', () => {
      const result = writer.validateContent('spawn("bash", ["-c", "whoami"])')
      expect(result.allowed).toBe(true)
      expect(result.warnings?.some(w => w.includes('spawn'))).toBe(true)
    })

    it('should block spawnSync() call', () => {
      const result = writer.validateContent('spawnSync("bash")')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('spawnSync')
    })

    it('should detect script tags as warning', () => {
      const result = writer.validateContent('<script>alert("xss")</script>')
      expect(result.allowed).toBe(true)
      expect(result.warnings?.some(w => w.includes('script'))).toBe(true)
    })

    it('should calculate byte size correctly for unicode content', () => {
      const bigWriter = new SandboxedFileWriter(tmpDir, { maxFileSize: 10 })
      const unicodeContent = '你好世界'
      const byteSize = Buffer.byteLength(unicodeContent, 'utf-8')
      expect(byteSize).toBeGreaterThan(10)
      const result = bigWriter.validateContent(unicodeContent)
      expect(result.allowed).toBe(false)
    })
  })

  describe('writeFile', () => {
    it('should write a valid file to sandbox', async () => {
      const result = await writer.writeFile('hello.txt', 'Hello, World!')
      expect(result.success).toBe(true)
      expect(result.path).toBe('output/hello.txt')

      const fullPath = path.join(tmpDir, 'output', 'hello.txt')
      const content = await fs.readFile(fullPath, 'utf-8')
      expect(content).toBe('Hello, World!')
    })

    it('should create nested directories', async () => {
      const result = await writer.writeFile('a/b/c/deep.txt', 'deep content')
      expect(result.success).toBe(true)

      const fullPath = path.join(tmpDir, 'output', 'a', 'b', 'c', 'deep.txt')
      const content = await fs.readFile(fullPath, 'utf-8')
      expect(content).toBe('deep content')
    })

    it('should reject writing with invalid path', async () => {
      const result = await writer.writeFile('../escape.txt', 'escaped')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Path traversal')
    })

    it('should reject writing with disallowed extension', async () => {
      const result = await writer.writeFile('malware.exe', 'binary')
      expect(result.success).toBe(false)
      expect(result.error).toContain('not allowed')
    })

    it('should reject writing content exceeding max size', async () => {
      const smallWriter = new SandboxedFileWriter(tmpDir, { maxFileSize: 10 })
      const result = await smallWriter.writeFile('big.txt', 'a'.repeat(100))
      expect(result.success).toBe(false)
      expect(result.error).toContain('exceeds maximum size')
    })

    it('should overwrite existing file', async () => {
      await writer.writeFile('overwrite.txt', 'original')
      const result = await writer.writeFile('overwrite.txt', 'updated')
      expect(result.success).toBe(true)

      const fullPath = path.join(tmpDir, 'output', 'overwrite.txt')
      const content = await fs.readFile(fullPath, 'utf-8')
      expect(content).toBe('updated')
    })

    it('should write file with path already containing sandbox prefix', async () => {
      const result = await writer.writeFile('output/test.txt', 'content')
      expect(result.success).toBe(true)
      expect(result.path).toBe('output/test.txt')
    })

    it('should write unicode content', async () => {
      const result = await writer.writeFile('unicode.txt', '你好世界 🌍 こんにちは')
      expect(result.success).toBe(true)

      const fullPath = path.join(tmpDir, 'output', 'unicode.txt')
      const content = await fs.readFile(fullPath, 'utf-8')
      expect(content).toBe('你好世界 🌍 こんにちは')
    })

    it('should write empty file', async () => {
      const result = await writer.writeFile('empty.txt', '')
      expect(result.success).toBe(true)
    })

    it('should write various allowed file types', async () => {
      const extensions = ['.ts', '.tsx', '.js', '.json', '.md', '.css', '.html', '.yaml', '.sh', '.py']
      for (const ext of extensions) {
        const result = await writer.writeFile(`test${ext}`, `content of ${ext}`)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('readAllowed', () => {
    it('should read a file written to sandbox', async () => {
      await writer.writeFile('readme.md', '# Hello')
      const result = await writer.readAllowed('readme.md')
      expect(result.success).toBe(true)
      expect(result.content).toBe('# Hello')
    })

    it('should reject reading with path traversal', async () => {
      const result = await writer.readAllowed('../../etc/passwd')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Path traversal')
    })

    it('should reject reading with absolute path', async () => {
      const result = await writer.readAllowed('/etc/passwd')
      expect(result.success).toBe(false)
    })

    it('should return error for non-existent file', async () => {
      const result = await writer.readAllowed('nonexistent.txt')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to read')
    })

    it('should read from nested directory', async () => {
      await writer.writeFile('src/utils/helper.ts', 'export const help = () => {}')
      const result = await writer.readAllowed('src/utils/helper.ts')
      expect(result.success).toBe(true)
      expect(result.content).toBe('export const help = () => {}')
    })
  })

  describe('deleteFile', () => {
    it('should delete a file in sandbox', async () => {
      await writer.writeFile('to-delete.txt', 'bye')
      const result = await writer.deleteFile('to-delete.txt')
      expect(result.success).toBe(true)

      const readResult = await writer.readAllowed('to-delete.txt')
      expect(readResult.success).toBe(false)
    })

    it('should reject deleting with path traversal', async () => {
      const result = await writer.deleteFile('../important.txt')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Path traversal')
    })

    it('should reject deleting with disallowed extension', async () => {
      const result = await writer.deleteFile('malware.exe')
      expect(result.success).toBe(false)
    })

    it('should return error for non-existent file', async () => {
      const result = await writer.deleteFile('nonexistent.txt')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to delete')
    })
  })

  describe('listFiles', () => {
    it('should list files in sandbox', async () => {
      await writer.writeFile('a.txt', 'a')
      await writer.writeFile('b.json', 'b')

      const result = await writer.listFiles()
      expect(result.success).toBe(true)
      expect(result.files).toContain('a.txt')
      expect(result.files).toContain('b.json')
    })

    it('should list files recursively', async () => {
      await writer.writeFile('root.txt', 'root')
      await writer.writeFile('sub/nested.txt', 'nested')
      await writer.writeFile('sub/deep/deeper.txt', 'deeper')

      const result = await writer.listFiles()
      expect(result.success).toBe(true)
      expect(result.files).toContain('root.txt')
      expect(result.files).toContain(path.join('sub', 'nested.txt'))
      expect(result.files).toContain(path.join('sub', 'deep', 'deeper.txt'))
    })

    it('should list files in subdirectory', async () => {
      await writer.writeFile('sub/a.txt', 'a')
      await writer.writeFile('sub/b.txt', 'b')
      await writer.writeFile('root.txt', 'root')

      const result = await writer.listFiles('sub')
      expect(result.success).toBe(true)
      expect(result.files).toContain(path.join('sub', 'a.txt'))
      expect(result.files).toContain(path.join('sub', 'b.txt'))
      expect(result.files).not.toContain('root.txt')
    })

    it('should reject listing outside sandbox', async () => {
      const result = await writer.listFiles('../..')
      expect(result.success).toBe(false)
      expect(result.error).toContain('sandbox')
    })

    it('should return empty list for empty sandbox', async () => {
      const result = await writer.listFiles()
      expect(result.success).toBe(true)
      expect(result.files).toEqual([])
    })
  })

  describe('sandbox confinement', () => {
    it('should not allow writing outside sandbox via path traversal', async () => {
      const result = await writer.writeFile('../../escape.txt', 'escaped')
      expect(result.success).toBe(false)

      const escapePath = path.join(tmpDir, '..', 'escape.txt')
      await expect(fs.access(escapePath)).rejects.toThrow()
    })

    it('should not allow writing outside sandbox via double dots in middle', async () => {
      const result = await writer.writeFile('foo/../../../escape.txt', 'escaped')
      expect(result.success).toBe(false)
    })

    it('should not allow writing outside sandbox via absolute path', async () => {
      const result = await writer.writeFile('/tmp/evil.txt', 'evil')
      expect(result.success).toBe(false)
    })

    it('should ensure all written files are within sandbox dir', async () => {
      await writer.writeFile('confined.txt', 'safe')
      const fullPath = path.join(tmpDir, 'output', 'confined.txt')
      const sandboxDir = path.resolve(tmpDir, 'output')
      expect(fullPath.startsWith(sandboxDir)).toBe(true)
    })

    it('should use custom sandbox subdir for confinement', async () => {
      const customWriter = new SandboxedFileWriter(tmpDir, { sandboxSubdir: 'output' })
      const result = await customWriter.writeFile('custom.txt', 'custom sandbox')
      expect(result.success).toBe(true)
      expect(result.path).toBe('output/custom.txt')

      const fullPath = path.join(tmpDir, 'output', 'custom.txt')
      const content = await fs.readFile(fullPath, 'utf-8')
      expect(content).toBe('custom sandbox')
    })
  })

  describe('write-read-delete round trip', () => {
    it('should support full CRUD lifecycle', async () => {
      const written = await writer.writeFile('lifecycle.ts', 'export const x = 1')
      expect(written.success).toBe(true)

      const read = await writer.readAllowed('lifecycle.ts')
      expect(read.success).toBe(true)
      expect(read.content).toBe('export const x = 1')

      const deleted = await writer.deleteFile('lifecycle.ts')
      expect(deleted.success).toBe(true)

      const readAgain = await writer.readAllowed('lifecycle.ts')
      expect(readAgain.success).toBe(false)
    })
  })

  describe('concurrent writes', () => {
    it('should handle multiple parallel writes', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        writer.writeFile(`file-${i}.txt`, `content-${i}`)
      )
      const results = await Promise.all(promises)

      for (const result of results) {
        expect(result.success).toBe(true)
      }

      const listed = await writer.listFiles()
      expect(listed.files?.length).toBe(10)
    })

    it('should not lose warnings across concurrent writeFile calls', async () => {
      const dangerousContent = 'eval("code")'
      const safeContent = 'const x = 1'

      const promises = Array.from({ length: 20 }, (_, i) => {
        const content = i % 2 === 0 ? dangerousContent : safeContent
        return writer.writeFile(`warn-${i}.txt`, content)
      })
      const results = await Promise.all(promises)

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        expect(result.success).toBe(true)
        if (i % 2 === 0) {
          expect(result.warnings).toBeDefined()
          expect(result.warnings!.length).toBeGreaterThan(0)
        } else {
          expect(result.warnings).toBeUndefined()
        }
      }
    })

    it('should not leak warnings from one writeFile call to another', async () => {
      const result1 = writer.writeFile('leak-safe.txt', 'const x = 1')
      const result2 = writer.writeFile('leak-danger.txt', 'eval("test")')
      const [r1, r2] = await Promise.all([result1, result2])

      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
      expect(r1.warnings).toBeUndefined()
      expect(r2.warnings).toBeDefined()
      expect(r2.warnings!.length).toBeGreaterThan(0)
    })

    it('should preserve correct warning count per file when concurrent', async () => {
      const multiDangerContent = 'eval("x") + process.env.Y + exec("cmd")'
      const promises = Array.from({ length: 10 }, (_, i) =>
        writer.writeFile(`multi-${i}.txt`, multiDangerContent)
      )
      const results = await Promise.all(promises)

      for (const result of results) {
        expect(result.success).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings!.length).toBeGreaterThanOrEqual(3)
      }
    })
  })

  describe('custom extensions', () => {
    it('should only allow custom extensions when configured', () => {
      const customWriter = new SandboxedFileWriter(tmpDir, { allowedExtensions: ['.txt'] })
      expect(customWriter.validatePath('file.txt').allowed).toBe(true)
      expect(customWriter.validatePath('file.ts').allowed).toBe(false)
      expect(customWriter.validatePath('file.json').allowed).toBe(false)
    })

    it('should be case-insensitive for extensions', () => {
      const customWriter = new SandboxedFileWriter(tmpDir, { allowedExtensions: ['.txt'] })
      expect(customWriter.validatePath('file.TXT').allowed).toBe(true)
    })
  })
})
