import { SecurityManager, InputValidator, RateLimiter } from '../utils'

describe('SecurityManager', () => {
  const testKey = 'GLM_API_KEY'

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key'
  })

  describe('API Key Encryption', () => {
    it('should encrypt and decrypt API key', () => {
      const original = 'my-secret-api-key-12345678901234567890'
      const encrypted = SecurityManager.encrypt(original)
      const decrypted = SecurityManager.decrypt(encrypted)

      expect(decrypted).toBe(original)
      expect(encrypted).not.toBe(original)
    })

    it('should produce different encrypted values each time', () => {
      const original = 'test-api-key-12345678901234567890'
      const encrypted1 = SecurityManager.encrypt(original)
      const encrypted2 = SecurityManager.encrypt(original)

      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should handle empty strings', () => {
      const original = ''
      const encrypted = SecurityManager.encrypt(original)
      const decrypted = SecurityManager.decrypt(encrypted)

      expect(decrypted).toBe(original)
    })

    it('should handle long API keys', () => {
      const original = 'a'.repeat(100)
      const encrypted = SecurityManager.encrypt(original)
      const decrypted = SecurityManager.decrypt(encrypted)

      expect(decrypted).toBe(original)
    })

    it('should handle special characters', () => {
      const original = 'key-with-special-chars-!@#$%^&*()'
      const encrypted = SecurityManager.encrypt(original)
      const decrypted = SecurityManager.decrypt(encrypted)

      expect(decrypted).toBe(original)
    })

    it('should handle unicode characters', () => {
      const original = 'key-unicode-中文-日本語-한글'
      const encrypted = SecurityManager.encrypt(original)
      const decrypted = SecurityManager.decrypt(encrypted)

      expect(decrypted).toBe(original)
    })
  })

  describe('API Key Validation', () => {
    it('should validate API key format', () => {
      const validKey = 'a'.repeat(32)
      const invalidKey = 'short'

      expect(SecurityManager.validate(validKey)).toBe(true)
      expect(SecurityManager.validate(invalidKey)).toBe(false)
    })

    it('should accept 32 character keys', () => {
      const key = 'a'.repeat(32)
      expect(SecurityManager.validate(key)).toBe(true)
    })

    it('should accept 64 character keys', () => {
      const key = 'a'.repeat(64)
      expect(SecurityManager.validate(key)).toBe(true)
    })

    it('should reject keys shorter than 32 characters', () => {
      const key = 'a'.repeat(31)
      expect(SecurityManager.validate(key)).toBe(false)
    })

    it('should reject keys longer than 64 characters', () => {
      const key = 'a'.repeat(65)
      expect(SecurityManager.validate(key)).toBe(false)
    })

    it('should only accept alphanumeric characters', () => {
      const validKey = 'abc123XYZ789012345678901234567890' // 32 chars
      const invalidKey = 'abc-123_XYZ!01234567890123456789' // 32 chars with special

      expect(SecurityManager.validate(validKey)).toBe(true)
      expect(SecurityManager.validate(invalidKey)).toBe(false)
    })

    it('should handle empty string', () => {
      expect(SecurityManager.validate('')).toBe(false)
    })

    it('should handle null and undefined', () => {
      expect(SecurityManager.validate(null as any)).toBe(false)
      expect(SecurityManager.validate(undefined as any)).toBe(false)
    })
  })

  describe('Environment Variables', () => {
    it('should get API key from env', () => {
      process.env.GLM_API_KEY = 'test-key-from-env'

      const key = SecurityManager.getFromEnv()

      expect(key).toBe('test-key-from-env')
    })

    it('should return null if key not set', () => {
      delete process.env.GLM_API_KEY

      const key = SecurityManager.getFromEnv()

      expect(key).toBeNull()
    })

    it('should handle empty env value', () => {
      process.env.GLM_API_KEY = ''

      const key = SecurityManager.getFromEnv()

      expect(key).toBeNull() // 空字符串也返回 null
    })
  })
})

