import * as fs from 'fs/promises'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const REQUIRED_GITIGNORE_RULES = ['.DS_Store', 'node_modules/', '.opencode/']
const IGNORED_STRUCTURE_DIRS = new Set(['node_modules', '.opencode', '.next'])

export interface RepoHygieneResult {
  missingIgnoreRules: string[]
  trackedFiles: string[]
  unexpectedPackageRoots: string[]
}

async function readGitignore(rootDir: string): Promise<string> {
  try {
    return await fs.readFile(`${rootDir}/.gitignore`, 'utf8')
  } catch {
    return ''
  }
}

function parseGitignoreRules(gitignore: string): string[] {
  return gitignore
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
}

async function listTrackedFiles(rootDir: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files'], { cwd: rootDir })
    return stdout.split('\n').map(line => line.trim()).filter(Boolean)
  } catch {
    return []
  }
}

async function readPackageJson(rootDir: string): Promise<{ workspaces: string[] }> {
  try {
    const raw = await fs.readFile(`${rootDir}/package.json`, 'utf8')
    const parsed = JSON.parse(raw) as { workspaces?: string[] | { packages?: string[] } }

    if (Array.isArray(parsed.workspaces)) {
      return { workspaces: parsed.workspaces }
    }

    if (parsed.workspaces && Array.isArray(parsed.workspaces.packages)) {
      return { workspaces: parsed.workspaces.packages }
    }
  } catch {
    // Keep repo hygiene checks resilient when package.json is missing or invalid.
  }

  return { workspaces: [] }
}

async function listPackageJsonFiles(rootDir: string): Promise<string[]> {
  const discovered: string[] = []

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true })

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name)
      const relativePath = path.relative(rootDir, absolutePath)

      if (entry.isDirectory()) {
        if (IGNORED_STRUCTURE_DIRS.has(entry.name)) {
          continue
        }

        await walk(absolutePath)
        continue
      }

      if (entry.isFile() && entry.name === 'package.json') {
        discovered.push(relativePath)
      }
    }
  }

  try {
    await walk(rootDir)
  } catch {
    return []
  }

  return discovered
}

function isDeclaredWorkspacePath(filePath: string, workspaceGlobs: string[]): boolean {
  return workspaceGlobs.some(pattern => {
    if (pattern === '.') {
      return true
    }

    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2)
      return filePath.startsWith(`${prefix}/`) && filePath.split('/').length === prefix.split('/').length + 2
    }

    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3)
      return filePath === `${prefix}/package.json` || filePath.startsWith(`${prefix}/`)
    }

    return filePath === `${pattern.replace(/\/$/, '')}/package.json`
  })
}

export async function checkRepoHygiene(rootDir: string): Promise<RepoHygieneResult> {
  const gitignore = await readGitignore(rootDir)
  const trackedFiles = await listTrackedFiles(rootDir)
  const packageJsonFiles = await listPackageJsonFiles(rootDir)
  const { workspaces } = await readPackageJson(rootDir)
  const rules = parseGitignoreRules(gitignore)
  const unexpectedPackageRoots = packageJsonFiles
    .filter(file => file !== 'package.json')
    .filter(file => !isDeclaredWorkspacePath(file, workspaces))

  return {
    missingIgnoreRules: REQUIRED_GITIGNORE_RULES.filter(rule => !rules.includes(rule)),
    trackedFiles: trackedFiles.filter(file => file === '.DS_Store' || file.startsWith('node_modules/')),
    unexpectedPackageRoots,
  }
}
