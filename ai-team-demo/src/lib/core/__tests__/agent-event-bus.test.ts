import {
  AgentEventBus,
  AgentEvent,
  AgentEventType,
} from '../agent-event-bus'

describe('AgentEventBus', () => {
  let bus: AgentEventBus

  beforeEach(() => {
    bus = new AgentEventBus()
  })

  describe('emit', () => {
    it('should emit an event with auto-generated timestamp', () => {
      bus.emit({ type: 'agent:started', agentRole: 'pm' })

      const history = bus.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0].type).toBe('agent:started')
      expect(history[0].agentRole).toBe('pm')
      expect(history[0].timestamp).toBeInstanceOf(Date)
    })

    it('should emit events with all event types', () => {
      const types: AgentEventType[] = [
        'agent:started',
        'agent:completed',
        'agent:failed',
        'agent:retrying',
        'workflow:started',
        'workflow:completed',
      ]

      types.forEach((type) => bus.emit({ type }))

      expect(bus.getHistory()).toHaveLength(6)
    })

    it('should emit event with taskId and data', () => {
      bus.emit({
        type: 'agent:completed',
        agentRole: 'dev',
        taskId: 'task_123',
        data: { files: ['a.ts', 'b.ts'] },
      })

      const event = bus.getHistory()[0]
      expect(event.taskId).toBe('task_123')
      expect(event.data).toEqual({ files: ['a.ts', 'b.ts'] })
    })

    it('should handle emit without optional fields', () => {
      bus.emit({ type: 'workflow:started' })

      const event = bus.getHistory()[0]
      expect(event.type).toBe('workflow:started')
      expect(event.agentRole).toBeUndefined()
      expect(event.taskId).toBeUndefined()
      expect(event.data).toBeUndefined()
    })
  })

  describe('subscribe', () => {
    it('should call handler when event is emitted', () => {
      const handler = jest.fn()
      bus.subscribe(handler)

      bus.emit({ type: 'agent:started', agentRole: 'pm' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent:started',
          agentRole: 'pm',
        })
      )
    })

    it('should call all handlers in subscription order', () => {
      const order: string[] = []
      const h1 = jest.fn(() => order.push('h1'))
      const h2 = jest.fn(() => order.push('h2'))
      const h3 = jest.fn(() => order.push('h3'))

      bus.subscribe(h1)
      bus.subscribe(h2)
      bus.subscribe(h3)

      bus.emit({ type: 'agent:started', agentRole: 'dev' })

      expect(order).toEqual(['h1', 'h2', 'h3'])
    })

    it('should return unsubscribe function', () => {
      const handler = jest.fn()
      const unsubscribe = bus.subscribe(handler)

      bus.emit({ type: 'agent:started', agentRole: 'pm' })
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      bus.emit({ type: 'agent:completed', agentRole: 'pm' })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should not affect other subscribers when one unsubscribes', () => {
      const h1 = jest.fn()
      const h2 = jest.fn()
      const unsub1 = bus.subscribe(h1)
      bus.subscribe(h2)

      bus.emit({ type: 'agent:started', agentRole: 'pm' })
      expect(h1).toHaveBeenCalledTimes(1)
      expect(h2).toHaveBeenCalledTimes(1)

      unsub1()

      bus.emit({ type: 'agent:completed', agentRole: 'dev' })
      expect(h1).toHaveBeenCalledTimes(1)
      expect(h2).toHaveBeenCalledTimes(2)
    })

    it('should support multiple subscribe/unsubscribe cycles', () => {
      const handler = jest.fn()
      const unsub = bus.subscribe(handler)

      bus.emit({ type: 'agent:started', agentRole: 'pm' })
      expect(handler).toHaveBeenCalledTimes(1)

      unsub()
      unsub()

      bus.emit({ type: 'agent:completed', agentRole: 'pm' })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should continue calling remaining handlers if one throws', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('handler error')
      })
      const normalHandler = jest.fn()

      bus.subscribe(errorHandler)
      bus.subscribe(normalHandler)

      bus.emit({ type: 'agent:started', agentRole: 'pm' })

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(normalHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('getHistory', () => {
    it('should return empty array when no events emitted', () => {
      expect(bus.getHistory()).toEqual([])
    })

    it('should return copy of history (immutable)', () => {
      bus.emit({ type: 'agent:started', agentRole: 'pm' })

      const history = bus.getHistory()
      history.pop()

      expect(bus.getHistory()).toHaveLength(1)
    })

    it('should return all emitted events in order', () => {
      bus.emit({ type: 'workflow:started' })
      bus.emit({ type: 'agent:started', agentRole: 'pm' })
      bus.emit({ type: 'agent:completed', agentRole: 'pm' })
      bus.emit({ type: 'workflow:completed' })

      const history = bus.getHistory()
      expect(history.map((e) => e.type)).toEqual([
        'workflow:started',
        'agent:started',
        'agent:completed',
        'workflow:completed',
      ])
    })
  })

  describe('getHistoryByType', () => {
    it('should filter events by type', () => {
      bus.emit({ type: 'agent:started', agentRole: 'pm' })
      bus.emit({ type: 'agent:completed', agentRole: 'pm' })
      bus.emit({ type: 'agent:started', agentRole: 'dev' })
      bus.emit({ type: 'agent:failed', agentRole: 'dev' })

      const started = bus.getHistoryByType('agent:started')
      expect(started).toHaveLength(2)
      expect(started.every((e) => e.type === 'agent:started')).toBe(true)
    })

    it('should return empty array for type with no matches', () => {
      bus.emit({ type: 'agent:started', agentRole: 'pm' })

      expect(bus.getHistoryByType('agent:failed')).toEqual([])
    })
  })

  describe('getHistoryByAgent', () => {
    it('should filter events by agent role', () => {
      bus.emit({ type: 'agent:started', agentRole: 'pm' })
      bus.emit({ type: 'agent:started', agentRole: 'dev' })
      bus.emit({ type: 'agent:completed', agentRole: 'pm' })
      bus.emit({ type: 'agent:failed', agentRole: 'dev' })

      const pmEvents = bus.getHistoryByAgent('pm')
      expect(pmEvents).toHaveLength(2)
      expect(pmEvents.every((e) => e.agentRole === 'pm')).toBe(true)
    })

    it('should return empty array for agent with no events', () => {
      bus.emit({ type: 'agent:started', agentRole: 'pm' })

      expect(bus.getHistoryByAgent('review')).toEqual([])
    })

    it('should not include events without agentRole', () => {
      bus.emit({ type: 'workflow:started' })
      bus.emit({ type: 'agent:started', agentRole: 'pm' })

      expect(bus.getHistoryByAgent('pm')).toHaveLength(1)
    })
  })

  describe('getLatestByAgent', () => {
    it('should return the most recent event for an agent', () => {
      bus.emit({ type: 'agent:started', agentRole: 'pm', taskId: 't1' })
      bus.emit({ type: 'agent:completed', agentRole: 'pm', taskId: 't1' })
      bus.emit({ type: 'agent:started', agentRole: 'pm', taskId: 't2' })

      const latest = bus.getLatestByAgent('pm')
      expect(latest).toBeDefined()
      expect(latest!.type).toBe('agent:started')
      expect(latest!.taskId).toBe('t2')
    })

    it('should return undefined for agent with no events', () => {
      expect(bus.getLatestByAgent('review')).toBeUndefined()
    })
  })

  describe('clear', () => {
    it('should clear all history', () => {
      bus.emit({ type: 'agent:started', agentRole: 'pm' })
      bus.emit({ type: 'agent:completed', agentRole: 'pm' })

      bus.clear()

      expect(bus.getHistory()).toEqual([])
    })

    it('should not remove subscribers after clear', () => {
      const handler = jest.fn()
      bus.subscribe(handler)

      bus.emit({ type: 'agent:started', agentRole: 'pm' })
      bus.clear()
      bus.emit({ type: 'agent:completed', agentRole: 'pm' })

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('history eviction', () => {
    it('should evict oldest events when exceeding maxHistory', () => {
      const smallBus = new AgentEventBus(5)
      for (let i = 0; i < 8; i++) {
        smallBus.emit({ type: 'agent:started', agentRole: 'pm', data: { i } })
      }
      const history = smallBus.getHistory()
      expect(history).toHaveLength(5)
      expect((history[0].data as { i: number }).i).toBe(3)
      expect((history[4].data as { i: number }).i).toBe(7)
    })

    it('should retain events within maxHistory', () => {
      const smallBus = new AgentEventBus(100)
      for (let i = 0; i < 50; i++) {
        smallBus.emit({ type: 'agent:started', agentRole: 'pm' })
      }
      expect(smallBus.getHistory()).toHaveLength(50)
    })

    it('should still notify subscribers after eviction', () => {
      const smallBus = new AgentEventBus(2)
      const handler = jest.fn()
      smallBus.subscribe(handler)
      for (let i = 0; i < 5; i++) {
        smallBus.emit({ type: 'agent:started', agentRole: 'pm' })
      }
      expect(handler).toHaveBeenCalledTimes(5)
    })

    it('should use default maxHistory when not specified', () => {
      const defaultBus = new AgentEventBus()
      for (let i = 0; i < 1000; i++) {
        defaultBus.emit({ type: 'agent:started', agentRole: 'pm' })
      }
      expect(defaultBus.getHistory()).toHaveLength(1000)
      defaultBus.emit({ type: 'agent:started', agentRole: 'pm' })
      expect(defaultBus.getHistory()).toHaveLength(1000)
    })
  })

  describe('listenerCount', () => {
    it('should return 0 when no subscribers', () => {
      expect(bus.listenerCount()).toBe(0)
    })

    it('should count active subscribers', () => {
      const unsub1 = bus.subscribe(jest.fn())
      bus.subscribe(jest.fn())

      expect(bus.listenerCount()).toBe(2)

      unsub1()
      expect(bus.listenerCount()).toBe(1)
    })
  })

  describe('real-world workflow scenario', () => {
    it('should track a complete PM → Dev → Review workflow', () => {
      bus.emit({ type: 'workflow:started', data: { userMessage: '创建登录页' } })
      bus.emit({ type: 'agent:started', agentRole: 'pm', taskId: 'task_1' })
      bus.emit({ type: 'agent:completed', agentRole: 'pm', taskId: 'task_1' })
      bus.emit({ type: 'agent:started', agentRole: 'dev', taskId: 'task_2' })
      bus.emit({ type: 'agent:completed', agentRole: 'dev', taskId: 'task_2', data: { files: ['login.tsx'] } })
      bus.emit({ type: 'agent:started', agentRole: 'review', taskId: 'task_3' })
      bus.emit({ type: 'agent:completed', agentRole: 'review', taskId: 'task_3' })
      bus.emit({ type: 'workflow:completed' })

      const history = bus.getHistory()
      expect(history).toHaveLength(8)

      const completed = bus.getHistoryByType('agent:completed')
      expect(completed).toHaveLength(3)

      const devEvents = bus.getHistoryByAgent('dev')
      expect(devEvents).toHaveLength(2)

      const latestReview = bus.getLatestByAgent('review')
      expect(latestReview?.type).toBe('agent:completed')
    })

    it('should track retry scenario', () => {
      const events: AgentEvent[] = []
      bus.subscribe((e) => events.push(e))

      bus.emit({ type: 'agent:started', agentRole: 'dev', taskId: 't1' })
      bus.emit({ type: 'agent:failed', agentRole: 'dev', taskId: 't1', data: { error: 'timeout' } })
      bus.emit({ type: 'agent:retrying', agentRole: 'dev', taskId: 't1', data: { attempt: 1 } })
      bus.emit({ type: 'agent:completed', agentRole: 'dev', taskId: 't1' })

      expect(events).toHaveLength(4)

      const retries = bus.getHistoryByType('agent:retrying')
      expect(retries).toHaveLength(1)
      expect(retries[0].data?.attempt).toBe(1)
    })
  })
})
