import * as fs from 'fs/promises'
import * as path from 'path'

import { StorageManager, Conversation, AgentConfig } from '../manager'

import type { PersistedAgentConfig } from '@/types/agent-config'

describe('StorageManager', () => {
  let storageManager: StorageManager
  const testDir = '/tmp/clawcompany-storage-test'

  beforeEach(async () => {
    storageManager = new StorageManager(testDir)
    await storageManager.initialize()
  })

  afterEach(async () => {
    // 清理测试数据
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略清理错误
    }
  })

  describe('Conversation Management', () => {
    it('should save and load a conversation', async () => {
      const conv: Conversation = {
        id: 'test-conv-1',
        title: 'Test Conversation',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await storageManager.saveConversation(conv)
      const loaded = await storageManager.loadConversation('test-conv-1')

      expect(loaded).not.toBeNull()
      expect(loaded?.title).toBe('Test Conversation')
      expect(loaded?.id).toBe('test-conv-1')
    })

    it('should list all conversations', async () => {
      const conv1 = storageManager.createConversation('Conv 1')
      const conv2 = storageManager.createConversation('Conv 2')

      await storageManager.saveConversation(conv1)
      await storageManager.saveConversation(conv2)

      const conversations = await storageManager.listConversations()

      expect(conversations).toHaveLength(2)
      expect(conversations.map(c => c.title)).toContain('Conv 1')
      expect(conversations.map(c => c.title)).toContain('Conv 2')
    })

    it('should delete a conversation', async () => {
      const conv = storageManager.createConversation('To Delete')
      await storageManager.saveConversation(conv)

      await storageManager.deleteConversation(conv.id)

      const loaded = await storageManager.loadConversation(conv.id)
      expect(loaded).toBeNull()
    })

    it('should add messages to conversation', async () => {
      let conv = storageManager.createConversation('Test')

      conv = storageManager.addMessageToConversation(conv, {
        agentId: 'pm-agent',
        agentName: 'PM Claw',
        content: 'Hello'
      })

      expect(conv.messages).toHaveLength(1)
      expect(conv.messages[0].content).toBe('Hello')
      expect(conv.messages[0].agentName).toBe('PM Claw')
    })
  })

  describe('Agent Config Management', () => {
    it('should save and load an agent config', async () => {
      const agent: AgentConfig = {
        id: 'custom-agent-1',
        name: 'Custom Agent',
        role: 'custom',
        emoji: '🤖',
        color: '#FF5733',
        systemPrompt: 'You are a custom agent',
        runtime: 'subagent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await storageManager.saveAgent(agent)
      const loaded = await storageManager.loadAgent('custom-agent-1')

      expect(loaded).not.toBeNull()
      expect(loaded?.name).toBe('Custom Agent')
      expect(loaded?.emoji).toBe('🤖')
    })

    it('should list all agent configs', async () => {
      const agent1: AgentConfig = {
        id: 'agent-1',
        name: 'Agent 1',
        role: 'custom',
        emoji: '🤖',
        color: '#FF5733',
        systemPrompt: 'Agent 1',
        runtime: 'subagent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const agent2: AgentConfig = {
        id: 'agent-2',
        name: 'Agent 2',
        role: 'custom',
        emoji: '🤖',
        color: '#FF5733',
        systemPrompt: 'Agent 2',
        runtime: 'subagent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await storageManager.saveAgent(agent1)
      await storageManager.saveAgent(agent2)

      const agents = await storageManager.listAgents()

      expect(agents).toHaveLength(2)
      expect(agents.map(a => a.name)).toContain('Agent 1')
      expect(agents.map(a => a.name)).toContain('Agent 2')
    })

    it('should delete an agent config', async () => {
      const agent: AgentConfig = {
        id: 'to-delete',
        name: 'To Delete',
        role: 'custom',
        emoji: '🤖',
        color: '#FF5733',
        systemPrompt: 'To delete',
        runtime: 'subagent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await storageManager.saveAgent(agent)
      await storageManager.deleteAgent('to-delete')

      const loaded = await storageManager.loadAgent('to-delete')
      expect(loaded).toBeNull()
    })
  })

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = storageManager.generateId()
      const id2 = storageManager.generateId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })
  })

  describe('Conversation Helpers', () => {
    it('should create a new conversation with correct structure', () => {
      const conv = storageManager.createConversation('New Chat')

      expect(conv.id).toBeDefined()
      expect(conv.title).toBe('New Chat')
      expect(conv.messages).toEqual([])
      expect(conv.createdAt).toBeDefined()
      expect(conv.updatedAt).toBeDefined()
    })
  })

  describe('Input Validation & Security', () => {
    it('should reject conversation IDs with path traversal', async () => {
      await expect(
        storageManager.loadConversation('../../etc/passwd')
      ).rejects.toThrow(/invalid/i)
    })

    it('should reject conversation IDs with path traversal (encoded)', async () => {
      await expect(
        storageManager.loadConversation('..%2F..%2Fetc%2Fpasswd')
      ).rejects.toThrow(/invalid/i)
    })

    it('should reject agent IDs with path traversal', async () => {
      await expect(
        storageManager.loadAgent('../../../etc/shadow')
      ).rejects.toThrow(/invalid/i)
    })

    it('should reject deleteConversation with path traversal ID', async () => {
      await expect(
        storageManager.deleteConversation('../../config.json')
      ).rejects.toThrow(/invalid/i)
    })

    it('should reject deleteAgent with path traversal ID', async () => {
      await expect(
        storageManager.deleteAgent('../config.json')
      ).rejects.toThrow(/invalid/i)
    })

    it('should reject IDs containing null bytes', async () => {
      await expect(
        storageManager.loadConversation('test\x00.json')
      ).rejects.toThrow(/invalid/i)
    })

    it('should reject empty IDs', async () => {
      await expect(
        storageManager.loadConversation('')
      ).rejects.toThrow(/invalid/i)
    })
  })

  describe('Corrupted Data Handling', () => {
    it('should return null when loading a conversation with corrupted JSON', async () => {
      await fs.writeFile(
        path.join(testDir, 'conversations', 'corrupted.json'),
        '{not valid json!!!}',
        'utf-8'
      )

      const result = await storageManager.loadConversation('corrupted')
      expect(result).toBeNull()
    })

    it('should return null when loading an agent with corrupted JSON', async () => {
      await fs.writeFile(
        path.join(testDir, 'agents', 'corrupted.json'),
        '{broken json',
        'utf-8'
      )

      const result = await storageManager.loadAgent('corrupted')
      expect(result).toBeNull()
    })

    it('should skip non-JSON files when listing conversations', async () => {
      const conv = storageManager.createConversation('Valid Conv')
      await storageManager.saveConversation(conv)
      await fs.writeFile(
        path.join(testDir, 'conversations', 'readme.txt'),
        'not a conversation',
        'utf-8'
      )

      const conversations = await storageManager.listConversations()
      expect(conversations).toHaveLength(1)
      expect(conversations[0].title).toBe('Valid Conv')
    })

    it('should skip non-JSON files when listing agents', async () => {
      const agent: AgentConfig = {
        id: 'valid-agent',
        name: 'Valid Agent',
        role: 'custom',
        emoji: '🤖',
        color: '#FF5733',
        systemPrompt: 'Valid agent',
        runtime: 'subagent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await storageManager.saveAgent(agent)
      await fs.writeFile(
        path.join(testDir, 'agents', 'notes.md'),
        'not an agent config',
        'utf-8'
      )

      const agents = await storageManager.listAgents()
      expect(agents).toHaveLength(1)
      expect(agents[0].name).toBe('Valid Agent')
    })

    it('should return null when loading a conversation with valid JSON but missing required fields', async () => {
      await fs.writeFile(
        path.join(testDir, 'conversations', 'incomplete.json'),
        JSON.stringify({ id: 'incomplete' }),
        'utf-8'
      )

      const result = await storageManager.loadConversation('incomplete')
      expect(result).toBeNull()
    })

    it('should return null when loading an agent with valid JSON but schema-invalid data', async () => {
      await fs.writeFile(
        path.join(testDir, 'agents', 'invalid-schema.json'),
        JSON.stringify({ id: 'x', name: 123, role: '' }),
        'utf-8'
      )

      const result = await storageManager.loadAgent('invalid-schema')
      expect(result).toBeNull()
    })

    it('should return null when loading a non-existent conversation', async () => {
      const result = await storageManager.loadConversation('does-not-exist')
      expect(result).toBeNull()
    })

    it('should return null when loading a non-existent agent', async () => {
      const result = await storageManager.loadAgent('does-not-exist')
      expect(result).toBeNull()
    })
  })

  describe('Single-Parse Correctness', () => {
    it('should preserve special characters in conversation content through save/load cycle', async () => {
      const conv: Conversation = {
        id: 'special-chars',
        title: 'Test "quotes" & <brackets> and /slashes/',
        messages: [
          {
            id: 'msg-1',
            agentId: 'dev',
            agentName: 'Dev Agent',
            content: 'Unicode: 你好世界 🌍 emoji=\u{1F600}',
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await storageManager.saveConversation(conv)
      const loaded = await storageManager.loadConversation('special-chars')

      expect(loaded).not.toBeNull()
      expect(loaded?.title).toBe(conv.title)
      expect(loaded?.messages[0].content).toBe(conv.messages[0].content)
    })

    it('should preserve all agent config fields through save/load cycle', async () => {
      const agent: AgentConfig = {
        id: 'full-agent',
        name: 'Full Agent "with quotes"',
        role: 'custom',
        emoji: '🔧',
        color: '#00FF00',
        systemPrompt: 'You are a "special" agent\nwith newlines & <tags>',
        runtime: 'acp',
        agentId: 'custom-123',
        thinking: 'high',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await storageManager.saveAgent(agent)
      const loaded = await storageManager.loadAgent('full-agent')

      expect(loaded).not.toBeNull()
      expect(loaded?.name).toBe(agent.name)
      expect(loaded?.systemPrompt).toBe(agent.systemPrompt)
      expect(loaded?.emoji).toBe('🔧')
      expect(loaded?.runtime).toBe('acp')
      expect(loaded?.thinking).toBe('high')
      expect(loaded?.agentId).toBe('custom-123')
    })
  })
})
