import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

import { GitManager } from '../manager'

const execAsync = promisify(exec)

describe('GitManager - 覆盖率补充测试', () => {
  let gitManager: GitManager
  const testDir = '/tmp/clawcompany-coverage-test-' + Date.now()
  const remoteDir = '/tmp/clawcompany-coverage-remote-' + Date.now()

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(remoteDir, { recursive: true })

    await execAsync('git init --bare', { cwd: remoteDir })
    await execAsync('git init', { cwd: testDir })
    await execAsync('git config user.email "test@test.com"', { cwd: testDir })
    await execAsync('git config user.name "Test User"', { cwd: testDir })

    await fs.writeFile(path.join(testDir, 'README.md'), '# Test')
    await execAsync('git add -A && git commit -m "Initial commit"', { cwd: testDir })

    await execAsync(`git remote add origin ${remoteDir}`, { cwd: testDir })
    await execAsync('git push -u origin HEAD', { cwd: testDir })

    gitManager = new GitManager(testDir)
  })

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }) } catch {}
    try { await fs.rm(remoteDir, { recursive: true, force: true }) } catch {}
  })

  describe('status - upstream ahead/behind', () => {
    it('应该在与 upstream 同步时返回 ahead=0 behind=0', async () => {
      const status = await gitManager.status()

      expect(status.isRepo).toBe(true)
      expect(status.ahead).toBe(0)
      expect(status.behind).toBe(0)
    })

    it('应该检测 ahead commits', async () => {
      await fs.writeFile(path.join(testDir, 'new.txt'), 'content')
      await execAsync('git add -A && git commit -m "local commit"', { cwd: testDir })

      const status = await gitManager.status()

      expect(status.ahead).toBe(1)
      expect(status.behind).toBe(0)
    })

    it('应该检测 behind commits', async () => {
      const cloneDir = '/tmp/clawcompany-coverage-clone-' + Date.now()
      await execAsync(`git clone ${remoteDir} ${cloneDir}`)
      await execAsync('git config user.email "test@test.com"', { cwd: cloneDir })
      await execAsync('git config user.name "Test User"', { cwd: cloneDir })

      await fs.writeFile(path.join(cloneDir, 'remote.txt'), 'content')
      await execAsync('git add -A && git commit -m "remote commit"', { cwd: cloneDir })
      await execAsync('git push', { cwd: cloneDir })

      await execAsync('git fetch', { cwd: testDir })

      const status = await gitManager.status()

      expect(status.ahead).toBe(0)
      expect(status.behind).toBe(1)

      await fs.rm(cloneDir, { recursive: true, force: true })
    })
  })

  describe('push - 成功路径', () => {
    it('应该在有 ahead commits 时成功 push', async () => {
      await fs.writeFile(path.join(testDir, 'push-test.txt'), 'content')
      await execAsync('git add -A && git commit -m "push test"', { cwd: testDir })

      const status = await gitManager.status()
      expect(status.ahead).toBe(1)

      const result = await gitManager.push()

      expect(result.success).toBe(true)
      expect(result.message).toContain('Pushed 1 commits')
    })
  })

  describe('checkout - 成功路径', () => {
    it('应该成功切换到已存在的分支', async () => {
      await execAsync('git branch test-branch', { cwd: testDir })

      await gitManager.checkout('test-branch')

      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: testDir })
      expect(stdout.trim()).toBe('test-branch')
    })
  })

  describe('status - rev-list 内部 catch', () => {
    it('应该在 upstream ref 存在但 rev-list 失败时返回正常状态', async () => {
      await fs.writeFile(path.join(testDir, 'broken.txt'), 'content')
      await execAsync('git add -A && git commit -m "local change"', { cwd: testDir })

      const headHash = (await execAsync('git rev-parse HEAD', { cwd: testDir })).stdout.trim()

      const fakeRefDir = path.join(testDir, '.git', 'refs', 'remotes', 'origin')
      await fs.mkdir(fakeRefDir, { recursive: true })
      await fs.writeFile(path.join(fakeRefDir, 'broken-branch'), 'invalid-ref-content-not-a-hash\n')

      const branchName = (await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: testDir })).stdout.trim()
      const configPath = path.join(testDir, '.git', 'config')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const patched = configContent + `\n[branch "${branchName}"]\n\tremote = origin\n\tmerge = refs/heads/broken-branch\n`
      await fs.writeFile(configPath, patched)

      const status = await gitManager.status()

      expect(status.isRepo).toBe(true)
      expect(status.ahead).toBe(0)
      expect(status.behind).toBe(0)
    })
  })

  describe('push - git push 失败', () => {
    it('应该在 git push 命令失败时返回错误', async () => {
      await fs.writeFile(path.join(testDir, 'push-fail.txt'), 'content')
      await execAsync('git add -A && git commit -m "will fail push"', { cwd: testDir })

      await fs.rm(remoteDir, { recursive: true, force: true })

      const result = await gitManager.push()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('commitAndPush - 成功路径', () => {
    it('应该在 commit 和 push 都成功时返回成功', async () => {
      await fs.writeFile(path.join(testDir, 'cap.txt'), 'content')

      const result = await gitManager.commitAndPush('commit and push test')

      expect(result.success).toBe(true)
      expect(result.message).toContain('Pushed')
    })
  })
})
