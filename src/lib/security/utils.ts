/**
 * 安全工具函数
 * 
 * 提供：
 * - API Key 管理
 * - 输入验证
 * - XSS 防护
 * - 速率限制
 */

import crypto from 'crypto'

/**
 * API Key 管理
 */
export class APIKeyManager {
  private static readonly ALGORITHM = 'aes-256-cbc'
  private static _cachedKey: Buffer | null = null

  private static getKey(): Buffer {
    if (this._cachedKey) return this._cachedKey

    const encryptionKey = process.env.ENCRYPTION_KEY
    if (!encryptionKey) {
      throw new Error(
        'ENCRYPTION_KEY environment variable is required. ' +
        'Set it before starting the application.'
      )
    }

    const salt = process.env.ENCRYPTION_SALT
    if (!salt) {
      throw new Error(
        'ENCRYPTION_SALT environment variable is required. ' +
        'Set a unique, random salt before starting the application.'
      )
    }
    this._cachedKey = crypto.scryptSync(encryptionKey, salt, 32)
    return this._cachedKey
  }

  /**
   * 加密 API Key
   */
  static encrypt(apiKey: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(
      this.ALGORITHM,
      this.getKey(),
      iv
    )
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    return iv.toString('hex') + ':' + encrypted
  }

  /**
   * 解密 API Key
   */
  static decrypt(encryptedKey: string): string {
    const parts = encryptedKey.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    
    const decipher = crypto.createDecipheriv(
      this.ALGORITHM,
      this.getKey(),
      iv
    )
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  /**
   * 验证 API Key 格式
   */
  static validate(apiKey: string): boolean {
    // GLM API Key 格式：32-64 字符的字母数字
    return /^[a-zA-Z0-9]{32,64}$/.test(apiKey)
  }

  /**
   * 从环境变量获取 API Key
   */
  static getFromEnv(): string | null {
    const encryptedKey = process.env.GLM_API_KEY
    
    if (!encryptedKey) {
      return null
    }
    
    // 如果是加密的，先解密
    if (encryptedKey.includes(':')) {
      try {
        return this.decrypt(encryptedKey)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('解密 API Key 失败:', error)
        return null
      }
    }
    
    return encryptedKey
  }

  /**
   * 安全存储 API Key（到环境变量文件）
   */
  static async saveToEnv(apiKey: string): Promise<void> {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const envPath = path.join(process.cwd(), '.env.local')
    const encrypted = this.encrypt(apiKey)
    
    let envContent = ''
    try {
      envContent = await fs.readFile(envPath, 'utf8')
    } catch {
      // 文件不存在，创建新的
    }
    
    // 更新或添加 GLM_API_KEY
    const lines = envContent.split('\n')
    const updated = lines.filter(line => !line.startsWith('GLM_API_KEY='))
    updated.push(`GLM_API_KEY=${encrypted}`)
    
    await fs.writeFile(envPath, updated.join('\n'), 'utf8')
  }
}

/**
 * 输入验证
 */
export class InputValidator {
  /**
   * 清理用户输入（防 XSS）
   */
  static sanitize(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  /**
   * 验证路径（防路径遍历）
   */
  static validatePath(inputPath: string): boolean {
    if (!inputPath || typeof inputPath !== 'string' || inputPath.trim().length === 0) {
      return false
    }

    if (inputPath.includes('\0')) {
      return false
    }

    if (/%2e|%252e|%2f|%5c/i.test(inputPath)) {
      return false
    }

    const normalized = inputPath.replace(/\\/g, '/')

    if (normalized.includes('..')) {
      return false
    }

    if (normalized.startsWith('/')) {
      return false
    }

    if (/^[A-Za-z]:\//.test(normalized)) {
      return false
    }

    if (normalized.startsWith('//')) {
      return false
    }

    return true
  }

  /**
   * 验证 Agent ID
   */
  static validateAgentId(id: string): boolean {
    // 只允许字母、数字、连字符
    return /^[a-z0-9-]+$/.test(id)
  }

  /**
   * 验证消息内容
   */
  static validateMessage(message: string): { valid: boolean; error?: string } {
    if (!message || message.trim().length === 0) {
      return { valid: false, error: 'Message cannot be empty' }
    }

    if (message.length > 10000) {
      return { valid: false, error: 'Message too long (max 10000 characters)' }
    }

    return { valid: true }
  }

  /**
   * 验证 JSON
   */
  static isValidJSON(str: string): boolean {
    try {
      JSON.parse(str)
      return true
    } catch {
      return false
    }
  }
}

/**
 * 速率限制
 */
export class RateLimiter {
  private static requests: Map<string, number[]> = new Map()
  private static readonly WINDOW_MS = 60000 // 1 分钟
  private static readonly MAX_REQUESTS = 60 // 每分钟最多 60 次
  private static readonly CLEANUP_INTERVAL_MS = 30000 // 30 秒清理一次
  private static cleanupTimer: ReturnType<typeof setInterval> | null = null

  private static ensureCleanupStarted(): void {
    if (this.cleanupTimer !== null) return
    this.cleanupTimer = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS)
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }

  static stopCleanup(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 检查是否超过速率限制
   */
  static isAllowed(identifier: string): boolean {
    this.ensureCleanupStarted()

    const now = Date.now()
    const windowStart = now - this.WINDOW_MS

    let requests = this.requests.get(identifier) || []
    requests = requests.filter(time => time > windowStart)

    if (requests.length >= this.MAX_REQUESTS) {
      return false
    }

    requests.push(now)
    this.requests.set(identifier, requests)

    return true
  }

  /**
   * 获取剩余请求次数
   */
  static getRemaining(identifier: string): number {
    const now = Date.now()
    const windowStart = now - this.WINDOW_MS

    let requests = this.requests.get(identifier) || []
    requests = requests.filter(time => time > windowStart)

    return Math.max(0, this.MAX_REQUESTS - requests.length)
  }

  /**
   * 重置某个标识符的限制
   */
  static reset(identifier: string): void {
    this.requests.delete(identifier)
  }

  /**
   * 清理所有过期记录
   */
  static cleanup(): number {
    const now = Date.now()
    const windowStart = now - this.WINDOW_MS

    const toDelete: string[] = []
    this.requests.forEach((requests, identifier) => {
      const filtered = requests.filter(time => time > windowStart)
      if (filtered.length === 0) {
        toDelete.push(identifier)
      } else {
        this.requests.set(identifier, filtered)
      }
    })

    toDelete.forEach(id => this.requests.delete(id))

    return toDelete.length
  }

  static get activeIdentifiers(): number {
    return this.requests.size
  }
}

/**
 * 安全管理器（别名）
 * 为了方便使用，提供 SecurityManager 别名
 */
export const SecurityManager = APIKeyManager
