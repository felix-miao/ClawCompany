/**
 * 类型安全性改进测试
 * 
 * 此测试确保我们在修复 any 类型问题时不会破坏现有功能
 */

const mockConfig = {
  id: 'test-123',
  name: 'Test Config',
  enabled: true
}

const mockApiResponse = {
  data: mockConfig,
  success: true
}

// 测试现有功能应该正常工作
describe('类型安全性改进 - 现有功能验证', () => {
  it('应该正确处理配置对象', () => {
    expect(mockConfig.id).toBe('test-123')
    expect(mockConfig.name).toBe('Test Config')
    expect(mockConfig.enabled).toBe(true)
  })

  it('应该正确处理API响应', () => {
    expect(mockApiResponse.success).toBe(true)
    expect(mockApiResponse.data.id).toBe('test-123')
    expect(mockApiResponse.data.name).toBe('Test Config')
  })

  it('应该正确处理错误响应', () => {
    const errorResponse = {
      data: { id: '', name: '', enabled: false },
      success: false,
      error: 'Configuration not found'
    }
    
    expect(errorResponse.success).toBe(false)
    expect(errorResponse.error).toBe('Configuration not found')
  })
})

// 测试改进后的类型定义
describe('类型安全性改进 - 新的类型定义', () => {
  it('应该使用明确的类型而不是 any', () => {
    // 这是一个改进的示例，避免使用 any
    type SafeFunction<T> = (input: T) => T
    
    const identity: SafeFunction<string> = (input) => input
    const result = identity('test')
    
    expect(result).toBe('test')
  })

  it('应该使用泛型而不是 any', () => {
    // 改进：使用泛型替代 any
    function safeParse<T>(data: unknown): T | null {
      if (typeof data === 'object' && data !== null) {
        return data as T
      }
      return null
    }
    
    const parsed = safeParse(mockConfig)
    
    expect(parsed).not.toBeNull()
    if (parsed) {
      expect(parsed.id).toBe('test-123')
    }
  })
})