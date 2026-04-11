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

  // ── Python dangerous patterns ──────────────────────────────────────────────
  /\bos\.system\s*\(/,
  /\bsubprocess\.(call|run|Popen|check_output|getoutput|getstatusoutput)\s*\(/,
  /\bimport\s+subprocess\b/,
  /\bfrom\s+subprocess\s+import\b/,
  /\bexec\s*\(.*compile/,
  /\b__import__\s*\(/,
  /\bpickle\.(load|loads)\s*\(/,
  /\beval\s*\(/,
  /\bexecfile\s*\(/,

  // ── Shell / Bash dangerous patterns ───────────────────────────────────────
  /`[^`]*`/,                         // backtick command substitution
  /\$\([^)]*\)/,                      // $(command) substitution
  /\bcurl\s+.*\|\s*(ba)?sh\b/i,       // curl | sh / curl | bash
  /\bwget\s+.*\|\s*(ba)?sh\b/i,       // wget | sh / wget | bash
  /\bchmod\s+[0-7]*\+x\b/,           // chmod +x (making scripts executable)
  /\brm\s+-rf?\b/,                    // rm -rf
  /\bdd\s+if=/,                       // dd if=... (disk operations)
  /\b(nc|ncat|netcat)\s+/,           // netcat / reverse shells
  /\b(python|python3|ruby|perl)\s+-[ce]\s+/,  // inline eval execution
  /\bbase64\s+-d\b.*\|\s*(ba)?sh\b/i, // base64 -d | sh

  // ── HTML / XSS dangerous patterns ────────────────────────────────────────
  /javascript\s*:/gi,                 // javascript: URI
  /on(load|error|click|mouse\w+|key\w+|focus|blur|submit|change|input|drag\w*|touch\w*)\s*=/gi, // inline event handlers
  /data\s*:\s*text\/html/gi,          // data:text/html URIs
  /<!--[\s\S]*?-->/g,                 // HTML comments (may hide payloads)
  /\bvbscript\s*:/gi,                 // VBScript URI
]

// Patterns that are critical enough to BLOCK the write entirely.
// These indicate attempts to execute arbitrary commands or escape the sandbox.
const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brequire\s*\(\s*['"]child_process['"]\s*\)/, reason: 'require("child_process") is not allowed' },
  { pattern: /\bimport\s+.*\bfrom\s+['"]child_process['"]/, reason: 'import from "child_process" is not allowed' },
  { pattern: /\bexecSync\s*\(/, reason: 'execSync() is not allowed' },
  { pattern: /\bspawnSync\s*\(/, reason: 'spawnSync() is not allowed' },
  { pattern: /\0/, reason: 'Null byte in content is not allowed' },

  // ── Python ─────────────────────────────────────────────────────────────────
  { pattern: /\bos\.system\s*\(/, reason: 'os.system() is not allowed' },
  { pattern: /\bsubprocess\.(Popen|check_output|getoutput)\s*\(/, reason: 'subprocess execution is not allowed' },
  { pattern: /\bpickle\.(load|loads)\s*\(/, reason: 'pickle deserialization is not allowed' },

  // ── Shell ───────────────────────────────────────────────────────────────────
  { pattern: /\bcurl\s+.*\|\s*(ba)?sh\b/i, reason: 'curl piped to shell is not allowed' },
  { pattern: /\bwget\s+.*\|\s*(ba)?sh\b/i, reason: 'wget piped to shell is not allowed' },
  { pattern: /\bbase64\s+-d\b.*\|\s*(ba)?sh\b/i, reason: 'base64 decode piped to shell is not allowed' },

  // ── HTML ────────────────────────────────────────────────────────────────────
  { pattern: /javascript\s*:/gi, reason: 'javascript: URI is not allowed' },
  { pattern: /\bvbscript\s*:/gi, reason: 'vbscript: URI is not allowed' },
]

const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const SANDBOX_DIR = 'output'

export interface SandboxValidationResult {
  allowed: boolean
  reason?: string
  sanitizedPath?: string
  warnings?: string[]
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

    if (filePath.includes('\0')) {
      return { allowed: false, reason: 'Null byte in path is not allowed' }
    }

    const normalized = normalizePath(filePath)

    if (/^[A-Za-z]:\//.test(normalized)) {
      return { allowed: false, reason: 'Windows-style absolute paths are not allowed' }
    }

    if (normalized.startsWith('//')) {
      return { allowed: false, reason: 'UNC paths are not allowed' }
    }

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
    const safeSandbox = this.sandboxDir.endsWith(path.sep)
      ? this.sandboxDir
      : this.sandboxDir + path.sep

    if (fullPath !== this.sandboxDir && !fullPath.startsWith(safeSandbox)) {
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

    // Check critical patterns first — these BLOCK the write entirely.
    for (const { pattern, reason } of BLOCKED_PATTERNS) {
      if (pattern.test(content)) {
        pattern.lastIndex = 0
        return { allowed: false, reason }
      }
      pattern.lastIndex = 0
    }

    const warnings: string[] = []

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(`Content contains potentially dangerous pattern: ${pattern.source}`)
      }
      pattern.lastIndex = 0
    }

    return { allowed: true, warnings }
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
        warnings: contentResult.warnings && contentResult.warnings.length > 0
          ? [...contentResult.warnings]
          : undefined,
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
    if (subdir && subdir.includes('..')) {
      return { success: false, error: 'Path must be within sandbox directory' }
    }

    const targetDir = subdir
      ? path.resolve(this.sandboxDir, subdir)
      : this.sandboxDir

    const safeSandbox = this.sandboxDir.endsWith(path.sep)
      ? this.sandboxDir
      : this.sandboxDir + path.sep

    if (targetDir !== this.sandboxDir && !targetDir.startsWith(safeSandbox)) {
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
