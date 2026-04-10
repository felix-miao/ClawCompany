import { SessionSyncService, GatewayAgent, GatewaySession } from '../session-sync'

describe('SessionSyncService', () => {
  let sync: SessionSyncService
  let mockClient: {
    call: jest.Mock
    connect: jest.Mock
    disconnect: jest.Mock
  }

  beforeEach(() => {
    mockClient = {
      call: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    }
    sync = new SessionSyncService(mockClient as any)
  })

  describe('fetchAgents', () => {
    it('should call agents.list and return agents', async () => {
      const agents: GatewayAgent[] = [
        { id: 'sidekick-claw', name: 'PM', identity: { name: 'PM Claw' } },
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ]
      mockClient.call.mockResolvedValue({ agents, defaultId: 'sidekick-claw' })

      const result = await sync.fetchAgents()

      expect(mockClient.call).toHaveBeenCalledWith('agents.list')
      expect(result).toEqual(agents)
    })

    it('should return empty array when no agents', async () => {
      mockClient.call.mockResolvedValue({ agents: [], defaultId: '' })

      const result = await sync.fetchAgents()

      expect(result).toEqual([])
    })

    it('should return empty array when agents is undefined', async () => {
      mockClient.call.mockResolvedValue({})

      const result = await sync.fetchAgents()

      expect(result).toEqual([])
    })
  })

  describe('fetchSessions', () => {
    it('should call sessions.list and return sessions', async () => {
      const sessions: GatewaySession[] = [
        { key: 's1', agentId: 'sidekick-claw', label: 'test', model: 'glm-5', status: 'running', endedAt: null },
      ]
      mockClient.call.mockResolvedValue({ sessions, defaults: {} })

      const result = await sync.fetchSessions()

      expect(mockClient.call).toHaveBeenCalledWith('sessions.list')
      expect(result).toEqual(sessions)
    })

    it('should return empty array when sessions is undefined', async () => {
      mockClient.call.mockResolvedValue({})

      const result = await sync.fetchSessions()

      expect(result).toEqual([])
    })
  })

  describe('mapToAgentInfo', () => {
    it('should map agents with no active sessions as idle', () => {
      const agents: GatewayAgent[] = [
        { id: 'sidekick-claw', name: 'PM', identity: { name: 'PM Claw' } },
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ]
      const sessions: GatewaySession[] = []

      const result = sync.mapToAgentInfo(agents, sessions)

      expect(result).toEqual([
        { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])
    })

    it('should map agent with active session (endedAt null) as busy', () => {
      const agents: GatewayAgent[] = [
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ]
      const sessions: GatewaySession[] = [
        { key: 's1', agentId: 'dev-claw', label: 'work', model: 'glm-5', status: 'running', endedAt: null },
      ]

      const result = sync.mapToAgentInfo(agents, sessions)

      expect(result[0].status).toBe('busy')
    })

    it('should map agent with running status as busy', () => {
      const agents: GatewayAgent[] = [
        { id: 'reviewer-claw', name: 'Rev', identity: { name: 'Reviewer Claw' } },
      ]
      const sessions: GatewaySession[] = [
        { key: 's1', agentId: 'reviewer-claw', label: 'review', model: 'glm-5', status: 'running', endedAt: '2026-04-10T00:00:00Z' },
      ]

      const result = sync.mapToAgentInfo(agents, sessions)

      expect(result[0].status).toBe('busy')
    })

    it('should map ended session as idle', () => {
      const agents: GatewayAgent[] = [
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ]
      const sessions: GatewaySession[] = [
        { key: 's1', agentId: 'dev-claw', label: 'done', model: 'glm-5', status: 'completed', endedAt: '2026-04-10T00:00:00Z' },
      ]

      const result = sync.mapToAgentInfo(agents, sessions)

      expect(result[0].status).toBe('idle')
    })

    it('should map role from agent id', () => {
      const agents: GatewayAgent[] = [
        { id: 'sidekick-claw', name: 'a', identity: { name: 'PM' } },
        { id: 'dev-claw', name: 'b', identity: { name: 'Dev' } },
        { id: 'reviewer-claw', name: 'c', identity: { name: 'Rev' } },
        { id: 'tester-claw', name: 'd', identity: { name: 'Tester' } },
        { id: 'unknown-claw', name: 'e', identity: { name: 'Unknown' } },
      ]

      const result = sync.mapToAgentInfo(agents, [])

      expect(result.map(a => a.role)).toEqual(['pm', 'dev', 'review', 'tester', 'dev'])
    })

    it('should fall back to agent.name when identity.name is empty', () => {
      const agents: GatewayAgent[] = [
        { id: 'dev-claw', name: 'Fallback Name', identity: { name: '' } },
      ]

      const result = sync.mapToAgentInfo(agents, [])

      expect(result[0].name).toBe('Fallback Name')
    })

    it('should fall back to agent.id when both name and identity.name are empty', () => {
      const agents: GatewayAgent[] = [
        { id: 'dev-claw', name: '', identity: { name: '' } },
      ]

      const result = sync.mapToAgentInfo(agents, [])

      expect(result[0].name).toBe('dev-claw')
    })
  })

  describe('getDefaultAgents', () => {
    it('should return fallback default agents', () => {
      const defaults = sync.getDefaultAgents()

      expect(defaults).toHaveLength(4)
      expect(defaults.map(a => a.id)).toEqual(['pm-agent', 'dev-agent', 'review-agent', 'test-agent'])
    })

    it('should return a copy each time', () => {
      const a = sync.getDefaultAgents()
      const b = sync.getDefaultAgents()

      a[0].name = 'Modified'
      expect(b[0].name).toBe('PM')
    })
  })
})
