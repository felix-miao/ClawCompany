import { ChatManager } from '../manager'

describe('ChatManager taskId-based routing (Batch 1 Round 1)', () => {
  let cm: ChatManager

  beforeEach(() => {
    cm = new ChatManager('test-session')
  })

  describe('MessageRoute type and taskId in metadata', () => {
    it('addMessage stores taskId in metadata when provided', () => {
      const msg = cm.addMessage('pm', 'task update', 'task', { taskId: 'task_123' })
      expect(msg.metadata?.taskId).toBe('task_123')
    })

    it('sendTaskMessage stores taskId in metadata', () => {
      const msg = cm.sendTaskMessage('pm', 'task_abc', 'Task created')
      expect(msg.metadata?.taskId).toBe('task_abc')
    })

    it('messages without taskId have undefined taskId in metadata', () => {
      const msg = cm.addMessage('user', 'regular message')
      expect(msg.metadata?.taskId).toBeUndefined()
    })
  })

  describe('task-level inbox isolation', () => {
    beforeEach(() => {
      cm.addMessage('user', 'global message 1')
      cm.addMessage('pm', 'task update', 'task', { taskId: 'task_1' })
      cm.addMessage('dev', 'working on task 1', 'task', { taskId: 'task_1' })
      cm.addMessage('pm', 'task update', 'task', { taskId: 'task_2' })
      cm.addMessage('dev', 'working on task 2', 'task', { taskId: 'task_2' })
      cm.addMessage('user', 'global message 2')
    })

    it('getMessagesByTaskId returns only messages for that task', () => {
      const task1Messages = cm.getMessagesByTaskId('task_1')
      expect(task1Messages).toHaveLength(2)
      expect(task1Messages.map(m => m.content)).toEqual([
        'task update',
        'working on task 1'
      ])
    })

    it('getMessagesByTaskId returns empty for non-existent task', () => {
      const messages = cm.getMessagesByTaskId('nonexistent')
      expect(messages).toHaveLength(0)
    })

    it('getMessagesByTaskId returns messages for task_2', () => {
      const task2Messages = cm.getMessagesByTaskId('task_2')
      expect(task2Messages).toHaveLength(2)
    })

    it('getHistory returns all messages regardless of taskId', () => {
      const allMessages = cm.getHistory()
      expect(allMessages).toHaveLength(6)
    })

    it('getRecentMessages returns recent regardless of taskId', () => {
      const recent = cm.getRecentMessages(3)
      expect(recent).toHaveLength(3)
    })
  })

  describe('backward compatibility without taskId', () => {
    it('existing getHistory works without changes', () => {
      cm.addMessage('user', 'hello')
      cm.addMessage('pm', 'world')
      expect(cm.getHistory()).toHaveLength(2)
    })

    it('existing getMessagesByAgent works without changes', () => {
      cm.addMessage('user', 'user msg')
      cm.addMessage('pm', 'pm msg')
      cm.addMessage('pm', 'another pm msg')
      expect(cm.getMessagesByAgent('pm')).toHaveLength(2)
    })

    it('existing getMessage works without changes', () => {
      const msg = cm.addMessage('user', 'test')
      expect(cm.getMessage(msg.id)).toEqual(msg)
    })

    it('toJSON/fromJSON preserves taskId metadata', () => {
      cm.addMessage('dev', 'code', 'code', { taskId: 'task_x', codeLanguage: 'ts' })
      const json = cm.toJSON()
      const restored = ChatManager.fromJSON(json)
      const history = restored.getHistory()
      expect(history[0].metadata?.taskId).toBe('task_x')
    })
  })

  describe('clearHistory clears task-specific inboxes', () => {
    it('clearHistory removes all messages including task-specific ones', () => {
      cm.addMessage('pm', 'task msg', 'task', { taskId: 'task_1' })
      cm.addMessage('user', 'global msg')
      cm.clearHistory()
      expect(cm.getHistory()).toHaveLength(0)
      expect(cm.getMessagesByTaskId('task_1')).toHaveLength(0)
    })
  })

  describe('task-level inbox (getInbox)', () => {
    it('getInbox returns messages for specific taskId', () => {
      cm.addMessage('pm', 'task update', 'task', { taskId: 'task_1' })
      cm.addMessage('dev', 'code', 'code', { taskId: 'task_1', codeLanguage: 'typescript' })
      cm.addMessage('user', 'global msg')

      const inbox = cm.getInbox('task_1')
      expect(inbox.taskId).toBe('task_1')
      expect(inbox.messages).toHaveLength(2)
      expect(inbox.messages.map(m => m.agent)).toEqual(['pm', 'dev'])
    })

    it('getInbox returns empty inbox for non-existent taskId', () => {
      const inbox = cm.getInbox('nonexistent')
      expect(inbox.taskId).toBe('nonexistent')
      expect(inbox.messages).toHaveLength(0)
      expect(inbox.unreadCount).toBe(0)
    })

    it('getInbox calculates unreadCount as total messages', () => {
      cm.addMessage('pm', 'msg1', 'task', { taskId: 'task_x' })
      cm.addMessage('dev', 'msg2', 'task', { taskId: 'task_x' })
      
      const inbox = cm.getInbox('task_x')
      expect(inbox.unreadCount).toBe(2)
    })

    it('getInbox sets lastUpdated to timestamp of last message', () => {
      cm.addMessage('pm', 'first', 'task', { taskId: 'task_t' })
      cm.addMessage('dev', 'last', 'task', { taskId: 'task_t' })
      
      const inbox = cm.getInbox('task_t')
      expect(inbox.lastUpdated).toEqual(cm.getMessagesByTaskId('task_t')[1].timestamp)
    })

    it('getInbox returns current time when no messages', () => {
      const before = new Date()
      const inbox = cm.getInbox('empty_task')
      const after = new Date()
      
      expect(inbox.lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(inbox.lastUpdated.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  describe('getAllInboxes returns all task inboxes', () => {
    it('returns all unique taskIds as inboxes', () => {
      cm.addMessage('pm', 'task1', 'task', { taskId: 'task_a' })
      cm.addMessage('dev', 'task2', 'task', { taskId: 'task_a' })
      cm.addMessage('pm', 'task3', 'task', { taskId: 'task_b' })
      cm.addMessage('user', 'global') // no taskId

      const inboxes = cm.getAllInboxes()
      expect(inboxes).toHaveLength(2)
      const taskIds = inboxes.map(i => i.taskId).sort()
      expect(taskIds).toEqual(['task_a', 'task_b'])
    })

    it('returns empty array when no task-specific messages', () => {
      cm.addMessage('user', 'global msg')
      cm.addMessage('pm', 'another global')
      
      const inboxes = cm.getAllInboxes()
      expect(inboxes).toHaveLength(0)
    })
  })

  describe('global vs task-scoped responsibility boundary', () => {
    it('getHistory returns ALL messages (global chat)', () => {
      cm.addMessage('user', 'user request')
      cm.addMessage('pm', 'analysis', 'task', { taskId: 'task_1' })
      cm.addMessage('dev', 'code', 'task', { taskId: 'task_1' })
      cm.addMessage('review', 'approved', 'task', { taskId: 'task_1' })

      const all = cm.getHistory()
      expect(all).toHaveLength(4)
      expect(all[0].content).toBe('user request')
    })

    it('getMessagesByTaskId isolates task-specific messages only', () => {
      cm.addMessage('user', 'user request')
      cm.addMessage('pm', 'analysis', 'task', { taskId: 'task_1' })
      cm.addMessage('dev', 'code', 'task', { taskId: 'task_1' })
      cm.addMessage('pm', 'task_2 analysis', 'task', { taskId: 'task_2' })

      const task1 = cm.getMessagesByTaskId('task_1')
      expect(task1).toHaveLength(2)
      expect(task1.map(m => m.content)).toEqual(['analysis', 'code'])
      
      const task2 = cm.getMessagesByTaskId('task_2')
      expect(task2).toHaveLength(1)
      expect(task2[0].content).toBe('task_2 analysis')
    })

    it('getRecentMessages mixes global and task messages by time', () => {
      cm.addMessage('user', '1')
      cm.addMessage('pm', '2', 'task', { taskId: 't1' })
      cm.addMessage('user', '3')
      cm.addMessage('dev', '4', 'task', { taskId: 't1' })
      
      const recent = cm.getRecentMessages(3)
      expect(recent.map(m => m.content)).toEqual(['2', '3', '4'])
    })

    it('messages without taskId are not included in any inbox', () => {
      cm.addMessage('user', 'global only')
      cm.addMessage('pm', 'task msg', 'task', { taskId: 'task_x' })
      
      const inboxes = cm.getAllInboxes()
      expect(inboxes).toHaveLength(1)
      expect(inboxes[0].messages).toHaveLength(1)
      
      const globalMsgs = cm.getMessagesByTaskId('task_x')
      expect(globalMsgs.find(m => m.content === 'global only')).toBeUndefined()
    })
  })

  describe('MessageRoute type usage', () => {
    it('route field is not auto-populated by addMessage', () => {
      const msg = cm.addMessage('pm', 'task update', 'task', { taskId: 'task_1' })
      expect(msg.route).toBeUndefined()
    })

    it('route can be manually set via metadata', () => {
      const msg = cm.addMessage('pm', 'task update', 'task', { 
        taskId: 'task_1',
        route: 'task:task_1' as any
      })
      expect(msg.metadata?.route).toBe('task:task_1')
    })
  })
})