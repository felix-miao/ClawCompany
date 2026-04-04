import * as fs from 'fs/promises'
import * as path from 'path'

const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.jsonc',
  '.md', '.mdx',
  '.css', '.scss', '.less',
  '.html', '.htm',
  '.txt', '.csv',
  '.yaml', '.yml', '.toml',
  '.svg', '.xml',
  '.env', '.env.local', '.env.development', '.env.production',
  '.gitignore', '.eslintrc', '.prettierrc',
  '.sh', '.bash',
  '.py', '.rb', '.go', '.rs', '.java',
  '.sql',
  '.graphql', '.gql',
  '.proto',
  '.conf', '.cfg', '.ini',
  '.lock',
])

const DANGEROUS_PATTERNS = [
  /\0/,
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bprocess\.env\b/,
  /\brequire\s*\(\s*['"]child_process['"]\s*\)/,
  /\brequire\s*\(\s*['"]fs['"]\s*\)/,
  /\brequire\s*\(\s*['"]fs\/promises['"]\s*\)/,
  /\bimport\s+.*\bfrom\s+['"]child_process['"]/,
  /\bimport\s+.*\bfrom\s+['"]fs['"]/,
  /\bimport\s+.*\bfrom\s+['"]fs\/promises['"]/,
  /\bexec\s*\(/,
  /\bexecSync\s*\(/,
  /\bspawn\s*\(/,
  /\bspawnSync\s*\(/,
]

const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const SANDBOX_DIR = 'output'

export interface SandboxValidationResult {
  allowed: boolean
  reason?: string
  sanitizedPath?: string
}

export interface SandboxWriteResult {
  success: boolean
  path?: string
  error?: string
  warnings?: string[]
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/')
}

function getFileExtension(filePath: string): string {
  const basename = path.basename(filePath)
  const multiExtMatch = basename.match(/^\.env\.\w+/)
  if (multiExtMatch) return multiExtMatch[0]
  const dotConfigMatch = basename.match(/^\.\w+rc$/)
  if (dotConfigMatch) return basename
  return path.extname(basename).toLowerCase()
}

export class SandboxedFileWriter {
  private rootDir: string
  private sandboxDir: string
  private allowedExtensions: Set<string>
  private maxFileSize: number
  private warnings: string[] = []

  constructor(rootDir: string, options?: {
    allowedExtensions?: string[]
    maxFileSize?: number
    sandboxSubdir?: string
  }) {
    this.rootDir = path.resolve(rootDir)
    this.sandboxDir = path.resolve(rootDir, options?.sandboxSubdir ?? SANDBOX_DIR)
    this.allowedExtensions = options?.allowedExtensions
      ? new Set(options.allowedExtensions.map(e => e.toLowerCase()))
      : ALLOWED_EXTENSIONS
    this.maxFileSize = options?.maxFileSize ?? MAX_FILE_SIZE
  }

  validatePath(filePath: string): SandboxValidationResult {
    if (!filePath || typeof filePath !== 'string') {
      return { allowed: false, reason: 'File path is required' }
    }

    const normalized = normalizePath(filePath)

    if (normalized.includes('..')) {
      return { allowed: false, reason: 'Path traversal detected: ".." is not allowed' }
    }

    if (path.isAbsolute(normalized)) {
      return { allowed: false, reason: 'Absolute paths are not allowed' }
    }

    const segments = normalized.split('/')
    for (const seg of segments) {
      if (seg === '..' || seg === '.' || seg === '') {
        if (seg === '') continue
        return { allowed: false, reason: `Invalid path segment: "${seg}"` }
      }
    }

    const ext = getFileExtension(normalized)
    if (ext && !this.allowedExtensions.has(ext)) {
      return {
        allowed: false,
        reason: `File extension "${ext}" is not allowed. Allowed: ${Array.from(this.allowedExtensions).sort().join(', ')}`,
      }
    }

    const relativeToSandbox = normalized.startsWith(SANDBOX_DIR + '/')
      ? normalized
      : `${SANDBOX_DIR}/${normalized}`

    const fullPath = path.resolve(this.rootDir, relativeToSandbox)
    if (!fullPath.startsWith(this.sandboxDir)) {
      return { allowed: false, reason: 'Path must resolve within the sandbox directory' }
    }

    return { allowed: true, sanitizedPath: relativeToSandbox }
  }

  validateContent(content: string): SandboxValidationResult {
    if (typeof content !== 'string') {
      return { allowed: false, reason: 'Content must be a string' }
    }

    if (content.length === 0) {
      return { allowed: true }
    }

    const byteSize = Buffer.byteLength(content, 'utf-8')
    if (byteSize > this.maxFileSize) {
      return {
        allowed: false,
        reason: `Content exceeds maximum size of ${this.maxFileSize} bytes (got ${byteSize})`,
      }
    }

    this.warnings = []

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(content)) {
        this.warnings.push(`Content contains potentially dangerous pattern: ${pattern.source}`)
      }
      pattern.lastIndex = 0
    }

    return { allowed: true }
  }

  async writeFile(filePath: string, content: string): Promise<SandboxWriteResult> {
    const pathResult = this.validatePath(filePath)
    if (!pathResult.allowed) {
      return { success: false, error: pathResult.reason }
    }

    const contentResult = this.validateContent(content)
    if (!contentResult.allowed) {
      return { success: false, error: contentResult.reason }
    }

    const fullPath = path.resolve(this.rootDir, pathResult.sanitizedPath!)

    try {
      const dir = path.dirname(fullPath)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(fullPath, content, 'utf-8')

      return {
        success: true,
        path: pathResult.sanitizedPath,
        warnings: this.warnings.length > 0 ? [...this.warnings] : undefined,
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${(error as Error).message}`,
      }
    }
  }

  async readAllowed(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const pathResult = this.validatePath(filePath)
    if (!pathResult.allowed) {
      return { success: false, error: pathResult.reason }
    }

    const fullPath = path.resolve(this.rootDir, pathResult.sanitizedPath!)

    try {
      const content = await fs.readFile(fullPath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: `Failed to read file: ${(error as Error).message}` }
    }
  }

  async listFiles(subdir?: string): Promise<{ success: boolean; files?: string[]; error?: string }> {
    const targetDir = subdir
      ? path.resolve(this.sandboxDir, subdir)
      : this.sandboxDir

    if (!targetDir.startsWith(this.sandboxDir)) {
      return { success: false, error: 'Path must be within sandbox directory' }
    }

    try {
      const files = await this.readDirRecursive(targetDir)
      return { success: true, files }
    } catch (error) {
      return { success: false, error: `Failed to list files: ${(error as Error).message}` }
    }
  }

  private async readDirRecursive(dir: string): Promise<string[]> {
    const files: string[] = []
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          const subFiles = await this.readDirRecursive(fullPath)
          files.push(...subFiles)
        } else if (entry.isFile()) {
          const relativePath = path.relative(this.sandboxDir, fullPath)
          files.push(relativePath)
        }
      }
    } catch {
      // ignore unreadable dirs
    }
    return files
  }

  async deleteFile(filePath: string): Promise<SandboxWriteResult> {
    const pathResult = this.validatePath(filePath)
    if (!pathResult.allowed) {
      return { success: false, error: pathResult.reason }
    }

    const fullPath = path.resolve(this.rootDir, pathResult.sanitizedPath!)

    try {
      await fs.unlink(fullPath)
      return { success: true, path: pathResult.sanitizedPath }
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete file: ${(error as Error).message}`,
      }
    }
  }

  getSandboxDir(): string {
    return this.sandboxDir
  }

  getAllowedExtensions(): string[] {
    return Array.from(this.allowedExtensions).sort()
  }
}

export const sandboxedFileWriter = new SandboxedFileWriter(process.cwd())
