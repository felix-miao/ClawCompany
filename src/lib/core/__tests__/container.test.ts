import { Container, ScopedContainer } from '../container'

describe('Container', () => {
  let container: Container

  beforeEach(() => {
    container = new Container()
  })

  describe('register and resolve', () => {
    it('应该注册并解析单例服务', () => {
      container.register('ServiceA', () => ({ name: 'A' }))

      const instance = container.resolve<{ name: string }>('ServiceA')
      expect(instance).toEqual({ name: 'A' })
    })

    it('单例服务应该返回同一实例', () => {
      container.register('Singleton', () => ({ id: Math.random() }))

      const a = container.resolve<{ id: number }>('Singleton')
      const b = container.resolve<{ id: number }>('Singleton')

      expect(a).toBe(b)
    })

    it('transient 服务应该每次返回新实例', () => {
      container.register('Transient', () => ({ id: Math.random() }), false)

      const a = container.resolve<{ id: number }>('Transient')
      const b = container.resolve<{ id: number }>('Transient')

      expect(a).not.toBe(b)
    })

    it('应该支持 Symbol 作为 token', () => {
      const token = Symbol('MyService')
      container.register(token, () => 'symbol-service')

      expect(container.resolve(token)).toBe('symbol-service')
    })

    it('未注册的服务应该抛出错误', () => {
      expect(() => container.resolve('Unknown')).toThrow(
        'Service not registered: Unknown'
      )
    })

    it('factory 应该接收 container 参数用于依赖注入', () => {
      container.register('Config', () => ({ apiUrl: 'http://test' }))
      container.register('Client', (c) => {
        const config = c.resolve<{ apiUrl: string }>('Config')
        return { baseUrl: config.apiUrl }
      })

      const client = container.resolve<{ baseUrl: string }>('Client')
      expect(client.baseUrl).toBe('http://test')
    })
  })

  describe('registerInstance', () => {
    it('应该注册已有实例', () => {
      const instance = { value: 42 }
      container.registerInstance('Existing', instance)

      expect(container.resolve('Existing')).toBe(instance)
    })

    it('注册的实例应该是单例', () => {
      const obj = { count: 0 }
      container.registerInstance('Obj', obj)

      const a = container.resolve('Obj')
      const b = container.resolve('Obj')

      expect(a).toBe(b)
      expect(a).toBe(obj)
    })

    it('应该覆盖之前的注册', () => {
      container.register('Service', () => 'old')
      container.registerInstance('Service', 'new')

      expect(container.resolve('Service')).toBe('new')
    })
  })

  describe('circular dependency detection', () => {
    it('应该检测直接循环依赖', () => {
      container.register('A', (c) => c.resolve('B'))
      container.register('B', (c) => c.resolve('A'))

      expect(() => container.resolve('A')).toThrow(
        'Circular dependency detected'
      )
    })

    it('应该检测间接循环依赖 A -> B -> C -> A', () => {
      container.register('A', (c) => c.resolve('B'))
      container.register('B', (c) => c.resolve('C'))
      container.register('C', (c) => c.resolve('A'))

      expect(() => container.resolve('A')).toThrow(
        'Circular dependency detected: A'
      )
    })

    it('非循环依赖链不应该抛出错误', () => {
      container.register('A', () => 'value-a')
      container.register('B', (c) => `b-${c.resolve('A')}`)
      container.register('C', (c) => `c-${c.resolve('B')}`)

      expect(container.resolve('C')).toBe('c-b-value-a')
    })

    it('循环检测后 resolving 集合应该被清理', () => {
      container.register('Self', (c) => c.resolve('Self'))

      expect(() => container.resolve('Self')).toThrow()

      container.register('Normal', () => 'ok')
      expect(container.resolve('Normal')).toBe('ok')
    })
  })

  describe('tryResolve', () => {
    it('已注册服务应该返回实例', () => {
      container.register('Service', () => 'value')
      expect(container.tryResolve('Service')).toBe('value')
    })

    it('未注册服务应该返回 undefined', () => {
      expect(container.tryResolve('Unknown')).toBeUndefined()
    })

    it('解析失败应该返回 undefined', () => {
      container.register('Broken', () => {
        throw new Error('factory error')
      })

      expect(container.tryResolve('Broken')).toBeUndefined()
    })
  })

  describe('has', () => {
    it('已注册服务应该返回 true', () => {
      container.register('Service', () => 'value')
      expect(container.has('Service')).toBe(true)
    })

    it('未注册服务应该返回 false', () => {
      expect(container.has('Unknown')).toBe(false)
    })

    it('支持 Symbol token', () => {
      const sym = Symbol('test')
      container.register(sym, () => 'value')
      expect(container.has(sym)).toBe(true)
    })
  })

  describe('reset', () => {
    it('reset 后应该重新创建实例', () => {
      let callCount = 0
      container.register('Service', () => {
        callCount++
        return { id: callCount }
      })

      const first = container.resolve<{ id: number }>('Service')
      expect(first.id).toBe(1)

      container.reset('Service')

      const second = container.resolve<{ id: number }>('Service')
      expect(second.id).toBe(2)
      expect(first).not.toBe(second)
    })

    it('reset 不存在的服务不应该抛出错误', () => {
      expect(() => container.reset('Unknown')).not.toThrow()
    })

    it('reset 不应该移除注册', () => {
      container.register('Service', () => 'value')
      container.resolve('Service')
      container.reset('Service')

      expect(container.has('Service')).toBe(true)
      expect(container.resolve('Service')).toBe('value')
    })
  })

  describe('resetAll', () => {
    it('应该重置所有服务实例', () => {
      let countA = 0
      let countB = 0

      container.register('A', () => ({ id: ++countA }))
      container.register('B', () => ({ id: ++countB }))

      container.resolve('A')
      container.resolve('B')

      container.resetAll()

      const a = container.resolve<{ id: number }>('A')
      const b = container.resolve<{ id: number }>('B')

      expect(a.id).toBe(2)
      expect(b.id).toBe(2)
    })
  })

  describe('createScope', () => {
    it('应该返回 ScopedContainer 实例', () => {
      const scope = container.createScope()
      expect(scope).toBeInstanceOf(ScopedContainer)
    })

    it('scope 应该能解析父容器的服务', () => {
      container.register('Service', () => 'from-parent')
      const scope = container.createScope()

      expect(scope.resolve('Service')).toBe('from-parent')
    })

    it('scope 应该能覆盖父容器的服务', () => {
      container.register('Service', () => 'from-parent')
      const scope = container.createScope()
      scope.override('Service', 'from-scope')

      expect(scope.resolve('Service')).toBe('from-scope')
      expect(container.resolve('Service')).toBe('from-parent')
    })

    it('scope 的覆盖不应该影响其他 scope', () => {
      container.register('Service', () => 'original')

      const scope1 = container.createScope()
      const scope2 = container.createScope()

      scope1.override('Service', 'scope1-value')

      expect(scope1.resolve('Service')).toBe('scope1-value')
      expect(scope2.resolve('Service')).toBe('original')
    })

    it('scope.tryResolve 应该返回 undefined 对未注册服务', () => {
      const scope = container.createScope()
      expect(scope.tryResolve('Unknown')).toBeUndefined()
    })

    it('scope.tryResolve 应该返回覆盖值', () => {
      const scope = container.createScope()
      scope.override('Service', 'overridden')
      expect(scope.tryResolve('Service')).toBe('overridden')
    })

    it('scope.tryResolve 应该回退到父容器', () => {
      container.register('Service', () => 'from-parent')
      const scope = container.createScope()
      expect(scope.tryResolve('Service')).toBe('from-parent')
    })
  })
})
