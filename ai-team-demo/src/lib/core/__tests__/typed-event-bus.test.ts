import { TypedEventBus } from '../typed-event-bus'

describe('TypedEventBus', () => {
  let bus: TypedEventBus<{ type: string; data?: any }>

  beforeEach(() => {
    bus = new TypedEventBus()
  })

  describe('基本功能', () => {
    it('应该处理事件订阅和触发', () => {
      const handler = jest.fn()
      bus.on('test:event', handler)

      bus.emit('test:event', { type: 'test:event', data: { value: 42 } })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ type: 'test:event', data: { value: 42 } })
    })

    it('应该处理通配符订阅', () => {
      const handler = jest.fn()
      bus.on('*', handler)

      bus.emit('any:event', { type: 'any:event', data: { value: 123 } })
      bus.emit('another:event', { type: 'another:event', data: { value: 456 } })

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenNthCalledWith(1, { type: 'any:event', data: { value: 123 } })
      expect(handler).toHaveBeenNthCalledWith(2, { type: 'another:event', data: { value: 456 } })
    })

    it('应该处理once方法', () => {
      const handler = jest.fn()
      bus.once('one-time', handler)

      bus.emit('one-time', { type: 'one-time', data: { value: 1 } })
      bus.emit('one-time', { type: 'one-time', data: { value: 2 } })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ type: 'one-time', data: { value: 1 } })
    })
  })

  describe('错误报告', () => {
    it('应该收集并报告处理器错误', () => {
      const errorHandler1 = jest.fn(() => {
        throw new Error('handler1 error')
      })
      const errorHandler2 = jest.fn(() => {
        throw new Error('handler2 error')
      })
      const successHandler = jest.fn()

      bus.on('error:event', errorHandler1)
      bus.on('error:event', errorHandler2)
      bus.on('error:event', successHandler)

      const errors = bus.emit('error:event', { type: 'error:event', data: { value: 1 } })

      expect(successHandler).toHaveBeenCalledTimes(1)
      expect(errors).toHaveLength(2)
      expect(errors[0].message).toBe('handler1 error')
      expect(errors[1].message).toBe('handler2 error')
    })

    it('应该静默处理单个处理器错误，继续执行其他处理器', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('should not stop execution')
      })
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      bus.on('multi:event', errorHandler)
      bus.on('multi:event', handler1)
      bus.on('multi:event', handler2)

      const errors = bus.emit('multi:event', { type: 'multi:event', data: {} })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('should not stop execution')
    })
  })

  describe('历史记录', () => {
    it('应该记录事件历史', () => {
      bus.emit('event1', { type: 'event1', data: { value: 1 } })
      bus.emit('event2', { type: 'event2', data: { value: 2 } })

      const history = bus.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0]).toEqual({ type: 'event1', data: { value: 1 } })
      expect(history[1]).toEqual({ type: 'event2', data: { value: 2 } })
    })

    it('应该支持自定义历史记录大小', () => {
      const smallBus = new TypedEventBus({ maxHistorySize: 2 })
      
      smallBus.emitToHandlers('event1', { type: 'event1', data: { value: 1 } })
      smallBus.emitToHandlers('event2', { type: 'event2', data: { value: 2 } })
      smallBus.emitToHandlers('event3', { type: 'event3', data: { value: 3 } })

      const history = smallBus.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0]).toEqual({ type: 'event2', data: { value: 2 } })
      expect(history[1]).toEqual({ type: 'event3', data: { value: 3 } })
    })

    it('应该提供清空历史记录功能', () => {
      bus.emit('event1', { type: 'event1', data: { value: 1 } })
      bus.emit('event2', { type: 'event2', data: { value: 2 } })

      bus.clearHistory()
      expect(bus.getHistory()).toHaveLength(0)
    })

    it('应该正确处理环形缓冲区', () => {
      const smallBus = new TypedEventBus({ maxHistorySize: 3 })
      
      smallBus.emitToHandlers('event1', { type: 'event1', data: { value: 1 } })
      smallBus.emitToHandlers('event2', { type: 'event2', data: { value: 2 } })
      smallBus.emitToHandlers('event3', { type: 'event3', data: { value: 3 } })
      smallBus.emitToHandlers('event4', { type: 'event4', data: { value: 4 } })
      smallBus.emitToHandlers('event5', { type: 'event5', data: { value: 5 } })

      const history = smallBus.getHistory()
      expect(history).toHaveLength(3)
      expect(history[0]).toEqual({ type: 'event3', data: { value: 3 } })
      expect(history[1]).toEqual({ type: 'event4', data: { value: 4 } })
      expect(history[2]).toEqual({ type: 'event5', data: { value: 5 } })
    })
  })

  describe('管理功能', () => {
    it('应该计算特定事件类型的监听器数量', () => {
      const handler = jest.fn()
      
      bus.on('event1', handler)
      bus.on('event1', handler)
      bus.on('event2', handler)
      bus.on('*', handler)

      expect(bus.listenerCount('event1')).toBe(3) // 2个event1 + 1个通配符
      expect(bus.listenerCount('event2')).toBe(2) // 1个event2 + 1个通配符
    })

    it('应该列出所有事件类型', () => {
      bus.on('event1', jest.fn())
      bus.on('event2', jest.fn())
      bus.on('event3', jest.fn())

      const types = bus.getEventTypes()
      expect(types).toContain('event1')
      expect(types).toContain('event2')
      expect(types).toContain('event3')
      expect(types).toHaveLength(3)
    })

    it('应该支持动态调整历史记录大小', () => {
      bus.emit('event1', { type: 'event1', data: { value: 1 } })
      bus.emit('event2', { type: 'event2', data: { value: 2 } })

      bus.resizeHistory(1)
      bus.emit('event3', { type: 'event3', data: { value: 3 } })

      const history = bus.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual({ type: 'event3', data: { value: 3 } })
    })

    it('应该保留调整大小时的历史数据', () => {
      const bus = new TypedEventBus({ maxHistorySize: 5 })
      
      bus.emit('event1', { type: 'event1', data: { value: 1 } })
      bus.emit('event2', { type: 'event2', data: { value: 2 } })
      bus.emit('event3', { type: 'event3', data: { value: 3 } })

      bus.resizeHistory(2)
      bus.emit('event4', { type: 'event4', data: { value: 4 } })

      const history = bus.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0]).toEqual({ type: 'event3', data: { value: 3 } })
      expect(history[1]).toEqual({ type: 'event4', data: { value: 4 } })
    })
  })

  describe('订阅管理', () => {
    it('应该支持取消订阅', () => {
      const handler = jest.fn()
      bus.on('test:event', handler)

      bus.emit('test:event', { type: 'test:event', data: { value: 1 } })
      expect(handler).toHaveBeenCalledTimes(1)

      bus.off('test:event', handler)
      bus.emit('test:event', { type: 'test:event', data: { value: 2 } })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('应该处理不存在的订阅取消', () => {
      expect(() => {
        bus.off('nonexistent', jest.fn())
      }).not.toThrow()
    })

    it('应该清空所有订阅', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      
      bus.on('event1', handler1)
      bus.on('event2', handler2)
      bus.on('*', handler1)

      bus.clear()
      
      bus.emit('event1', { type: 'event1', data: {} })
      bus.emit('event2', { type: 'event2', data: {} })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('边界情况', () => {
    it('应该处理空事件类型', () => {
      const handler = jest.fn()
      bus.on('', handler)
      
      bus.emit('', { type: '', data: { value: 1 } })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('应该处理null/undefined事件', () => {
      const handler = jest.fn()
      bus.on('test', handler)
      
      // @ts-ignore - 测试边界情况
      bus.emit('test', null)
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(null)
    })

    it('应该处理重复订阅', () => {
      const handler = jest.fn()
      
      bus.on('test', handler)
      bus.on('test', handler)
      
      bus.emit('test', { type: 'test', data: { value: 1 } })
      
      expect(handler).toHaveBeenCalledTimes(2) // 允许重复订阅，应该调用两次
    })
  })

  describe('内存泄漏防护', () => {
    it('应该清理所有资源', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      
      bus.on('event1', handler1)
      bus.on('event2', handler2)
      bus.on('*', handler1)

      bus.emit('event1', { type: 'event1', data: { value: 1 } })
      bus.emit('event2', { type: 'event2', data: { value: 2 } })

      expect(bus.listenerCount('event1')).toBeGreaterThan(0)
      expect(bus.listenerCount('event2')).toBeGreaterThan(0)

      bus.clear()

      expect(bus.listenerCount('event1')).toBe(0)
      expect(bus.listenerCount('event2')).toBe(0)
      expect(bus.getEventTypes()).toHaveLength(0)
    })
  })
})