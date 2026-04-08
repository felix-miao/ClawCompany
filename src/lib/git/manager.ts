import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const BRANCH_NAME_RE = /^[a-zA-Z0-9._\-/]+$/
const GIT_PATH_RE = /^[^\0;|&$`"'!\n\r]+$/
const COMMIT_MSG_RE = /^[^\0`$|&;!\n\r]+$/

export interface GitStatus {
  isRepo: boolean
  branch: string
  hasChanges: boolean
  files: string[]
  ahead: number
  behind: number
}

export interface CommitResult {
  success: boolean
  commitHash?: string
  message?: string
  error?: string
}

export class GitManager {
  private projectDir: string

  constructor(projectDir: string) {
    this.projectDir = projectDir
  }

  private validateBranchName(name: string): void {
    if (!name || !BRANCH_NAME_RE.test(name)) {
      throw new Error(`Invalid branch name: "${name}". Only alphanumeric, dash, underscore, dot, and slash allowed.`)
    }
  }

  private validateFilePath(filePath: string): void {
    if (!filePath || !GIT_PATH_RE.test(filePath)) {
      throw new Error(`Invalid file path: "${filePath}". Contains disallowed characters.`)
    }
  }

  private validateCommitMessage(message: string): void {
    if (!message || !COMMIT_MSG_RE.test(message)) {
      throw new Error(`Invalid commit message: contains disallowed characters.`)
    }
  }

  private validatePositiveInt(value: number, name: string): void {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`Invalid ${name}: must be a positive integer, got ${value}`)
    }
  }

  async status(): Promise<GitStatus> {
    try {
      await this.exec('git', ['rev-parse', '--git-dir'])

      const { stdout: branch } = await this.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'])

      const { stdout: statusOutput } = await this.exec('git', ['status', '--porcelain'])
      const files = statusOutput.split('\n').filter(f => f.trim()).map(f => f.substring(3))

      let ahead = 0
      let behind = 0

      try {
        const { stdout: upstream } = await this.exec('git', ['rev-parse', '--abbrev-ref', '@{upstream}'])
        const upstreamTrimmed = upstream.trim()
        if (upstreamTrimmed) {
          try {
            const { stdout: counts } = await this.exec('git', [
              'rev-list', '--left-right', '--count', `${upstreamTrimmed}...HEAD`
            ])
            const [behindCount, aheadCount] = counts.trim().split('\t').map(Number)
            ahead = aheadCount || 0
            behind = behindCount || 0
          } catch {
            // ignore
          }
        }
      } catch {
        // no upstream
      }

      return {
        isRepo: true,
        branch: branch.trim(),
        hasChanges: files.length > 0,
        files,
        ahead,
        behind
      }
    } catch (error) {
      return {
        isRepo: false,
        branch: '',
        hasChanges: false,
        files: [],
        ahead: 0,
        behind: 0
      }
    }
  }

  async add(files?: string[]): Promise<void> {
    if (files && files.length > 0) {
      for (const file of files) {
        this.validateFilePath(file)
        await this.exec('git', ['add', file])
      }
    } else {
      await this.exec('git', ['add', '-A'])
    }
  }

  async commit(message: string): Promise<CommitResult> {
    try {
      this.validateCommitMessage(message)

      const status = await this.status()
      if (!status.hasChanges) {
        return {
          success: false,
          error: 'No changes to commit'
        }
      }

      await this.add()

      const { stdout } = await this.exec('git', ['commit', '-m', message])

      const { stdout: hash } = await this.exec('git', ['rev-parse', 'HEAD'])

      return {
        success: true,
        commitHash: hash.trim().substring(0, 7),
        message: `Committed ${status.files.length} files`
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async push(): Promise<CommitResult> {
    try {
      const status = await this.status()

      if (status.ahead === 0) {
        return {
          success: false,
          error: 'Nothing to push'
        }
      }

      await this.exec('git', ['push'])

      return {
        success: true,
        message: `Pushed ${status.ahead} commits`
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async commitAndPush(message: string): Promise<CommitResult> {
    const commitResult = await this.commit(message)

    if (!commitResult.success) {
      return commitResult
    }

    return await this.push()
  }

  async createBranch(branchName: string): Promise<void> {
    this.validateBranchName(branchName)
    await this.exec('git', ['checkout', '-b', branchName])
  }

  async checkout(branchName: string): Promise<void> {
    this.validateBranchName(branchName)
    await this.exec('git', ['checkout', branchName])
  }

  async log(limit: number = 10): Promise<Array<{
    hash: string
    message: string
    author: string
    date: string
  }>> {
    this.validatePositiveInt(limit, 'limit')

    try {
      const { stdout } = await this.exec('git', [
        'log', '--pretty=format:%H|%s|%an|%ai', '-n', String(limit)
      ])

      return stdout.split('\n').map(line => {
        const [hash, message, author, date] = line.split('|')
        return {
          hash: hash.substring(0, 7),
          message,
          author,
          date
        }
      })
    } catch (error) {
      return []
    }
  }

  private async exec(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync(command, args, { cwd: this.projectDir })
  }

  getProjectDir(): string {
    return this.projectDir
  }
}
