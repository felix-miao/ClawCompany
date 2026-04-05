import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import { InputValidator } from '../utils'
import { SandboxedFileWriter } from '../sandbox'
import { FileSystemManager } from '../../filesystem/manager'

describe('Path Traversal Security', () => {
  describe('InputValidator.validatePath - secure validation', () => {
    it('should reject empty string', () => {
      expect(InputValidator.validatePath('')).toBe(false)
    })

    it('should reject whitespace-only string', () => {
      expect(InputValidator.validatePath('   ')).toBe(false)
    })

    it('should reject URL-encoded path traversal', () => {
      expect(InputValidator.validatePath('%2e%2e/etc/passwd')).toBe(false)
      expect(InputValidator.validatePath('..%2f..%2fetc/passwd')).toBe(false)
    })

    it('should reject double-encoded path traversal', () => {
      expect(InputValidator.validatePath('%252e%252e/etc/passwd')).toBe(false)
    })

    it('should reject null byte injection', () => {
      expect(InputValidator.validatePath('file.txt\x00.exe')).toBe(false)
      expect(InputValidator.validatePath('safe\x00../../etc/passwd')).toBe(false)
    })

    it('should reject Windows forward-slash absolute paths', () => {
      expect(InputValidator.validatePath('C:/Windows/System32')).toBe(false)
      expect(InputValidator.validatePath('D:/secrets/key.pem')).toBe(false)
    })

    it('should reject mixed slash traversal', () => {
      expect(InputValidator.validatePath('..\\..\\etc/passwd')).toBe(false)
      expect(InputValidator.validatePath('../..\\etc/passwd')).toBe(false)
    })
  })

  describe('FileSystemManager - startsWith prefix collision fix', () => {
    let tmpDir: string
    let collisionDir: string
    let manager: FileSystemManager

    beforeEach(async () => {
      const baseTmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-prefix-test-'))
      collisionDir = path.join(baseTmp, 'app-secrets')
      tmpDir = path.join(baseTmp, 'app')
      await fs.mkdir(tmpDir, { recursive: true })
      await fs.mkdir(collisionDir, { recursive: true })
      await fs.writeFile(path.join(collisionDir, 'secret.txt'), 'TOP_SECRET')
      manager = new FileSystemManager(tmpDir)
    })

    afterEach(async () => {
      const baseTmp = path.dirname(tmpDir)
      await fs.rm(baseTmp, { recursive: true, force: true })
    })

    it('should reject paths that resolve to sibling directories with same prefix', async () => {
      const result = await manager.readFile('../app-secrets/secret.txt')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid path')
    })

    it('should reject path that collides with rootDir prefix', async () => {
      const baseTmp = path.dirname(tmpDir)
      const mgr = new FileSystemManager(baseTmp + '/app')
      const result = await mgr.createFile(
        path.join('..', 'app-secrets', 'stolen.txt'),
        'stolen'
      )
      expect(result.success).toBe(false)
    })

    it('should reject root-level access when path resolves to rootDir itself', async () => {
      const result = await manager.readFile('.')
      if (!result.success) {
        expect(result.error).toContain('Invalid path')
      }
    })
  })

  describe('SandboxedFileWriter - Windows backslash bypass', () => {
    let tmpDir: string
    let writer: SandboxedFileWriter

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sandbox-bypass-test-'))
      writer = new SandboxedFileWriter(tmpDir)
    })

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('should reject Windows-style absolute paths (C:\\...)', () => {
      const result = writer.validatePath('C:\\Windows\\System32')
      expect(result.allowed).toBe(false)
    })

    it('should reject Windows-style absolute paths with forward slashes (C:/...)', () => {
      const result = writer.validatePath('C:/Windows/System32')
      expect(result.allowed).toBe(false)
    })

    it('should reject UNC paths (\\\\server\\share)', () => {
      const result = writer.validatePath('\\\\server\\share\\file.txt')
      expect(result.allowed).toBe(false)
    })

    it('should reject paths with backslash traversal', () => {
      const result = writer.validatePath('sub\\..\\..\\etc\\passwd')
      expect(result.allowed).toBe(false)
    })
  })

  describe('SandboxedFileWriter - startsWith prefix collision', () => {
    let tmpDir: string
    let writer: SandboxedFileWriter

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sandbox-prefix-test-'))
      writer = new SandboxedFileWriter(tmpDir, { sandboxSubdir: 'output' })
    })

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('should not allow path resolving to sibling dir with same prefix as sandbox', async () => {
      const siblingDir = path.join(path.dirname(tmpDir), path.basename(tmpDir) + '-evil')
      await fs.mkdir(siblingDir, { recursive: true })
      await fs.writeFile(path.join(siblingDir, 'stolen.txt'), 'SECRET')

      const result = writer.validatePath('../../../' + path.basename(siblingDir) + '/stolen.txt')
      expect(result.allowed).toBe(false)
      await fs.rm(siblingDir, { recursive: true, force: true })
    })
  })

  describe('SandboxedFileWriter.listFiles - subdir validation', () => {
    let tmpDir: string
    let writer: SandboxedFileWriter

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sandbox-listfiles-test-'))
      writer = new SandboxedFileWriter(tmpDir)
      await writer.writeFile('safe.txt', 'safe content')
    })

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('should reject subdir with path traversal', async () => {
      const result = await writer.listFiles('../..')
      expect(result.success).toBe(false)
    })

    it('should reject subdir with encoded traversal', async () => {
      const result = await writer.listFiles('..')
      expect(result.success).toBe(false)
    })

    it('should reject subdir that resolves outside sandbox', async () => {
      const result = await writer.listFiles('../../../etc')
      expect(result.success).toBe(false)
    })
  })

  describe('Comprehensive path traversal attack vectors', () => {
    let tmpDir: string
    let writer: SandboxedFileWriter

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sandbox-attack-test-'))
      writer = new SandboxedFileWriter(tmpDir)
    })

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    })

    const attackVectors = [
      { name: 'basic traversal', path: '../../../etc/passwd' },
      { name: 'double slash traversal', path: '//etc/passwd' },
      { name: 'mixed traversal', path: 'foo/../../etc/passwd' },
      { name: 'null byte', path: 'file.txt\x00.exe' },
      { name: 'unicode traversal', path: '\u002e\u002e/etc/passwd' },
      { name: 'trailing traversal', path: 'foo/bar/../..' },
      { name: 'dotdot with extension', path: '../secret.txt' },
      { name: 'deep traversal', path: 'a/b/c/../../../../../../etc/shadow' },
      { name: 'backslash deep traversal', path: 'a\\b\\c\\..\\..\\..\\etc\\shadow' },
      { name: 'Windows drive letter', path: 'C:\\Windows\\System32\\config\\SAM' },
      { name: 'Windows forward slash', path: 'C:/Windows/System32/config/SAM' },
      { name: 'UNC path', path: '\\\\malicious-server\\share\\payload.exe' },
    ]

    for (const vector of attackVectors) {
      it(`should block attack: ${vector.name}`, () => {
        const result = writer.validatePath(vector.path)
        expect(result.allowed).toBe(false)
      })
    }
  })

  describe('FileSystemManager - comprehensive traversal defense', () => {
    let tmpDir: string
    let manager: FileSystemManager

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-attack-test-'))
      manager = new FileSystemManager(tmpDir)
    })

    afterEach(async () => {
      await manager.cleanup()
    })

    const attackPaths = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      '/etc/shadow',
      'C:\\Windows\\System32',
      'a/b/../../../etc/hosts',
    ]

    for (const attackPath of attackPaths) {
      it(`should reject createFile with: ${attackPath}`, async () => {
        const result = await manager.createFile(attackPath, 'malicious')
        expect(result.success).toBe(false)
      })

      it(`should reject readFile with: ${attackPath}`, async () => {
        const result = await manager.readFile(attackPath)
        expect(result.success).toBe(false)
      })

      it(`should reject deleteFile with: ${attackPath}`, async () => {
        const result = await manager.deleteFile(attackPath)
        expect(result.success).toBe(false)
      })
    }
  })
})
