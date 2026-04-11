import { ChatManager } from './manager'
import { Message } from '../core/types'
import { AgentRole } from '../core/types'

describe('ChatManager Performance Optimization', () => {
  let chatManager: ChatManager

  beforeEach(() => {
    chatManager = new ChatManager('test-session')
  })

  describe('getCurrent behavior (RED phase)', () => {
    it('should return undefined for non-existent message', () => {
      const result = chatManager.getMessage('non-existent-id')
      expect(result).toBeUndefined()
    })

    it('should return message by ID for single message', () => {
      const message = chatManager.addMessage('user', 'Hello World')
      const found = chatManager.getMessage(message.id)
      expect(found).toEqual(message)
    })

    it('should return correct message from multiple messages', () => {
      const msg1 = chatManager.addMessage('user', 'Message 1')
      const msg2 = chatManager.addMessage('dev', 'Message 2')
      const msg3 = chatManager.addMessage('user', 'Message 3')

      const found = chatManager.getMessage(msg2.id)
      expect(found).toEqual(msg2)
      expect(found).not.toEqual(msg1)
      expect(found).not.toEqual(msg3)
    })

    it('should handle duplicate IDs gracefully (though generateId should prevent this)', () => {
      const msg1 = chatManager.addMessage('user', 'First message')
      const msg2 = chatManager.addMessage('dev', 'Second message')
      
      const found1 = chatManager.getMessage(msg1.id)
      const found2 = chatManager.getMessage(msg2.id)
      
      expect(found1).toEqual(msg1)
      expect(found2).toEqual(msg2)
      expect(found1).not.toEqual(found2)
    })
  })

  describe('Performance characteristics', () => {
    it('should handle many messages efficiently', () => {
      const uncappedForBenchmark = new ChatManager('test-session', 1000)
      const messages: Message[] = []
      for (let i = 0; i < 1000; i++) {
        messages.push(uncappedForBenchmark.addMessage('user', `Message ${i}`))
      }

      const startTime = performance.now()
      messages.forEach(msg => {
        const found = uncappedForBenchmark.getMessage(msg.id)
        expect(found).toEqual(msg)
      })
      const endTime = performance.now()

      const lookupTime = endTime - startTime
      console.log(`1000 message lookups took ${lookupTime}ms`)
      
      expect(lookupTime).toBeLessThan(100)
    })

    it('should get recent messages without performance degradation', () => {
      const uncappedForBenchmark = new ChatManager('test-session', 5000)
      for (let i = 0; i < 5000; i++) {
        uncappedForBenchmark.addMessage('user', `Message ${i}`)
      }

      const startTime = performance.now()
      const recent = uncappedForBenchmark.getRecentMessages(100)
      const endTime = performance.now()

      const recentTime = endTime - startTime
      console.log(`Getting 100 recent messages took ${recentTime}ms`)
      expect(recentTime).toBeLessThan(50)
      expect(recent.length).toBe(100)
    })
  })

  describe('Backwards compatibility', () => {
    it('should maintain all existing API methods', () => {
      expect(chatManager.addMessage).toBeDefined()
      expect(chatManager.getHistory).toBeDefined()
      expect(chatManager.getRecentMessages).toBeDefined()
      expect(chatManager.getMessagesByAgent).toBeDefined()
      expect(chatManager.clearHistory).toBeDefined()
      expect(chatManager.broadcast).toBeDefined()
      expect(chatManager.sendUserMessage).toBeDefined()
      expect(chatManager.sendCodeMessage).toBeDefined()
      expect(chatManager.sendFileMessage).toBeDefined()
      expect(chatManager.sendTaskMessage).toBeDefined()
      expect(chatManager.toJSON).toBeDefined()
      expect(ChatManager.fromJSON).toBeDefined()
    })

    it('should maintain existing behavior for all methods', () => {
      const msg = chatManager.addMessage('user', 'Test message')
      const history = chatManager.getHistory()
      expect(history).toContain(msg)
      expect(history.length).toBe(1)

      const recent = chatManager.getRecentMessages(10)
      expect(recent).toContain(msg)
      expect(recent.length).toBe(1)

      const byAgent = chatManager.getMessagesByAgent('user')
      expect(byAgent).toContain(msg)
      expect(byAgent.length).toBe(1)
    })
  })
})
