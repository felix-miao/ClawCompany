/**
 * 内置工具实现：ExecTool / FileTool / FetchTool / GitTool
 *
 * 这些工具在 ClawCompany Node.js 进程内直接执行，
 * 适用于非 OpenClaw 宿主环境（独立部署场景）。
 */

import { execFile } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import { promisify } from 'util'
import { AgentTool, ToolResult, ToolParameterSchema } from './types'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// ExecTool - 执行 Shell 命令
// ---------------------------------------------------------------------------

export interface ExecInput {
  command: string
  args?: string[]
  cwd?: string
  /** 超时（毫秒），默认 30000 */
  timeoutMs?: number
}

export interface ExecOutput {
  stdout: string
  stderr: string
  exitCode: number
}

export class ExecTool implements AgentTool<ExecInput, ExecOutput> {
  readonly name = 'exec'
  readonly description = '在服务器上执行 Shell 命令。返回 stdout、stderr 和退出码。仅用于安全、只读或构建类操作。'
  readonly parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      command: { type: 'string', description: '可执行文件路径或命令名，不含参数' },
      args: { type: 'array', description: '命令参数列表' },
      cwd: { type: 'string', description: '工作目录（绝对路径），默认为进程 cwd' },
      timeoutMs: { type: 'number', description: '超时毫秒数，默认 30000' },
    },
    required: ['command'],
  } as ToolParameterSchema

  /** 允许执行的命令白名单（可按需扩展） */
  private readonly allowlist = new Set([
    'ls', 'cat', 'find', 'grep', 'rg', 'git', 'node', 'npm', 'pnpm',
    'yarn', 'tsc', 'jest', 'vitest', 'eslint', 'prettier', 'sh', 'bash',
  ])

  async execute(input: ExecInput): Promise<ToolResult<ExecOutput>> {
    const cmd = path.basename(input.command)
    if (!this.allowlist.has(cmd)) {
      return { success: false, error: `Command "${cmd}" is not in the allowlist` }
    }

    const start = Date.now()
    try {
      const { stdout, stderr } = await execFileAsync(
        input.command,
        input.args ?? [],
        {
          cwd: input.cwd,
          timeout: input.timeoutMs ?? 30000,
          maxBuffer: 1024 * 1024 * 4, // 4MB
        }
      )
      return {
        success: true,
        data: { stdout, stderr, exitCode: 0 },
        durationMs: Date.now() - start,
      }
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number }
      return {
        success: false,
        data: { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.code ?? 1 },
        error: e.message,
        durationMs: Date.now() - start,
      }
    }
  }

  formatResult(result: ToolResult<ExecOutput>): string {
    if (!result.success || !result.data) {
      return `[exec error] ${result.error}`
    }
    const { stdout, stderr, exitCode } = result.data
    const lines: string[] = [`exit_code: ${exitCode}`]
    if (stdout.trim()) lines.push(`stdout:\n${stdout.trim()}`)
    if (stderr.trim()) lines.push(`stderr:\n${stderr.trim()}`)
    return lines.join('\n')
  }
}

// ---------------------------------------------------------------------------
// FileTool - 读写文件
// ---------------------------------------------------------------------------

export type FileAction = 'read' | 'write' | 'append' | 'delete' | 'list'

export interface FileInput {
  action: FileAction
  path: string
  content?: string
  encoding?: BufferEncoding
}

export interface FileOutput {
  content?: string
  entries?: string[]
  bytesWritten?: number
}

export class FileTool implements AgentTool<FileInput, FileOutput> {
  readonly name = 'file'
  readonly description = '读写本地文件系统。支持读取、写入、追加、删除文件，以及列出目录内容。'
  readonly parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'write', 'append', 'delete', 'list'],
        description: '操作类型：read 读取文件，write 覆盖写入，append 追加，delete 删除，list 列出目录',
      },
      path: { type: 'string', description: '文件或目录的绝对路径' },
      content: { type: 'string', description: '写入/追加时的内容（write/append 时必填）' },
      encoding: { type: 'string', description: '文件编码，默认 utf-8' },
    },
    required: ['action', 'path'],
  } as ToolParameterSchema

  async execute(input: FileInput): Promise<ToolResult<FileOutput>> {
    const enc = input.encoding ?? 'utf-8'
    const start = Date.now()
    try {
      switch (input.action) {
        case 'read': {
          const content = await fs.readFile(input.path, enc)
          return { success: true, data: { content }, durationMs: Date.now() - start }
        }
        case 'write': {
          await fs.writeFile(input.path, input.content ?? '', enc)
          return { success: true, data: { bytesWritten: (input.content ?? '').length }, durationMs: Date.now() - start }
        }
        case 'append': {
          await fs.appendFile(input.path, input.content ?? '', enc)
          return { success: true, data: { bytesWritten: (input.content ?? '').length }, durationMs: Date.now() - start }
        }
        case 'delete': {
          await fs.unlink(input.path)
          return { success: true, data: {}, durationMs: Date.now() - start }
        }
        case 'list': {
          const entries = await fs.readdir(input.path)
          return { success: true, data: { entries }, durationMs: Date.now() - start }
        }
        default:
          return { success: false, error: `Unknown action: ${(input as FileInput).action}` }
      }
    } catch (err: unknown) {
      const e = err as Error
      return { success: false, error: e.message, durationMs: Date.now() - start }
    }
  }

  formatResult(result: ToolResult<FileOutput>): string {
    if (!result.success || !result.data) return `[file error] ${result.error}`
    const d = result.data
    if (d.content !== undefined) return d.content
    if (d.entries) return d.entries.join('\n')
    if (d.bytesWritten !== undefined) return `Written ${d.bytesWritten} bytes`
    return 'OK'
  }
}

