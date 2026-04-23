import { DashboardStore, AgentInfo } from '../DashboardStore'
import { createDefaultAgents } from '@/lib/gateway/default-agents'

describe('DashboardStore.loadAgents', () => {
  let store: DashboardStore

  beforeEach(() => {
    store = new DashboardStore()
  })

  it('should add new agents', () => {
    const newAgents: AgentInfo[] = [
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ]

    store.loadAgents(newAgents)

    const agents = store.getAgents()
    expect(agents.length).toBeGreaterThanOrEqual(2)
    expect(store.getAgentById('sidekick-claw')).toMatchObject({ name: 'PM Claw', role: 'pm', status: 'idle' })
    expect(store.getAgentById('dev-claw')).toMatchObject({ name: 'Dev Claw', status: 'busy' })
  })

  it('should preserve existing agent emotion when updating', () => {
    store.processEvent({
      type: 'agent:emotion-change',
      timestamp: Date.now(),
      agentId: 'pm-agent',
      emotion: 'happy',
      source: 'manual',
    })

    store.loadAgents([
      { id: 'sidekick-claw', name: 'Alice Updated', role: 'PM', status: 'busy', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ])

    const alice = store.getAgentById('sidekick-claw')
    expect(alice?.emotion).toBe('happy')
    expect(alice?.name).toBe('Alice Updated')
    expect(alice?.status).toBe('busy')
    expect(alice?.role).toBe('PM')
  })

  it('should preserve currentTask when updating existing agent', () => {
    store.processEvent({
      type: 'agent:task-assigned',
      timestamp: Date.now(),
      agentId: 'pm-agent',
      taskId: 'task-1',
      taskType: 'develop',
      description: 'Build feature X',
    })

    store.loadAgents([
      { id: 'pm-agent', name: 'PM', role: 'Developer', status: 'busy', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ])

    const alice = store.getAgentById('pm-agent')
    expect(alice?.currentTask).toBe('Build feature X')
    expect(alice?.status).toBe('busy')
  })

  it('should update status for existing agents', () => {
    store.loadAgents([
      { id: 'sidekick-claw', name: 'PM', role: 'Developer', status: 'busy', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'dev-claw', name: 'Dev', role: 'Developer', status: 'offline', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ])

    expect(store.getAgentById('sidekick-claw')?.status).toBe('busy')
    expect(store.getAgentById('dev-claw')?.status).toBe('offline')
  })

  it('should handle empty agents list', () => {
    const originalAgents = store.getAgents()

    store.loadAgents([])

    const agents = store.getAgents()
    expect(agents).toEqual(originalAgents)
  })

  it('should notify subscribers on load', () => {
    const callback = jest.fn()
    store.subscribe(callback)

    store.loadAgents([
      { id: 'new-agent', name: 'New', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ])

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should reset default agents to original state but keep extra agents', () => {
    store.loadAgents([
      { id: 'extra-agent', name: 'Extra', role: 'dev', status: 'busy', emotion: 'happy', currentTask: 'stuff', latestResultSummary: null },
    ])

    store.processEvent({
      type: 'agent:status-change',
      timestamp: Date.now(),
      agentId: 'sidekick-claw',
      status: 'busy',
    })

    store.reset()

    expect(store.getAgentById('sidekick-claw')?.status).toBe('idle')
    expect(store.getEvents()).toEqual([])
  })

  it('should map gateway agent IDs to canonical IDs (alias mapping)', () => {
    store.loadAgents([
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ])

    expect(store.getAgentById('pm-agent')).toMatchObject({ name: 'PM Claw', status: 'idle' })
    expect(store.getAgentById('dev-agent')).toMatchObject({ name: 'Dev Claw', status: 'busy' })
    expect(store.getAgentById('sidekick-claw')).toMatchObject({ name: 'PM Claw', status: 'idle' })
    expect(store.getAgentById('dev-claw')).toMatchObject({ name: 'Dev Claw', status: 'busy' })
  })

  it('should preserve stable defaults when gateway agents and sessions are merged repeatedly', () => {
    expect(store.getAgents().map(agent => agent.id)).toEqual(createDefaultAgents().map(agent => agent.id))

    store.loadAgents([
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'busy', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ])

    store.loadAgents([
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'busy', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ])

    expect(store.getAgents().map(agent => agent.id)).toContain('sidekick-claw')
    expect(store.getAgents().map(agent => agent.id)).toContain('dev-claw')
    expect(store.getAgents().map(agent => agent.id)).toEqual(['sidekick-claw', 'dev-claw', 'reviewer-claw', 'tester-claw'])
  })

  it('should preserve canonical ID events after gateway agent loads with alias', () => {
    store.processEvent({
      type: 'agent:status-change',
      timestamp: Date.now(),
      agentId: 'pm-agent',
      status: 'busy',
    })
    const eventsBefore = store.getEventsByAgent('pm-agent')
    expect(eventsBefore).toHaveLength(1)

    store.loadAgents([
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
    ])

    expect(store.getAgentById('sidekick-claw')).toMatchObject({ status: 'idle' })
  })
})
