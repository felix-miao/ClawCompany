import { SessionPollerService, resetSessionPoller, getSessionPoller } from '../session-poller'
import { SessionSyncService, GatewayAgent, GatewaySession } from '../session-sync'

import { GameEventStore } from '@/game/data/GameEventStore'

jest.useFakeTimers()

describe('SessionPollerService', () => {
  let store: GameEventStore
  let mockSync: {
    fetchAgents: jest.Mock
    fetchSessions: jest.Mock
    mapToAgentInfo: jest.Mock
    getDefaultAgents: jest.Mock
  }

  beforeEach(() => {
    resetSessionPoller()
    store = new GameEventStore()

    mockSync = {
      fetchAgents: jest.fn(),
      fetchSessions: jest.fn(),
      mapToAgentInfo: jest.fn(),
      getDefaultAgents: jest.fn(),
    }
  })

  afterEach(() => {
    resetSessionPoller()
    jest.clearAllTimers()
  })

  describe('first poll', () => {
    it('should push agent initial status on first poll', async () => {
      const agents: GatewayAgent[] = [
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ]
      const sessions: GatewaySession[] = []

      mockSync.fetchAgents.mockResolvedValue(agents)
      mockSync.fetchSessions.mockResolvedValue(sessions)
      mockSync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])

      const poller = new SessionPollerService(store, mockSync as unknown as SessionSyncService, { interval: 5000 })
      poller.start()

      await jest.advanceTimersByTimeAsync(100)

      const events = store.getEvents()
      const statusEvents = events.filter(e => e.type === 'agent:status-change')
      expect(statusEvents).toHaveLength(1)
      expect(statusEvents[0]).toMatchObject({
        type: 'agent:status-change',
        agentId: 'dev-claw',
        status: 'idle',
      })
    })
  })

  describe('agent status changes', () => {
    it('should push agent:status-change when status changes from idle to busy', async () => {
      const agents: GatewayAgent[] = [
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ]

      mockSync.fetchAgents.mockResolvedValue(agents)
      mockSync.fetchSessions.mockResolvedValue([])
      mockSync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])

      const poller = new SessionPollerService(store, mockSync as unknown as SessionSyncService, { interval: 5000 })
      poller.start()

      await jest.advanceTimersByTimeAsync(100)

      const eventsAfterFirst = store.getEvents().length

      mockSync.fetchSessions.mockResolvedValue([
        { key: 's1', agentId: 'dev-claw', label: 'work', model: 'glm-5', status: 'running', endedAt: null },
      ])
      mockSync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])

      await jest.advanceTimersByTimeAsync(5000)

      const newEvents = store.getEvents().slice(eventsAfterFirst)
      const statusChange = newEvents.find(e => e.type === 'agent:status-change')
      expect(statusChange).toMatchObject({
        type: 'agent:status-change',
        agentId: 'dev-claw',
        status: 'busy',
        previousStatus: 'idle',
      })
    })

    it('should not push duplicate status when status stays the same', async () => {
      const agents: GatewayAgent[] = [
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ]

      mockSync.fetchAgents.mockResolvedValue(agents)
      mockSync.fetchSessions.mockResolvedValue([])
      mockSync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])

      const poller = new SessionPollerService(store, mockSync as unknown as SessionSyncService, { interval: 5000 })
      poller.start()

      await jest.advanceTimersByTimeAsync(100)
      const eventsAfterFirst = store.getEvents().length

      await jest.advanceTimersByTimeAsync(5000)

      const newEvents = store.getEvents().slice(eventsAfterFirst)
      const statusChanges = newEvents.filter(e => e.type === 'agent:status-change')
      expect(statusChanges).toHaveLength(0)
    })
  })

  describe('session events', () => {
    it('should push session:started when a new session appears', async () => {
      const agents: GatewayAgent[] = [
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ]

      mockSync.fetchAgents.mockResolvedValue(agents)
      mockSync.fetchSessions.mockResolvedValue([])
      mockSync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])

      const poller = new SessionPollerService(store, mockSync as unknown as SessionSyncService, { interval: 5000 })
      poller.start()

      await jest.advanceTimersByTimeAsync(100)
      const eventsAfterFirst = store.getEvents().length

      const newSession: GatewaySession = {
        key: 's1', agentId: 'dev-claw', label: 'implement feature', model: 'glm-5', status: 'running', endedAt: null,
      }
      mockSync.fetchSessions.mockResolvedValue([newSession])
      mockSync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])

      await jest.advanceTimersByTimeAsync(5000)

      const newEvents = store.getEvents().slice(eventsAfterFirst)
      const startedEvent = newEvents.find(e => e.type === 'session:started')
      expect(startedEvent).toMatchObject({
        type: 'session:started',
        sessionKey: 's1',
        agentId: 'dev-claw',
        role: 'dev',
      })
    })

    it('should push session:completed when a session ends', async () => {
      const agents: GatewayAgent[] = [
        { id: 'dev-claw', name: 'Dev', identity: { name: 'Dev Claw' } },
      ]

      mockSync.fetchAgents.mockResolvedValue(agents)
      mockSync.fetchSessions.mockResolvedValue([
        { key: 's1', agentId: 'dev-claw', label: 'work', model: 'glm-5', status: 'running', endedAt: null },
      ])
      mockSync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
      ])

      const poller = new SessionPollerService(store, mockSync as unknown as SessionSyncService, { interval: 5000 })
      poller.start()

      await jest.advanceTimersByTimeAsync(100)
      const eventsAfterFirst = store.getEvents().length

      mockSync.fetchSessions.mockResolvedValue([
        { key: 's1', agentId: 'dev-claw', label: 'work', model: 'glm-5', status: 'completed', endedAt: '2026-04-10T00:00:00Z' },
      ])
      mockSync.mapToAgentInfo.mockReturnValue([
        { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
      ])

      await jest.advanceTimersByTimeAsync(5000)

      const newEvents = store.getEvents().slice(eventsAfterFirst)
      const completedEvent = newEvents.find(e => e.type === 'session:completed')
      expect(completedEvent).toMatchObject({
        type: 'session:completed',
        sessionKey: 's1',
        agentId: 'dev-claw',
        status: 'completed',
      })
    })
  })

  describe('graceful degradation', () => {
    it('should use default agents when Gateway is unavailable', async () => {
      mockSync.fetchAgents.mockRejectedValue(new Error('Gateway unavailable'))
      mockSync.fetchSessions.mockRejectedValue(new Error('Gateway unavailable'))
      mockSync.getDefaultAgents.mockReturnValue([
        { id: 'alice', name: 'Alice', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
      ])

      const poller = new SessionPollerService(store, mockSync as unknown as SessionSyncService, { interval: 5000 })
      poller.start()

      await jest.advanceTimersByTimeAsync(100)

      const events = store.getEvents()
      const statusEvents = events.filter(e => e.type === 'agent:status-change')
      expect(statusEvents).toHaveLength(1)
      expect(statusEvents[0]).toMatchObject({
        agentId: 'alice',
        status: 'idle',
      })
    })

    it('should not crash on repeated Gateway failures', async () => {
      mockSync.fetchAgents.mockRejectedValue(new Error('fail'))
      mockSync.fetchSessions.mockRejectedValue(new Error('fail'))
      mockSync.getDefaultAgents.mockReturnValue([])

      const poller = new SessionPollerService(store, mockSync as unknown as SessionSyncService, { interval: 5000 })
      poller.start()

      await jest.advanceTimersByTimeAsync(100)
      await jest.advanceTimersByTimeAsync(5000)
      await jest.advanceTimersByTimeAsync(5000)

      expect(poller.isRunning()).toBe(true)
    })
  })

  describe('singleton', () => {
    it('should not create multiple pollers on multiple start calls', async () => {
      mockSync.fetchAgents.mockResolvedValue([])
      mockSync.fetchSessions.mockResolvedValue([])
      mockSync.mapToAgentInfo.mockReturnValue([])

      const poller = new SessionPollerService(store, mockSync as unknown as SessionSyncService, { interval: 5000 })
      poller.start()
      poller.start()
      poller.start()

      await jest.advanceTimersByTimeAsync(100)

      expect(mockSync.fetchAgents).toHaveBeenCalledTimes(1)
    })
  })

  describe('stop', () => {
    it('should stop polling after stop is called', async () => {
      mockSync.fetchAgents.mockResolvedValue([])
      mockSync.fetchSessions.mockResolvedValue([])
      mockSync.mapToAgentInfo.mockReturnValue([])

      const poller = new SessionPollerService(store, mockSync as unknown as SessionSyncService, { interval: 5000 })
      poller.start()

      await jest.advanceTimersByTimeAsync(100)
      expect(poller.isRunning()).toBe(true)

      poller.stop()
      expect(poller.isRunning()).toBe(false)

      const callCount = mockSync.fetchAgents.mock.calls.length

      await jest.advanceTimersByTimeAsync(5000)
      await jest.advanceTimersByTimeAsync(5000)

      expect(mockSync.fetchAgents).toHaveBeenCalledTimes(callCount)
    })
  })

  describe('getSessionPoller singleton factory', () => {
    it('should return the same instance', () => {
      const a = getSessionPoller(store)
      const b = getSessionPoller(store)
      expect(a).toBe(b)
      resetSessionPoller()
    })
  })
})
