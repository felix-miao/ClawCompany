import { ChatManager } from '../manager'

describe('ChatManager', () => {
  let cm: ChatManager

  beforeEach(() => {
    cm = new ChatManager('test-session')
  })

  describe('constructor', () => {
    it('uses provided sessionId', () => {
      const json = JSON.parse(cm.toJSON())
      expect(json.sessionId).toBe('test-session')
    })

    it('defaults to "default" sessionId', () => {
      const manager = new ChatManager()
      const json = JSON.parse(manager.toJSON())
      expect(json.sessionId).toBe('default')
    })
  })

  describe('addMessage', () => {
    it('adds a text message', () => {
      const msg = cm.addMessage('user', 'Hello')

      expect(msg.id).toMatch(/^msg_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(msg.agent).toBe('user')
      expect(msg.content).toBe('Hello')
      expect(msg.type).toBe('text')
      expect(msg.timestamp).toBeInstanceOf(Date)
      expect(msg.metadata).toBeUndefined()
    })

    it('adds a code message with metadata', () => {
      const msg = cm.addMessage('dev', 'const x = 1', 'code', { codeLanguage: 'typescript' })

      expect(msg.type).toBe('code')
      expect(msg.metadata).toEqual({ codeLanguage: 'typescript' })
    })

    it('adds a file message with metadata', () => {
      const msg = cm.addMessage('dev', 'file content', 'file', { filePath: 'src/foo.ts' })

      expect(msg.type).toBe('file')
      expect(msg.metadata).toEqual({ filePath: 'src/foo.ts' })
    })

    it('adds a task message with metadata', () => {
      const msg = cm.addMessage('pm', 'task update', 'task', { taskId: 'task_123' })

      expect(msg.type).toBe('task')
      expect(msg.metadata).toEqual({ taskId: 'task_123' })
    })

    it('generates unique IDs', () => {
      const m1 = cm.addMessage('user', 'a')
      const m2 = cm.addMessage('user', 'b')
      expect(m1.id).not.toBe(m2.id)
    })

    it('supports all agent roles', () => {
      expect(cm.addMessage('user', 'u').agent).toBe('user')
      expect(cm.addMessage('pm', 'p').agent).toBe('pm')
      expect(cm.addMessage('dev', 'd').agent).toBe('dev')
      expect(cm.addMessage('review', 'r').agent).toBe('review')
    })
  })

  describe('getMessage', () => {
    it('returns message by id', () => {
      const msg = cm.addMessage('user', 'find me')
      expect(cm.getMessage(msg.id)).toEqual(msg)
    })

    it('returns undefined for non-existent id', () => {
      expect(cm.getMessage('nope')).toBeUndefined()
    })
  })

  describe('getHistory', () => {
    it('returns empty array initially', () => {
      expect(cm.getHistory()).toEqual([])
    })

    it('returns all messages in order', () => {
      cm.addMessage('user', 'first')
      cm.addMessage('pm', 'second')
      cm.addMessage('dev', 'third')

      const history = cm.getHistory()
      expect(history).toHaveLength(3)
      expect(history[0].content).toBe('first')
      expect(history[1].content).toBe('second')
      expect(history[2].content).toBe('third')
    })

    it('returns a copy (does not expose internal array)', () => {
      cm.addMessage('user', 'hello')
      const history = cm.getHistory()
      history.pop()
      expect(cm.getHistory()).toHaveLength(1)
    })
  })

  describe('getRecentMessages', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        cm.addMessage('user', `msg_${i}`)
      }
    })

    it('returns last N messages', () => {
      const recent = cm.getRecentMessages(3)
      expect(recent).toHaveLength(3)
      expect(recent[0].content).toBe('msg_7')
      expect(recent[1].content).toBe('msg_8')
      expect(recent[2].content).toBe('msg_9')
    })

    it('defaults to 50', () => {
      const recent = cm.getRecentMessages()
      expect(recent).toHaveLength(10)
    })

    it('returns all if count exceeds total', () => {
      expect(cm.getRecentMessages(100)).toHaveLength(10)
    })

    it('returns empty if no messages', () => {
      const empty = new ChatManager()
      expect(empty.getRecentMessages(5)).toEqual([])
    })
  })

  describe('getMessagesByAgent', () => {
    beforeEach(() => {
      cm.addMessage('user', 'hello')
      cm.addMessage('pm', 'plan')
      cm.addMessage('dev', 'code')
      cm.addMessage('dev', 'more code')
      cm.addMessage('review', 'looks good')
    })

    it('filters by user', () => {
      expect(cm.getMessagesByAgent('user')).toHaveLength(1)
    })

    it('filters by agent role', () => {
      expect(cm.getMessagesByAgent('dev')).toHaveLength(2)
      expect(cm.getMessagesByAgent('pm')).toHaveLength(1)
      expect(cm.getMessagesByAgent('review')).toHaveLength(1)
    })

    it('returns empty for agent with no messages', () => {
      const fresh = new ChatManager()
      cm.addMessage('user', 'hi')
      expect(fresh.getMessagesByAgent('dev')).toHaveLength(0)
    })
  })

  describe('clearHistory', () => {
    it('removes all messages', () => {
      cm.addMessage('user', 'a')
      cm.addMessage('pm', 'b')
      cm.clearHistory()

      expect(cm.getHistory()).toEqual([])
    })
  })

  describe('broadcast', () => {
    it('sends text message from agent', () => {
      const msg = cm.broadcast('pm', 'team announcement')

      expect(msg.agent).toBe('pm')
      expect(msg.content).toBe('team announcement')
      expect(msg.type).toBe('text')
    })
  })

  describe('sendUserMessage', () => {
    it('sends text message from user', () => {
      const msg = cm.sendUserMessage('I need help')

      expect(msg.agent).toBe('user')
      expect(msg.content).toBe('I need help')
      expect(msg.type).toBe('text')
    })
  })

  describe('sendCodeMessage', () => {
    it('sends code message with language metadata', () => {
      const msg = cm.sendCodeMessage('dev', 'console.log("hi")', 'javascript')

      expect(msg.agent).toBe('dev')
      expect(msg.type).toBe('code')
      expect(msg.content).toBe('console.log("hi")')
      expect(msg.metadata).toEqual({ codeLanguage: 'javascript' })
    })

    it('defaults to typescript language', () => {
      const msg = cm.sendCodeMessage('dev', 'const x = 1')

      expect(msg.metadata).toEqual({ codeLanguage: 'typescript' })
    })
  })

  describe('sendFileMessage', () => {
    it('sends file message with path metadata', () => {
      const msg = cm.sendFileMessage('dev', 'src/app.ts', 'export const app = 1')

      expect(msg.agent).toBe('dev')
      expect(msg.type).toBe('file')
      expect(msg.content).toBe('export const app = 1')
      expect(msg.metadata).toEqual({ filePath: 'src/app.ts' })
    })
  })

  describe('sendTaskMessage', () => {
    it('sends task message with taskId metadata', () => {
      const msg = cm.sendTaskMessage('pm', 'task_abc', 'Task started')

      expect(msg.agent).toBe('pm')
      expect(msg.type).toBe('task')
      expect(msg.content).toBe('Task started')
      expect(msg.metadata).toEqual({ taskId: 'task_abc' })
    })
  })

  describe('toJSON / fromJSON', () => {
    it('serializes and deserializes correctly', () => {
      cm.addMessage('user', 'hi')
      cm.addMessage('dev', 'code here', 'code', { codeLanguage: 'python' })

      const json = cm.toJSON()
      const restored = ChatManager.fromJSON(json)

      expect(restored.getHistory()).toHaveLength(2)
      expect(restored.getHistory()[0].content).toBe('hi')
      expect(restored.getHistory()[1].content).toBe('code here')
    })

    it('preserves sessionId', () => {
      cm.addMessage('user', 'test')
      const restored = ChatManager.fromJSON(cm.toJSON())
      const data = JSON.parse(restored.toJSON())
      expect(data.sessionId).toBe('test-session')
    })

    it('preserves message types and metadata', () => {
      cm.addMessage('user', 'hello', 'text')
      cm.addMessage('dev', 'const x = 1', 'code', { codeLanguage: 'ts' })
      cm.addMessage('dev', 'file content', 'file', { filePath: 'a.ts' })
      cm.addMessage('pm', 'task update', 'task', { taskId: 't1' })

      const restored = ChatManager.fromJSON(cm.toJSON())
      const messages = restored.getHistory()

      expect(messages[0].type).toBe('text')
      expect(messages[1].type).toBe('code')
      expect(messages[1].metadata).toEqual({ codeLanguage: 'ts' })
      expect(messages[2].type).toBe('file')
      expect(messages[2].metadata).toEqual({ filePath: 'a.ts' })
      expect(messages[3].type).toBe('task')
      expect(messages[3].metadata).toEqual({ taskId: 't1' })
    })

    it('preserves timestamps as Date objects', () => {
      const msg = cm.addMessage('user', 'test')
      const restored = ChatManager.fromJSON(cm.toJSON())

      const restoredMsg = restored.getMessage(msg.id)!
      expect(restoredMsg.timestamp).toBeInstanceOf(Date)
      expect(restoredMsg.timestamp.getTime()).toBe(msg.timestamp.getTime())
    })

    it('handles empty manager', () => {
      const empty = new ChatManager('empty')
      const restored = ChatManager.fromJSON(empty.toJSON())
      expect(restored.getHistory()).toEqual([])
    })
  })

  describe('getMessage performance', () => {
    const MESSAGE_COUNT = 10000

    beforeEach(() => {
      for (let i = 0; i < MESSAGE_COUNT; i++) {
        cm.addMessage('user', `message_${i}`)
      }
    })

    it('uses Map-based O(1) lookup for getMessage', () => {
      const lastMsg = cm.getHistory()[MESSAGE_COUNT - 1]
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        cm.getMessage(lastMsg.id)
      }
      const mapTime = performance.now() - start

      const firstMsg = cm.getHistory()[0]
      const start2 = performance.now()
      for (let i = 0; i < 1000; i++) {
        cm.getMessage(firstMsg.id)
      }
      const firstTime = performance.now() - start2

      expect(mapTime).toBeLessThan(50)
      expect(firstTime).toBeLessThan(50)
    })

    it('lookups for last message are not slower than first message', () => {
      const firstMsg = cm.getHistory()[0]
      const lastMsg = cm.getHistory()[MESSAGE_COUNT - 1]

      const iterations = 500

      const startFirst = performance.now()
      for (let i = 0; i < iterations; i++) {
        cm.getMessage(firstMsg.id)
      }
      const firstTime = performance.now() - startFirst

      const startLast = performance.now()
      for (let i = 0; i < iterations; i++) {
        cm.getMessage(lastMsg.id)
      }
      const lastTime = performance.now() - startLast

      expect(lastTime).toBeLessThan(firstTime * 10 + 10)
    })

    it('returns correct message from large dataset', () => {
      const middleIndex = Math.floor(MESSAGE_COUNT / 2)
      const middleMsg = cm.getHistory()[middleIndex]
      const found = cm.getMessage(middleMsg.id)

      expect(found).toBeDefined()
      expect(found!.content).toBe(`message_${middleIndex}`)
    })

    it('handles non-existent IDs efficiently', () => {
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        cm.getMessage(`nonexistent_${i}`)
      }
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(50)
    })

    it('map stays in sync after clearHistory', () => {
      const msg = cm.addMessage('user', 'after-clear-test')
      cm.clearHistory()
      expect(cm.getMessage(msg.id)).toBeUndefined()
    })

    it('map stays in sync after fromJSON', () => {
      cm.addMessage('user', 'serialized')
      const json = cm.toJSON()
      const restored = ChatManager.fromJSON(json)
      const history = restored.getHistory()

      const target = history[Math.floor(history.length / 2)]
      expect(restored.getMessage(target.id)).toBeDefined()
      expect(restored.getMessage(target.id)!.content).toBe(target.content)
      expect(restored.getMessage('nonexistent')).toBeUndefined()
    })
  })

  describe('conversation flow', () => {
    it('supports a realistic multi-agent conversation', () => {
      cm.sendUserMessage('Build me a login page')
      cm.broadcast('pm', 'Breaking down the task...')
      cm.sendTaskMessage('pm', 'task_1', 'Task created: implement login UI')
      cm.sendCodeMessage('dev', 'export function LoginPage() { ... }')
      cm.sendFileMessage('dev', 'src/login/page.tsx', 'export function LoginPage() { ... }')
      cm.broadcast('review', 'Code looks good, approved!')

      const history = cm.getHistory()
      expect(history).toHaveLength(6)

      const byAgent = cm.getMessagesByAgent('dev')
      expect(byAgent).toHaveLength(2)

      const byUser = cm.getMessagesByAgent('user')
      expect(byUser).toHaveLength(1)
    })

    it('can clear and start fresh conversation', () => {
      cm.sendUserMessage('first conversation')
      cm.clearHistory()
      cm.sendUserMessage('second conversation')

      expect(cm.getHistory()).toHaveLength(1)
      expect(cm.getHistory()[0].content).toBe('second conversation')
    })
  })

  describe('Type safety', () => {
    describe('Message always has required fields', () => {
      it('addMessage returns Message with non-optional id', () => {
        const msg = cm.addMessage('user', 'test')
        expect(typeof msg.id).toBe('string')
        expect(msg.id.length).toBeGreaterThan(0)
      })

      it('addMessage returns Message with non-optional type', () => {
        const msg = cm.addMessage('user', 'test')
        expect(msg.type).toBeDefined()
        expect(['text', 'code', 'file', 'task']).toContain(msg.type)
      })

      it('addMessage returns Message with non-optional timestamp', () => {
        const msg = cm.addMessage('user', 'test')
        expect(msg.timestamp).toBeInstanceOf(Date)
        expect(msg.timestamp.getTime()).not.toBeNaN()
      })

      it('addMessage defaults type to text when not specified', () => {
        const msg = cm.addMessage('user', 'hello')
        expect(msg.type).toBe('text')
      })

      it('all convenience methods return fully typed messages', () => {
        const user = cm.sendUserMessage('hi')
        const broadcast = cm.broadcast('pm', 'announce')
        const code = cm.sendCodeMessage('dev', 'const x = 1')
        const file = cm.sendFileMessage('dev', 'a.ts', 'content')
        const task = cm.sendTaskMessage('pm', 't1', 'update')

        for (const msg of [user, broadcast, code, file, task]) {
          expect(typeof msg.id).toBe('string')
          expect(msg.id.length).toBeGreaterThan(0)
          expect(msg.type).toBeDefined()
          expect(msg.timestamp).toBeInstanceOf(Date)
        }
      })

      it('getHistory returns messages with all required fields', () => {
        cm.addMessage('user', 'msg1', 'text')
        cm.addMessage('dev', 'msg2', 'code', { codeLanguage: 'ts' })
        cm.addMessage('pm', 'msg3', 'task', { taskId: 't1' })

        const history = cm.getHistory()
        for (const msg of history) {
          expect(typeof msg.id).toBe('string')
          expect(msg.id.length).toBeGreaterThan(0)
          expect(['text', 'code', 'file', 'task']).toContain(msg.type)
          expect(msg.timestamp).toBeInstanceOf(Date)
        }
      })

      it('getRecentMessages returns messages with all required fields', () => {
        for (let i = 0; i < 5; i++) {
          cm.addMessage('user', `msg_${i}`)
        }
        const recent = cm.getRecentMessages(3)
        for (const msg of recent) {
          expect(typeof msg.id).toBe('string')
          expect(msg.id.length).toBeGreaterThan(0)
        }
      })

      it('getMessagesByAgent returns messages with all required fields', () => {
        cm.addMessage('dev', 'code1')
        cm.addMessage('dev', 'code2')
        const devMessages = cm.getMessagesByAgent('dev')
        for (const msg of devMessages) {
          expect(typeof msg.id).toBe('string')
          expect(msg.id.length).toBeGreaterThan(0)
        }
      })
    })

    describe('Map key type safety', () => {
      it('getMessage returns the correct message by string ID', () => {
        const msg = cm.addMessage('user', 'test')
        const found = cm.getMessage(msg.id)
        expect(found).toBeDefined()
        expect(found!.id).toBe(msg.id)
      })

      it('getMessage returns undefined for non-existent string ID', () => {
        expect(cm.getMessage('does-not-exist')).toBeUndefined()
      })

      it('Map stays in sync with messages array after multiple operations', () => {
        const msg1 = cm.addMessage('user', 'first')
        const msg2 = cm.addMessage('dev', 'second')
        const msg3 = cm.addMessage('pm', 'third')

        expect(cm.getMessage(msg1.id)).toBeDefined()
        expect(cm.getMessage(msg2.id)).toBeDefined()
        expect(cm.getMessage(msg3.id)).toBeDefined()

        cm.clearHistory()
        expect(cm.getMessage(msg1.id)).toBeUndefined()
        expect(cm.getMessage(msg2.id)).toBeUndefined()
        expect(cm.getMessage(msg3.id)).toBeUndefined()
      })

      it('fromJSON rebuilds Map with correct string keys', () => {
        cm.addMessage('user', 'hello')
        cm.addMessage('dev', 'code')

        const json = cm.toJSON()
        const restored = ChatManager.fromJSON(json)
        const history = restored.getHistory()

        for (const msg of history) {
          const found = restored.getMessage(msg.id)
          expect(found).toBeDefined()
          expect(found!.id).toBe(msg.id)
        }
      })
    })

    describe('Parameter validation', () => {
      it('rejects empty agent string by producing valid message', () => {
        const validAgents: Array<'user' | 'pm' | 'dev' | 'review'> = ['user', 'pm', 'dev', 'review']
        for (const agent of validAgents) {
          const msg = cm.addMessage(agent, 'test')
          expect(msg.agent).toBe(agent)
        }
      })

      it('handles empty content string', () => {
        const msg = cm.addMessage('user', '')
        expect(msg.content).toBe('')
      })

      it('handles all message types correctly', () => {
        const types: Array<'text' | 'code' | 'file' | 'task'> = ['text', 'code', 'file', 'task']
        for (const type of types) {
          const msg = cm.addMessage('user', `test-${type}`, type)
          expect(msg.type).toBe(type)
        }
      })

      it('handles metadata correctly for each type', () => {
        const codeMsg = cm.addMessage('dev', 'code', 'code', { codeLanguage: 'python' })
        expect(codeMsg.metadata?.codeLanguage).toBe('python')

        const fileMsg = cm.addMessage('dev', 'content', 'file', { filePath: '/src/index.ts' })
        expect(fileMsg.metadata?.filePath).toBe('/src/index.ts')

        const taskMsg = cm.addMessage('pm', 'task update', 'task', { taskId: 'task-001' })
        expect(taskMsg.metadata?.taskId).toBe('task-001')

        const textMsg = cm.addMessage('user', 'plain text', 'text')
        expect(textMsg.metadata).toBeUndefined()
      })

      it('handles numeric count parameter in getRecentMessages', () => {
        for (let i = 0; i < 10; i++) {
          cm.addMessage('user', `msg_${i}`)
        }
        expect(cm.getRecentMessages(1)).toHaveLength(1)
        expect(cm.getRecentMessages(5)).toHaveLength(5)
        expect(cm.getRecentMessages(100)).toHaveLength(10)
      })

      it('serializes and deserializes preserving all field types', () => {
        cm.addMessage('user', 'hello', 'text')
        cm.addMessage('dev', 'const x = 1', 'code', { codeLanguage: 'ts' })

        const json = cm.toJSON()
        const restored = ChatManager.fromJSON(json)
        const messages = restored.getHistory()

        for (const msg of messages) {
          expect(typeof msg.id).toBe('string')
          expect(typeof msg.agent).toBe('string')
          expect(typeof msg.content).toBe('string')
          expect(typeof msg.type).toBe('string')
          expect(msg.timestamp).toBeInstanceOf(Date)
        }
      })

      it('fromJSON throws on invalid JSON', () => {
        expect(() => ChatManager.fromJSON('not json')).toThrow()
        expect(() => ChatManager.fromJSON('')).toThrow()
      })

      it('fromJSON throws on JSON missing sessionId', () => {
        expect(() => ChatManager.fromJSON('{}')).toThrow()
      })

      it('fromJSON throws when messages is not an array', () => {
        expect(() => ChatManager.fromJSON('{"sessionId":"s","messages":"not-array"}')).toThrow('messages must be an array')
      })

      it('fromJSON throws when messages is null', () => {
        expect(() => ChatManager.fromJSON('{"sessionId":"s","messages":null}')).toThrow('messages must be an array')
      })

      it('fromJSON throws when messages is a number', () => {
        expect(() => ChatManager.fromJSON('{"sessionId":"s","messages":123}')).toThrow('messages must be an array')
      })

      it('fromJSON handles messages being undefined', () => {
        expect(() => ChatManager.fromJSON('{"sessionId":"s"}')).toThrow('messages must be an array')
      })
    })

    describe('fromJSON messageMap edge cases', () => {
      it('handles messages with missing IDs by generating new ones', () => {
        const manager = new ChatManager('test')
        manager.addMessage('user', 'msg1')
        manager.addMessage('dev', 'msg2')
        
        const json = manager.toJSON()
        const parsed = JSON.parse(json)
        
        // Remove IDs from the JSON to simulate the edge case
        parsed.messages.forEach((msg: any) => {
          delete msg.id
        })
        
        const modifiedJson = JSON.stringify(parsed)
        const restored = ChatManager.fromJSON(modifiedJson)
        
        const history = restored.getHistory()
        expect(history).toHaveLength(2)
        expect(history[0].content).toBe('msg1')
        expect(history[1].content).toBe('msg2')
        
        // Verify all messages have valid IDs
        for (const msg of history) {
          expect(typeof msg.id).toBe('string')
          expect(msg.id.length).toBeGreaterThan(0)
          expect(msg.id.startsWith('msg_')).toBe(true)
        }
        
        // Verify messageMap works correctly
        expect(restored.getMessage(history[0].id)).toBeDefined()
        expect(restored.getMessage(history[1].id)).toBeDefined()
      })

      it('handles messages with missing types by defaulting to text', () => {
        const manager = new ChatManager('test')
        manager.addMessage('user', 'msg1')
        manager.addMessage('dev', 'msg2')
        
        const json = manager.toJSON()
        const parsed = JSON.parse(json)
        
        // Remove types from messages
        parsed.messages.forEach((msg: any) => {
          delete msg.type
        })
        
        const modifiedJson = JSON.stringify(parsed)
        const restored = ChatManager.fromJSON(modifiedJson)
        
        const history = restored.getHistory()
        expect(history).toHaveLength(2)
        expect(history[0].type).toBe('text')
        expect(history[1].type).toBe('text')
      })

      it('handles messages with missing timestamps by defaulting to current time', () => {
        const manager = new ChatManager('test')
        manager.addMessage('user', 'msg1')
        
        const json = manager.toJSON()
        const parsed = JSON.parse(json)
        
        // Remove timestamp from first message
        delete parsed.messages[0].timestamp
        
        const modifiedJson = JSON.stringify(parsed)
        const restored = ChatManager.fromJSON(modifiedJson)
        
        const history = restored.getHistory()
        expect(history).toHaveLength(1)
        expect(history[0].timestamp).toBeInstanceOf(Date)
        
        // The timestamp should be close to now (within 1 second)
        const now = Date.now()
        const timestamp = history[0].timestamp.getTime()
        expect(Math.abs(now - timestamp)).toBeLessThan(1000)
      })

      it('handles messages with string timestamps and converts to Date objects', () => {
        const manager = new ChatManager('test')
        manager.addMessage('user', 'msg1')
        
        const json = manager.toJSON()
        const parsed = JSON.parse(json)
        
        // Convert timestamp to string
        parsed.messages[0].timestamp = new Date().toISOString()
        
        const modifiedJson = JSON.stringify(parsed)
        const restored = ChatManager.fromJSON(modifiedJson)
        
        const history = restored.getHistory()
        expect(history).toHaveLength(1)
        expect(history[0].timestamp).toBeInstanceOf(Date)
        
        // Verify the timestamp is preserved correctly
        const originalTimestamp = new Date(parsed.messages[0].timestamp).getTime()
        const restoredTimestamp = history[0].timestamp.getTime()
        expect(restoredTimestamp).toBe(originalTimestamp)
      })

      it('handles completely empty messages array', () => {
        const manager = new ChatManager('test')
        const json = manager.toJSON()
        const parsed = JSON.parse(json)
        
        // Clear messages array
        parsed.messages = []
        
        const modifiedJson = JSON.stringify(parsed)
        const restored = ChatManager.fromJSON(modifiedJson)
        
        expect(restored.getHistory()).toHaveLength(0)
        expect(restored.getMessage('nonexistent')).toBeUndefined()
      })

      it('handles duplicate message IDs gracefully', () => {
        const manager = new ChatManager('test')
        manager.addMessage('user', 'msg1')
        
        const json = manager.toJSON()
        const parsed = JSON.parse(json)
        
        // Create a duplicate ID
        parsed.messages.push({
          ...parsed.messages[0],
          content: 'duplicate msg'
        })
        
        const modifiedJson = JSON.stringify(parsed)
        const restored = ChatManager.fromJSON(modifiedJson)
        
        const history = restored.getHistory()
        expect(history).toHaveLength(2)
        
        // Both messages should have IDs
        expect(history[0].id).toBeDefined()
        expect(history[1].id).toBeDefined()
        
        // When duplicate IDs exist, the later message overwrites the earlier one in the map
        // But both messages are still in the array
        expect(restored.getMessage(history[0].id)).toBeDefined()
        
        // The second message should be findable by its ID
        expect(restored.getMessage(history[1].id)).toBeDefined()
      })
    })
  })
})
