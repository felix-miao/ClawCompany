/**
 * 测试 API 客户端的类型安全性
 * 验证移除 any 类型后的代码正确性
 */

import { 
  sendMessage, 
  getChatHistory, 
  ChatResponse, 
  ChatHistoryResponse 
} from '@/lib/api/client'

describe('API Client Type Safety', () => {
  // 测试消息发送的类型安全
  it('should send message with proper typing', async () => {
    const testMessage: string = 'Hello, AI team!'
    const response: ChatResponse = await sendMessage(testMessage)
    
    // 验证响应类型
    expect(response).toHaveProperty('success')
    expect(response).toHaveProperty('error', expect.any(String) || undefined)
    
    if (response.success) {
      expect(response).toHaveProperty('tasks', expect.any(Array))
      expect(response).toHaveProperty('chatHistory', expect.any(Array))
    }
  })

  // 测试历史记录获取的类型安全
  it('should get chat history with proper typing', async () => {
    const history: ChatHistoryResponse = await getChatHistory()
    
    // 验证历史记录响应类型
    expect(history).toHaveProperty('tasks', expect.any(Array))
    expect(history).toHaveProperty('chatHistory', expect.any(Array))
    expect(history).toHaveProperty('agents', expect.any(Array))
  })

  // 测试空消息处理
  it('should handle empty message gracefully', async () => {
    const emptyMessage = ''
    const response: ChatResponse = await sendMessage(emptyMessage)
    
    // 验证空消息处理
    expect(response.success).toBe(false)
    expect(response.error).toBeDefined()
  })

  // 测试超长消息处理
  it('should handle long message appropriately', async () => {
    const longMessage = 'a'.repeat(10001) // 超过10000字符
    const response: ChatResponse = await sendMessage(longMessage)
    
    // 验证超长消息处理
    expect(response.success).toBe(false)
    expect(response.error).toBeDefined()
  })
})