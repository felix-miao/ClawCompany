import { DashboardStore, AgentInfo } from '../DashboardStore'

describe('DashboardStore.loadAgents', () => {
  let store: DashboardStore

  beforeEach(() => {
    store = new DashboardStore()
  })

  it('should add new agents', () => {
    const newAgents: AgentInfo[] = [
      { id: 'sidekick-claw', name: 'PM Claw', role: 'pm', status: 'idle', emotion: 'neutral', currentTask: null },
      { id: 'dev-claw', name: 'Dev Claw', role: 'dev', status: 'busy', emotion: 'neutral', currentTask: null },
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
      { id: 'pm-agent', name: 'Alice Updated', role: 'PM', status: 'busy', emotion: 'neutral', currentTask: null },
    ])

    const alice = store.getAgentById('pm-agent')
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
      { id: 'pm-agent', name: 'PM', role: 'Developer', status: 'busy', emotion: 'neutral', currentTask: null },
    ])

    const alice = store.getAgentById('pm-agent')
    expect(alice?.currentTask).toBe('Build feature X')
    expect(alice?.status).toBe('busy')
  })

  it('should update status for existing agents', () => {
    store.loadAgents([
      { id: 'pm-agent', name: 'PM', role: 'Developer', status: 'busy', emotion: 'neutral', currentTask: null },
      { id: 'dev-agent', name: 'Dev', role: 'Developer', status: 'offline', emotion: 'neutral', currentTask: null },
    ])

    expect(store.getAgentById('pm-agent')?.status).toBe('busy')
    expect(store.getAgentById('dev-agent')?.status).toBe('offline')
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
      { id: 'new-agent', name: 'New', role: 'dev', status: 'idle', emotion: 'neutral', currentTask: null },
    ])

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should reset default agents to original state but keep extra agents', () => {
    store.loadAgents([
      { id: 'extra-agent', name: 'Extra', role: 'dev', status: 'busy', emotion: 'happy', currentTask: 'stuff' },
    ])

    store.processEvent({
      type: 'agent:status-change',
      timestamp: Date.now(),
      agentId: 'pm-agent',
      status: 'busy',
    })

    store.reset()

    expect(store.getAgentById('pm-agent')?.status).toBe('idle')
    expect(store.getEvents()).toEqual([])
  })
})
