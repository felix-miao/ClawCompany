/**
 * Built-in Tools 单元测试
 */
import { ExecTool, FileTool, FetchTool, GitTool } from '../builtin-tools'
import * as fs from 'fs/promises'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

describe('ExecTool', () => {
  let tool: ExecTool

  beforeEach(() => {
    tool = new ExecTool()
  })

  it('should have correct name and description', () => {
    expect(tool.name).toBe('exec')
    expect(tool.description).toBeTruthy()
  })

  it('should have correct parameters schema', () => {
    expect(tool.parameters.type).toBe('object')
    expect(tool.parameters.required).toContain('command')
    expect(tool.parameters.properties.command.type).toBe('string')
  })

  it('should reject non-whitelisted commands', async () => {
    const result = await tool.execute({
      command: 'rm',
      args: ['-rf', '/'],
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('not in the allowlist')
  })

  it('should format result correctly', () => {
    const successResult = {
      success: true,
      data: { stdout: 'output', stderr: '', exitCode: 0 },
    }
    const formatted = tool.formatResult(successResult as any)
    expect(formatted).toContain('exit_code: 0')
    expect(formatted).toContain('output')
  })

  it('should format error result correctly', () => {
    const errorResult = {
      success: false,
      error: 'Command failed',
    }
    const formatted = tool.formatResult(errorResult as any)
    expect(formatted).toContain('error')
  })
})

describe('FileTool', () => {
  let tool: FileTool
  const testDir = '/tmp/clawcompany-test-tools'
  const testFile = path.join(testDir, 'test.txt')

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {}
  })

  beforeEach(() => {
    tool = new FileTool()
  })

  describe('read action', () => {
    it('should read file content', async () => {
      await fs.writeFile(testFile, 'test content')
      const result = await tool.execute({
        action: 'read',
        path: testFile,
      })
      expect(result.success).toBe(true)
      expect(result.data?.content).toBe('test content')
    })

    it('should handle read errors', async () => {
      const result = await tool.execute({
        action: 'read',
        path: '/nonexistent/file.txt',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('write action', () => {
    it('should write content to file', async () => {
      const result = await tool.execute({
        action: 'write',
        path: testFile,
        content: 'new content',
      })
      expect(result.success).toBe(true)
      const content = await fs.readFile(testFile, 'utf-8')
      expect(content).toBe('new content')
    })
  })

  describe('append action', () => {
    it('should append content to file', async () => {
      await fs.writeFile(testFile, 'original')
      const result = await tool.execute({
        action: 'append',
        path: testFile,
        content: ' appended',
      })
      expect(result.success).toBe(true)
      const content = await fs.readFile(testFile, 'utf-8')
      expect(content).toBe('original appended')
    })
  })

  describe('delete action', () => {
    it('should delete file', async () => {
      await fs.writeFile(testFile, 'to delete')
      const result = await tool.execute({
        action: 'delete',
        path: testFile,
      })
      expect(result.success).toBe(true)
      await expect(fs.access(testFile)).rejects.toThrow()
    })
  })

  describe('list action', () => {
    it('should list directory contents', async () => {
      const result = await tool.execute({
        action: 'list',
        path: testDir,
      })
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data?.entries)).toBe(true)
    })
  })
})

describe('GitTool', () => {
  let tool: GitTool
  const testRepoDir = '/tmp/clawcompany-test-git'

  beforeAll(async () => {
    await fs.mkdir(testRepoDir, { recursive: true })
    await execFileAsync('git', ['init'], { cwd: testRepoDir })
  })

  afterAll(async () => {
    try {
      await fs.rm(testRepoDir, { recursive: true, force: true })
    } catch {}
  })

  beforeEach(() => {
    tool = new GitTool()
  })

  it('should have correct name', () => {
    expect(tool.name).toBe('git')
  })

  describe('status action', () => {
    it('should return git status', async () => {
      const result = await tool.execute({
        action: 'status',
        repoPath: testRepoDir,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('log action', () => {
    it('should have correct parameters schema', () => {
      expect(tool.parameters.properties.action.enum).toContain('log')
    })
  })

  describe('branch action', () => {
    it('should return git branches', async () => {
      const result = await tool.execute({
        action: 'branch',
        repoPath: testRepoDir,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('commit action', () => {
    it('should require message for commit', async () => {
      const result = await tool.execute({
        action: 'commit',
        repoPath: testRepoDir,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('message')
    })
  })

  describe('checkout action', () => {
    it('should require ref for checkout', async () => {
      const result = await tool.execute({
        action: 'checkout',
        repoPath: testRepoDir,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('ref')
    })
  })
})

describe('FetchTool', () => {
  let tool: FetchTool

  beforeEach(() => {
    tool = new FetchTool()
  })

  it('should have correct name', () => {
    expect(tool.name).toBe('fetch')
  })

  it('should have correct parameters schema', () => {
    expect(tool.parameters.type).toBe('object')
    expect(tool.parameters.required).toContain('url')
    expect(tool.parameters.properties.url.type).toBe('string')
  })

  it('should format result correctly', () => {
    const successResult = {
      success: true,
      data: { status: 200, body: 'response body', statusText: 'OK', headers: {} },
    }
    const formatted = tool.formatResult(successResult as any)
    expect(formatted).toContain('HTTP 200')
  })

  it('should format error result correctly', () => {
    const errorResult = {
      success: false,
      error: 'Network error',
    }
    const formatted = tool.formatResult(errorResult as any)
    expect(formatted).toContain('error')
  })
})