// ---------------------------------------------------------------------------
// FetchTool - HTTP 请求
// ---------------------------------------------------------------------------

export interface FetchInput {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: string
  /** 超时毫秒，默认 15000 */
  timeoutMs?: number
}

export interface FetchOutput {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

export class FetchTool implements AgentTool<FetchInput, FetchOutput> {
  readonly name = 'fetch'
  readonly description = '发起 HTTP/HTTPS 请求。可用于调用外部 API、抓取网页内容等。'
  readonly parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      url: { type: 'string', description: '请求 URL' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], description: 'HTTP 方法，默认 GET' },
      headers: { type: 'object', description: '请求头键值对' },
      body: { type: 'string', description: 'POST/PUT 请求体' },
      timeoutMs: { type: 'number', description: '超时毫秒数，默认 15000' },
    },
    required: ['url'],
  } as ToolParameterSchema

  async execute(input: FetchInput): Promise<ToolResult<FetchOutput>> {
    const start = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15000)

    try {
      const resp = await fetch(input.url, {
        method: input.method ?? 'GET',
        headers: input.headers,
        body: input.body,
        signal: controller.signal,
      })
      clearTimeout(timer)

      const body = await resp.text()
      const headers: Record<string, string> = {}
      resp.headers.forEach((v, k) => { headers[k] = v })

      return {
        success: resp.ok,
        data: { status: resp.status, statusText: resp.statusText, headers, body },
        durationMs: Date.now() - start,
        error: resp.ok ? undefined : `HTTP ${resp.status} ${resp.statusText}`,
      }
    } catch (err: unknown) {
      clearTimeout(timer)
      const e = err as Error
      return { success: false, error: e.message, durationMs: Date.now() - start }
    }
  }

  formatResult(result: ToolResult<FetchOutput>): string {
    if (!result.success || !result.data) return `[fetch error] ${result.error}`
    const { status, body } = result.data
    return `HTTP ${status}\n${body.substring(0, 4000)}`
  }
}

// ---------------------------------------------------------------------------
// GitTool - Git 操作
// ---------------------------------------------------------------------------

export type GitAction = 'status' | 'diff' | 'log' | 'add' | 'commit' | 'push' | 'pull' | 'branch' | 'checkout'

export interface GitInput {
  action: GitAction
  repoPath: string
  /** commit 时的提交信息 */
  message?: string
  /** add/checkout 时的文件路径或分支名 */
  ref?: string
  /** log 条数限制 */
  limit?: number
}

export interface GitOutput {
  output: string
}

export class GitTool implements AgentTool<GitInput, GitOutput> {
  readonly name = 'git'
  readonly description = '执行 Git 操作：查看状态/差异/日志、暂存文件、提交、推送/拉取、切换分支等。'
  readonly parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'diff', 'log', 'add', 'commit', 'push', 'pull', 'branch', 'checkout'],
        description: 'Git 操作类型',
      },
      repoPath: { type: 'string', description: 'Git 仓库根目录（绝对路径）' },
      message: { type: 'string', description: 'commit 时的提交信息（commit 操作必填）' },
      ref: { type: 'string', description: 'add 时的文件路径，或 checkout 时的分支名' },
      limit: { type: 'number', description: 'log 时返回的提交条数，默认 10' },
    },
    required: ['action', 'repoPath'],
  } as ToolParameterSchema

  async execute(input: GitInput): Promise<ToolResult<GitOutput>> {
    const start = Date.now()
    const run = (args: string[]) =>
      execFileAsync('git', args, { cwd: input.repoPath, timeout: 20000 })

    try {
      let result: { stdout: string; stderr: string }
      switch (input.action) {
        case 'status':   result = await run(['status', '--short']); break
        case 'diff':     result = await run(['diff']); break
        case 'log':      result = await run(['log', `--oneline`, `-${input.limit ?? 10}`]); break
        case 'add':      result = await run(['add', input.ref ?? '.']); break
        case 'commit':
          if (!input.message) return { success: false, error: '"message" is required for commit' }
          result = await run(['commit', '-m', input.message])
          break
        case 'push':     result = await run(['push']); break
        case 'pull':     result = await run(['pull']); break
        case 'branch':   result = await run(['branch', '-a']); break
        case 'checkout':
          if (!input.ref) return { success: false, error: '"ref" is required for checkout' }
          result = await run(['checkout', input.ref])
          break
        default:
          return { success: false, error: `Unknown git action: ${(input as GitInput).action}` }
      }
      return {
        success: true,
        data: { output: (result.stdout + result.stderr).trim() },
        durationMs: Date.now() - start,
      }
    } catch (err: unknown) {
      const e = err as Error & { stderr?: string }
      return { success: false, error: e.message, durationMs: Date.now() - start }
    }
  }

  formatResult(result: ToolResult<GitOutput>): string {
    if (!result.success || !result.data) return `[git error] ${result.error}`
    return result.data.output || '(no output)'
  }
}
