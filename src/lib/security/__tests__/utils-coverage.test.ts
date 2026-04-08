import * as fs from 'fs/promises'
import * as path from 'path'

import { InputValidator, RateLimiter, APIKeyManager } from '../utils'

describe('APIKeyManager - ENCRYPTION_SALT missing', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing'
    delete process.env.ENCRYPTION_SALT
    jest.resetModules()
    APIKeyManager['_cachedKey'] = null
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_SALT
    APIKeyManager['_cachedKey'] = null
  })

  it('should throw when ENCRYPTION_SALT is not set', () => {
    expect(() => {
      const { APIKeyManager: AM } = require('../utils')
      AM.encrypt('test')
    }).toThrow(/ENCRYPTION_SALT/)
  })
})

describe('APIKeyManager - getFromEnv encrypted value', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing'
    process.env.ENCRYPTION_SALT = 'test-salt-for-testing'
    APIKeyManager['_cachedKey'] = null
  })

  afterEach(() => {
    delete process.env.GLM_API_KEY
    delete process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_SALT
    APIKeyManager['_cachedKey'] = null
  })

  it('should decrypt encrypted env var containing colon', () => {
    const original = 'my-plain-api-key'
    const encrypted = APIKeyManager.encrypt(original)
    process.env.GLM_API_KEY = encrypted

    const result = APIKeyManager.getFromEnv()
    expect(result).toBe(original)
  })

  it('should return null when decryption of invalid encrypted value fails', () => {
    process.env.GLM_API_KEY = 'invalid:encrypted:value'

    const result = APIKeyManager.getFromEnv()
    expect(result).toBeNull()
  })
})

describe('APIKeyManager - saveToEnv', () => {
  const testDir = '/tmp/clawcompany-saveToEnv-test-' + Date.now()

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing'
    process.env.ENCRYPTION_SALT = 'test-salt-for-testing'
    APIKeyManager['_cachedKey'] = null
  })

  afterEach(async () => {
    delete process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_SALT
    APIKeyManager['_cachedKey'] = null
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  })

  it('should save encrypted key to .env.local file', async () => {
    const _originalCwd = process.cwd()
    const envPath = path.join(testDir, '.env.local')
    await fs.mkdir(testDir, { recursive: true })

    jest.spyOn(process, 'cwd').mockReturnValue(testDir)

    await APIKeyManager.saveToEnv('test-api-key-123456789012345678901234')

    const content = await fs.readFile(envPath, 'utf8')
    expect(content).toContain('GLM_API_KEY=')
    expect(content).toContain(':')

    ;(process.cwd as jest.Mock).mockRestore()
  })

  it('should update existing GLM_API_KEY in .env.local', async () => {
    const _originalCwd = process.cwd()
    const envPath = path.join(testDir, '.env.local')
    await fs.mkdir(testDir, { recursive: true })
    await fs.writeFile(envPath, 'OTHER_VAR=hello\nGLM_API_KEY=old-value\n', 'utf8')

    jest.spyOn(process, 'cwd').mockReturnValue(testDir)

    await APIKeyManager.saveToEnv('new-key-123456789012345678901234567')

    const content = await fs.readFile(envPath, 'utf8')
    const lines = content.split('\n')
    const glmLines = lines.filter(l => l.startsWith('GLM_API_KEY='))
    expect(glmLines.length).toBe(1)
    expect(lines).toContain('OTHER_VAR=hello')

    ;(process.cwd as jest.Mock).mockRestore()
  })
})

describe('InputValidator - UNC path rejection', () => {
  it('should reject UNC paths starting with //', () => {
    expect(InputValidator.validatePath('//server/share')).toBe(false)
    expect(InputValidator.validatePath('//192.168.1.1/c$')).toBe(false)
  })
})

describe('RateLimiter - cleanup edge cases', () => {
  beforeEach(() => {
    RateLimiter.reset('rl-cleanup-test')
    RateLimiter.stopCleanup()
  })

  afterEach(() => {
    RateLimiter.reset('rl-cleanup-test')
    RateLimiter.stopCleanup()
  })

  it('should clean up expired identifiers', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000)
    RateLimiter.isAllowed('rl-cleanup-test')

    jest.spyOn(Date, 'now').mockReturnValue(61001)
    const deleted = RateLimiter.cleanup()
    expect(deleted).toBeGreaterThanOrEqual(1)
    expect(RateLimiter.activeIdentifiers).toBeLessThan(2)

    jest.restoreAllMocks()
  })

  it('should expose activeIdentifiers getter', () => {
    expect(RateLimiter.activeIdentifiers).toBeGreaterThanOrEqual(0)
    RateLimiter.isAllowed('rl-active-test-id')
    expect(RateLimiter.activeIdentifiers).toBeGreaterThanOrEqual(1)
    RateLimiter.reset('rl-active-test-id')
  })

  it('should call stopCleanup without error when timer is running', () => {
    RateLimiter.isAllowed('rl-stop-test')
    expect(() => RateLimiter.stopCleanup()).not.toThrow()
  })

  it('should handle stopCleanup when no timer is running', () => {
    RateLimiter.stopCleanup()
    expect(() => RateLimiter.stopCleanup()).not.toThrow()
  })
})
