import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * 文件系统操作管理器
 * 
 * 负责安全地管理项目文件系统操作，包括：
 * - 创建/读取/更新/删除文件
 * - 目录管理
 * - 安全验证（防止路径遍历攻击）
 * - 错误处理
 * 
 * 安全策略：
 * 1. 所有操作限制在项目根目录内
 * 2. 拒绝包含 .. 的路径
 * 3. 拒绝绝对路径
 * 4. 自动创建必要的目录结构
 */

export interface FileResult {
  success: boolean
  path?: string
  content?: string
  files?: string[]
  error?: string
  overwritten?: boolean
}

export class FileSystemManager {
  private rootDir: string

  constructor(rootDir: string) {
    // 确保根目录是绝对路径
    this.rootDir = path.resolve(rootDir)
  }

  /**
   * 验证路径是否安全
   * 防止路径遍历攻击
   */
  private validatePath(filePath: string): { valid: boolean; error?: string } {
    // 检查是否包含 ..
    if (filePath.includes('..')) {
      return { valid: false, error: 'Invalid path: path traversal detected' }
    }

    // 检查是否是绝对路径
    if (path.isAbsolute(filePath)) {
      return { valid: false, error: 'Invalid path: absolute paths not allowed' }
    }

    // 解析完整路径
    const fullPath = path.resolve(this.rootDir, filePath)

    // 检查是否在根目录内
    if (!fullPath.startsWith(this.rootDir)) {
      return { valid: false, error: 'Invalid path: path outside project directory' }
    }

    return { valid: true }
  }

  /**
   * 获取完整路径
   */
  private getFullPath(filePath: string): string {
    return path.resolve(this.rootDir, filePath)
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      // 如果目录已存在，忽略错误
      if ((error as any).code !== 'EEXIST') {
        throw error
      }
    }
  }

  /**
   * 创建文件
   * 
   * @param filePath - 相对文件路径
   * @param content - 文件内容
   * @returns 操作结果
   */
  async createFile(filePath: string, content: string): Promise<FileResult> {
    // 1. 验证路径
    const validation = this.validatePath(filePath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const fullPath = this.getFullPath(filePath)

    try {
      // 2. 检查文件是否已存在
      let exists = false
      try {
        await fs.access(fullPath)
        exists = true
      } catch {
        // 文件不存在，继续
      }

      // 3. 确保目录存在
      const dir = path.dirname(fullPath)
      await this.ensureDir(dir)

      // 4. 写入文件
      await fs.writeFile(fullPath, content, 'utf-8')

      return {
        success: true,
        path: fullPath,
        overwritten: exists
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create file: ${(error as Error).message}`
      }
    }
  }

  /**
   * 读取文件
   * 
   * @param filePath - 相对文件路径
   * @returns 文件内容
   */
  async readFile(filePath: string): Promise<FileResult> {
    // 1. 验证路径
    const validation = this.validatePath(filePath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const fullPath = this.getFullPath(filePath)

    try {
      // 2. 读取文件
      const content = await fs.readFile(fullPath, 'utf-8')

      return {
        success: true,
        path: fullPath,
        content
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return {
          success: false,
          error: 'File not found'
        }
      }
      return {
        success: false,
        error: `Failed to read file: ${(error as Error).message}`
      }
    }
  }

  /**
   * 更新文件
   * 
   * @param filePath - 相对文件路径
   * @param content - 新的文件内容
   * @returns 操作结果
   */
  async updateFile(filePath: string, content: string): Promise<FileResult> {
    // 1. 验证路径
    const validation = this.validatePath(filePath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const fullPath = this.getFullPath(filePath)

    try {
      // 2. 检查文件是否存在
      try {
        await fs.access(fullPath)
      } catch {
        return {
          success: false,
          error: 'File not found'
        }
      }

      // 3. 更新文件
      await fs.writeFile(fullPath, content, 'utf-8')

      return {
        success: true,
        path: fullPath
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update file: ${(error as Error).message}`
      }
    }
  }

  /**
   * 删除文件
   * 
   * @param filePath - 相对文件路径
   * @returns 操作结果
   */
  async deleteFile(filePath: string): Promise<FileResult> {
    // 1. 验证路径
    const validation = this.validatePath(filePath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const fullPath = this.getFullPath(filePath)

    try {
      // 2. 删除文件
      await fs.unlink(fullPath)

      return {
        success: true,
        path: fullPath
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return {
          success: false,
          error: 'File not found'
        }
      }
      return {
        success: false,
        error: `Failed to delete file: ${(error as Error).message}`
      }
    }
  }

  /**
   * 列出所有文件
   * 
   * @param dirPath - 相对目录路径（可选，默认为根目录）
   * @returns 文件列表
   */
  async listFiles(dirPath: string = ''): Promise<FileResult> {
    // 1. 验证路径
    const validation = this.validatePath(dirPath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const fullPath = this.getFullPath(dirPath)

    try {
      // 2. 递归读取目录
      const files = await this.readDirRecursive(fullPath)

      return {
        success: true,
        files
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${(error as Error).message}`
      }
    }
  }

  /**
   * 递归读取目录
   */
  private async readDirRecursive(dir: string): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          // 递归读取子目录
          const subFiles = await this.readDirRecursive(fullPath)
          files.push(...subFiles)
        } else if (entry.isFile()) {
          // 添加文件路径（转换为相对路径）
          const relativePath = path.relative(this.rootDir, fullPath)
          files.push(relativePath)
        }
      }
    } catch (error) {
      // 忽略无法读取的目录
    }

    return files
  }

  /**
   * 清理测试文件
   * 仅用于测试环境
   */
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.rootDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略清理错误
    }
  }

  /**
   * 获取项目根目录
   */
  getRootDir(): string {
    return this.rootDir
  }
}

// 默认实例（用于 orchestrator）
export const fileSystemManager = new FileSystemManager(process.cwd())