describe('InputValidator', () => {
  describe('sanitize', () => {
    it('should sanitize HTML tags', () => {
      const input = '<script>alert("XSS")</script>'
      const sanitized = InputValidator.sanitize(input)

      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('&lt;')
      expect(sanitized).toContain('&gt;')
    })

    it('should sanitize quotes', () => {
      const input = '"test" and \'test\''
      const sanitized = InputValidator.sanitize(input)

      expect(sanitized).toContain('&quot;')
      expect(sanitized).toContain('&#x27;')
    })

    it('should sanitize forward slashes', () => {
      const input = '</script>'
      const sanitized = InputValidator.sanitize(input)

      expect(sanitized).toContain('&#x2F;')
    })

    it('should preserve safe content', () => {
      const input = 'Hello, world!'
      const sanitized = InputValidator.sanitize(input)

      expect(sanitized).toBe(input)
    })

    it('should handle empty string', () => {
      const sanitized = InputValidator.sanitize('')

      expect(sanitized).toBe('')
    })

    it('should sanitize complex HTML', () => {
      const input = '<div onclick="alert(1)">Click me</div>'
      const sanitized = InputValidator.sanitize(input)

      expect(sanitized).not.toContain('<div')
      expect(sanitized).toContain('&lt;')
    })

    it('should sanitize multiple special characters', () => {
      const input = '<script>"test"\'test\'</script>'
      const sanitized = InputValidator.sanitize(input)

      expect(sanitized).toContain('&lt;')
      expect(sanitized).toContain('&gt;')
      expect(sanitized).toContain('&quot;')
      expect(sanitized).toContain('&#x27;')
    })
  })

  describe('validatePath', () => {
    it('should reject path traversal', () => {
      expect(InputValidator.validatePath('../../../etc/passwd')).toBe(false)
      expect(InputValidator.validatePath('..\\..\\windows')).toBe(false)
    })

    it('should reject absolute Unix paths', () => {
      expect(InputValidator.validatePath('/etc/passwd')).toBe(false)
      expect(InputValidator.validatePath('/usr/bin/node')).toBe(false)
    })

    it('should reject absolute Windows paths', () => {
      expect(InputValidator.validatePath('C:\\Windows')).toBe(false)
      expect(InputValidator.validatePath('D:\\Program Files')).toBe(false)
    })

    it('should accept valid relative paths', () => {
      expect(InputValidator.validatePath('src/file.ts')).toBe(true)
      expect(InputValidator.validatePath('components/Button.tsx')).toBe(true)
    })

    it('should accept nested directories', () => {
      expect(InputValidator.validatePath('src/lib/utils.ts')).toBe(true)
      expect(InputValidator.validatePath('a/b/c/d/e/file.txt')).toBe(true)
    })

    it('should accept filenames without path', () => {
      expect(InputValidator.validatePath('file.txt')).toBe(true)
      expect(InputValidator.validatePath('README.md')).toBe(true)
    })

    it('should handle empty string', () => {
      expect(InputValidator.validatePath('')).toBe(true)
    })
  })

  describe('validateAgentId', () => {
    it('should accept valid agent IDs', () => {
      expect(InputValidator.validateAgentId('pm-agent')).toBe(true)
      expect(InputValidator.validateAgentId('dev-agent-123')).toBe(true)
      expect(InputValidator.validateAgentId('custom-agent')).toBe(true)
    })

    it('should reject IDs with spaces', () => {
      expect(InputValidator.validateAgentId('pm agent')).toBe(false)
      expect(InputValidator.validateAgentId('dev  agent')).toBe(false)
    })

    it('should reject IDs with uppercase letters', () => {
      expect(InputValidator.validateAgentId('PM_AGENT')).toBe(false)
      expect(InputValidator.validateAgentId('DevAgent')).toBe(false)
    })

    it('should reject IDs with special characters', () => {
      expect(InputValidator.validateAgentId('pm_agent!')).toBe(false)
      expect(InputValidator.validateAgentId('dev@agent')).toBe(false)
    })

    it('should accept numeric IDs', () => {
      expect(InputValidator.validateAgentId('123')).toBe(true)
      expect(InputValidator.validateAgentId('agent-123-456')).toBe(true)
    })

    it('should handle empty string', () => {
      expect(InputValidator.validateAgentId('')).toBe(false)
    })
  })

  describe('validateMessage', () => {
    it('should accept valid messages', () => {
      const result = InputValidator.validateMessage('Hello, world!')
      expect(result.valid).toBe(true)
    })

    it('should reject empty messages', () => {
      const result = InputValidator.validateMessage('')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('should reject whitespace-only messages', () => {
      const result = InputValidator.validateMessage('   ')
      expect(result.valid).toBe(false)
    })

    it('should reject too long messages', () => {
      const longMessage = 'a'.repeat(10001)
      const result = InputValidator.validateMessage(longMessage)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('too long')
    })

    it('should accept messages at max length', () => {
      const maxMessage = 'a'.repeat(10000)
      const result = InputValidator.validateMessage(maxMessage)
      expect(result.valid).toBe(true)
    })

    it('should handle multiline messages', () => {
      const multiline = 'Line 1\nLine 2\nLine 3'
      const result = InputValidator.validateMessage(multiline)
      expect(result.valid).toBe(true)
    })

    it('should handle messages with special characters', () => {
      const special = 'Message with special chars: !@#$%^&*()'
      const result = InputValidator.validateMessage(special)
      expect(result.valid).toBe(true)
    })
  })

  describe('isValidJSON', () => {
    it('should validate correct JSON', () => {
      expect(InputValidator.isValidJSON('{"key": "value"}')).toBe(true)
      expect(InputValidator.isValidJSON('[1, 2, 3]')).toBe(true)
      expect(InputValidator.isValidJSON('true')).toBe(true)
      expect(InputValidator.isValidJSON('null')).toBe(true)
    })

    it('should reject invalid JSON', () => {
      expect(InputValidator.isValidJSON('not json')).toBe(false)
      expect(InputValidator.isValidJSON('{key: value}')).toBe(false)
      expect(InputValidator.isValidJSON('{"unclosed":')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(InputValidator.isValidJSON('')).toBe(false)
    })

    it('should validate complex nested JSON', () => {
      const complex = '{"a": {"b": {"c": [1, 2, 3]}}}'
      expect(InputValidator.isValidJSON(complex)).toBe(true)
    })

    it('should validate JSON with unicode', () => {
      const unicode = '{"message": "你好世界"}'
      expect(InputValidator.isValidJSON(unicode)).toBe(true)
    })
  })
})

describe('RateLimiter', () => {
  const testId = 'test-user-123'

  beforeEach(() => {
    RateLimiter.reset(testId)
  })

  describe('Basic Rate Limiting', () => {
    it('should allow requests under limit', () => {
      for (let i = 0; i < 10; i++) {
        expect(RateLimiter.isAllowed(testId)).toBe(true)
      }
    })

    it('should block requests over limit', () => {
      // 达到限制
      for (let i = 0; i < 60; i++) {
        RateLimiter.isAllowed(testId)
      }

      // 应该被阻止
      expect(RateLimiter.isAllowed(testId)).toBe(false)
    })

    it('should reset rate limit', () => {
      // 达到限制
      for (let i = 0; i < 60; i++) {
        RateLimiter.isAllowed(testId)
      }

      // 重置
      RateLimiter.reset(testId)

      // 应该允许
      expect(RateLimiter.isAllowed(testId)).toBe(true)
    })
  })

  describe('Remaining Requests', () => {
    it('should get remaining requests', () => {
      expect(RateLimiter.getRemaining(testId)).toBe(60)

      RateLimiter.isAllowed(testId)
      expect(RateLimiter.getRemaining(testId)).toBe(59)

      RateLimiter.isAllowed(testId)
      expect(RateLimiter.getRemaining(testId)).toBe(58)
    })

    it('should show 0 when limit reached', () => {
      for (let i = 0; i < 60; i++) {
        RateLimiter.isAllowed(testId)
      }

      expect(RateLimiter.getRemaining(testId)).toBe(0)
    })

    it('should update remaining after reset', () => {
      for (let i = 0; i < 30; i++) {
        RateLimiter.isAllowed(testId)
      }

      RateLimiter.reset(testId)
      expect(RateLimiter.getRemaining(testId)).toBe(60)
    })
  })

  describe('Multiple Identifiers', () => {
    it('should track different identifiers separately', () => {
      const id1 = 'user-1'
      const id2 = 'user-2'

      RateLimiter.isAllowed(id1)
      RateLimiter.isAllowed(id1)

      expect(RateLimiter.getRemaining(id1)).toBe(58)
      expect(RateLimiter.getRemaining(id2)).toBe(60)
    })

    it('should reset individual identifiers', () => {
      const id1 = 'user-1'
      const id2 = 'user-2'

      for (let i = 0; i < 60; i++) {
        RateLimiter.isAllowed(id1)
        RateLimiter.isAllowed(id2)
      }

      RateLimiter.reset(id1)

      expect(RateLimiter.isAllowed(id1)).toBe(true)
      expect(RateLimiter.isAllowed(id2)).toBe(false)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup expired records', () => {
      RateLimiter.isAllowed(testId)
      RateLimiter.cleanup()

      // 应该仍然有记录（因为刚创建）
      expect(RateLimiter.getRemaining(testId)).toBeLessThan(60)
    })
  })
})
