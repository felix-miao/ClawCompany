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
})
