import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

import { GitManager, CommitResult } from '../manager'

const execAsync = promisify(exec)

describe('GitManager - 错误处理和边界情况', () => {
  let gitManager: GitManager
  const testDir = '/tmp/clawcompany-git-err-test-' + Date.now()

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
    gitManager = new GitManager(testDir)
    await execAsync('git init', { cwd: testDir })
    await execAsync('git config user.email "test@test.com"', { cwd: testDir })
    await execAsync('git config user.name "Test User"', { cwd: testDir })
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test')
    await execAsync('git add -A && git commit -m "Initial commit"', { cwd: testDir })
  })

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }) } catch {}
  })

  describe('status - 非Git目录', () => {
    it('应该在非 Git 目录返回 isRepo=false', async () => {
      const nonGitDir = '/tmp/clawcompany-non-git-' + Date.now()
      await fs.mkdir(nonGitDir, { recursive: true })
      const nonGitManager = new GitManager(nonGitDir)

      const status = await nonGitManager.status()

      expect(status.isRepo).toBe(false)
      expect(status.branch).toBe('')
      expect(status.files).toEqual([])
      expect(status.ahead).toBe(0)
      expect(status.behind).toBe(0)

      await fs.rm(nonGitDir, { recursive: true, force: true })
    })
  })

  describe('commitAndPush', () => {
    it('应该在 commit 失败时直接返回 commit 结果', async () => {
      const result = await gitManager.commitAndPush('no changes')

      expect(result.success).toBe(false)
      expect(result.error).toContain('No changes')
    })

    it('应该在 commit 成功但 push 无内容时返回 push 结果', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content')

      const result = await gitManager.commitAndPush('test commit')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Nothing to push')
    })
  })

  describe('createBranch - 验证', () => {
    it('应该拒绝空分支名', async () => {
      await expect(gitManager.createBranch('')).rejects.toThrow('Invalid branch name')
    })

    it('应该拒绝包含特殊字符的分支名', async () => {
      await expect(gitManager.createBranch('branch with spaces')).rejects.toThrow('Invalid branch name')
      await expect(gitManager.createBranch('branch@evil')).rejects.toThrow('Invalid branch name')
      await expect(gitManager.createBranch('branch#hash')).rejects.toThrow('Invalid branch name')
    })

    it('应该接受合法分支名', async () => {
      await expect(gitManager.createBranch('feature/new-login')).resolves.toBeUndefined()
      await expect(gitManager.createBranch('bugfix-123')).resolves.toBeUndefined()
      await expect(gitManager.createBranch('release_v2.0')).resolves.toBeUndefined()
    })
  })

  describe('checkout - 验证', () => {
    it('应该拒绝空分支名', async () => {
      await expect(gitManager.checkout('')).rejects.toThrow('Invalid branch name')
    })

    it('应该拒绝包含特殊字符的分支名', async () => {
      await expect(gitManager.checkout('branch;evil')).rejects.toThrow('Invalid branch name')
    })
  })

  describe('add - 验证', () => {
    it('应该在 files 为空数组时 add 全部', async () => {
      await fs.writeFile(path.join(testDir, 'file.txt'), 'content')
      await gitManager.add([])

      const { stdout } = await execAsync('git status --porcelain', { cwd: testDir })
      expect(stdout).toContain('file.txt')
    })

    it('应该拒绝带命令注入的文件名', async () => {
      await expect(gitManager.add(['file.txt;rm -rf /'])).rejects.toThrow('Invalid file path')
      await expect(gitManager.add(['file$(whoami).txt'])).rejects.toThrow('Invalid file path')
      await expect(gitManager.add(['file`id`.txt'])).rejects.toThrow('Invalid file path')
    })

    it('应该拒绝空文件路径', async () => {
      await expect(gitManager.add([''])).rejects.toThrow('Invalid file path')
    })

    it('应该逐个添加指定的文件', async () => {
      await fs.writeFile(path.join(testDir, 'a.txt'), 'a')
      await fs.writeFile(path.join(testDir, 'b.txt'), 'b')

      await gitManager.add(['a.txt'])

      const { stdout } = await execAsync('git status --porcelain', { cwd: testDir })
      expect(stdout).toContain('a.txt')
    })
  })

  describe('commit - 验证', () => {
    it('应该拒绝空 commit message', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content')

      const result = await gitManager.commit('')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('应该处理 git commit 执行失败', async () => {
      const longMsg = 'a'.repeat(10000) + '$(evil)'
      await fs.writeFile(path.join(testDir, 'test.txt'), 'content')

      const result = await gitManager.commit(longMsg)

      expect(result.success).toBe(false)
    })
  })

  describe('push - 边界情况', () => {
    it('应该在 ahead=0 时返回 Nothing to push', async () => {
      const result = await gitManager.push()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Nothing to push')
    })

    it('应该在无远程仓库时返回错误', async () => {
      await fs.writeFile(path.join(testDir, 'new.txt'), 'content')
      await execAsync('git add -A && git commit -m "new"', { cwd: testDir })

      const result = await gitManager.push()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('log - 验证和边界', () => {
    it('应该拒绝 0 作为 limit', async () => {
      await expect(gitManager.log(0)).rejects.toThrow('must be a positive integer')
    })

    it('应该拒绝负数作为 limit', async () => {
      await expect(gitManager.log(-5)).rejects.toThrow('must be a positive integer')
    })

    it('应该拒绝非整数 limit', async () => {
      await expect(gitManager.log(1.5 as any)).rejects.toThrow('must be a positive integer')
    })

    it('应该在空仓库中返回空数组', async () => {
      const emptyDir = '/tmp/clawcompany-git-empty-' + Date.now()
      await fs.mkdir(emptyDir, { recursive: true })
      await execAsync('git init', { cwd: emptyDir })

      const emptyManager = new GitManager(emptyDir)
      const log = await emptyManager.log()

      expect(log).toEqual([])

      await fs.rm(emptyDir, { recursive: true, force: true })
    })
  })

  describe('getProjectDir', () => {
    it('应该返回构造函数传入的目录', () => {
      expect(gitManager.getProjectDir()).toBe(testDir)
    })
  })
})
