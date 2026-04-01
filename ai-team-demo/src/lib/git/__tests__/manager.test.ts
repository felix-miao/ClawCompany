import { GitManager } from '../manager'
import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

describe('GitManager', () => {
  let gitManager: GitManager
  const testDir = '/tmp/clawcompany-git-test-' + Date.now()

  beforeEach(async () => {
    // 创建测试目录
    await fs.mkdir(testDir, { recursive: true })
    gitManager = new GitManager(testDir)

    // 初始化 Git 仓库
    await execAsync('git init', { cwd: testDir })
    await execAsync('git config user.email "test@test.com"', { cwd: testDir })
    await execAsync('git config user.name "Test User"', { cwd: testDir })
    
    // 创建初始提交
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test')
    await execAsync('git add -A && git commit -m "Initial commit"', { cwd: testDir })
  })

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略清理错误
    }
  })

  describe('status', () => {
    it('should detect Git repository', async () => {
      const status = await gitManager.status()

      expect(status.isRepo).toBe(true)
      expect(['master', 'main']).toContain(status.branch)
    })

    it('should detect changes', async () => {
      // 创建文件
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content')

      const status = await gitManager.status()

      expect(status.hasChanges).toBe(true)
      expect(status.files).toContain('test.txt')
    })

    it('should detect no changes', async () => {
      const status = await gitManager.status()

      expect(status.hasChanges).toBe(false)
      expect(status.files).toHaveLength(0)
    })
  })

  describe('commit', () => {
    it('should commit changes', async () => {
      // 创建文件
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content')

      const result = await gitManager.commit('Test commit')

      expect(result.success).toBe(true)
      expect(result.commitHash).toBeDefined()
    })

    it('should not commit if no changes', async () => {
      const result = await gitManager.commit('Empty commit')

      expect(result.success).toBe(false)
      expect(result.error).toContain('No changes')
    })
  })

  describe('add', () => {
    it('should add all files', async () => {
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1')
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2')

      await gitManager.add()

      const { stdout } = await execAsync('git status --porcelain', { cwd: testDir })
      expect(stdout).toContain('file1.txt')
      expect(stdout).toContain('file2.txt')
    })
  })

  describe('log', () => {
    it('should return commit history', async () => {
      const log = await gitManager.log()

      expect(log.length).toBeGreaterThan(0)
      expect(log[0].message).toContain('Initial commit')
      expect(log[0].hash).toBeDefined()
    })

    it('should limit log entries', async () => {
      // 创建多个提交
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(testDir, `file${i}.txt`), `content${i}`)
        await execAsync(`git add -A && git commit -m "Commit ${i}"`, { cwd: testDir })
      }

      const log = await gitManager.log(3)

      expect(log).toHaveLength(3)
    })
  })

  describe('Shell Injection Protection', () => {
    it('should reject branch names with shell metacharacters', async () => {
      const maliciousBranches = [
        'main; rm -rf /',
        'main && cat /etc/passwd',
        'main$(whoami)',
        'main`whoami`',
        'main | cat /etc/passwd',
        'main\nevil',
      ]

      for (const branch of maliciousBranches) {
        await expect(gitManager.createBranch(branch)).rejects.toThrow()
      }
    })

    it('should reject commit messages with shell metacharacters', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content')

      const maliciousMessages = [
        'test"; rm -rf / #',
        'test && cat /etc/passwd',
        'test$(whoami)',
        'test`whoami`',
        'test | cat /etc/passwd',
        "test'\nevil",
      ]

      for (const msg of maliciousMessages) {
        const result = await gitManager.commit(msg)
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      }
    })

    it('should reject checkout with malicious branch names', async () => {
      const maliciousBranches = [
        'main; echo pwned',
        'main && echo pwned',
        'main$(echo pwned)',
      ]

      for (const branch of maliciousBranches) {
        await expect(gitManager.checkout(branch)).rejects.toThrow()
      }
    })

    it('should reject add with malicious file paths', async () => {
      await expect(
        gitManager.add(['file.txt; rm -rf /'])
      ).rejects.toThrow()
    })

    it('should reject log with invalid limit', async () => {
      await expect(gitManager.log(-1)).rejects.toThrow()
      await expect(gitManager.log(1.5 as any)).rejects.toThrow()
    })

    it('should safely handle valid branch names', async () => {
      await expect(gitManager.createBranch('feature/my-task')).resolves.toBeUndefined()
    })

    it('should safely handle valid commit messages', async () => {
      await fs.writeFile(path.join(testDir, 'test2.txt'), 'content2')

      const result = await gitManager.commit('feat: add new feature')
      expect(result.success).toBe(true)
    })
  })
})
