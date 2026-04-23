import * as fs from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const REQUIRED_GITIGNORE_RULES = ['.DS_Store', 'node_modules/']

export interface RepoHygieneResult {
  missingIgnoreRules: string[]
  trackedFiles: string[]
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

export async function checkRepoHygiene(rootDir: string): Promise<RepoHygieneResult> {
  const gitignore = await readGitignore(rootDir)
  const trackedFiles = await listTrackedFiles(rootDir)
  const rules = parseGitignoreRules(gitignore)

  return {
    missingIgnoreRules: REQUIRED_GITIGNORE_RULES.filter(rule => !rules.includes(rule)),
    trackedFiles: trackedFiles.filter(file => file === '.DS_Store' || file.startsWith('node_modules/')),
  }
}
