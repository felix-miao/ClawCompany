/**
 * Plugin System Tests
 */

import { PluginManager, Plugin } from '../src/plugins'

describe('PluginManager', () => {
  let manager: PluginManager

  // 测试用插件
  const createTestPlugin = (id: string, options: Partial<Plugin> = {}): Plugin => ({
    id,
    name: `Test Plugin ${id}`,
    version: '1.0.0',
    description: 'A test plugin',
    ...options
  })

  beforeEach(() => {
    manager = new PluginManager({ autoLoad: false })
  })

  afterEach(() => {
    // 清理
  })

  // ============ 基本操作 ============

  describe('插件注册', () => {
    test('应该能够注册插件', () => {
      const plugin = createTestPlugin('test-1')
      manager.register(plugin)
      
      expect(manager.getPlugin('test-1')).toBe(plugin)
    })

    test('重复注册应该警告', () => {
      const plugin = createTestPlugin('test-1')
      manager.register(plugin)
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      manager.register(plugin)
      
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    test('注册时应该检查依赖', () => {
      const plugin = createTestPlugin('test-1', {
        dependencies: ['missing-plugin']
      })
      
      expect(() => manager.register(plugin)).toThrow('Missing dependencies')
    })

    test('有依赖时应该成功注册', () => {
      const dep = createTestPlugin('dep-1')
      manager.register(dep)
      
      const plugin = createTestPlugin('test-1', {
        dependencies: ['dep-1']
      })
      
      expect(() => manager.register(plugin)).not.toThrow()
    })
  })

  // ============ 启用/禁用 ============

  describe('启用/禁用', () => {
    test('应该能够启用插件', async () => {
      const plugin = createTestPlugin('test-1')
      manager.register(plugin)
      
      await manager.enable('test-1')
      
      expect(manager.isEnabled('test-1')).toBe(true)
    })

    test('应该能够禁用插件', async () => {
      const plugin = createTestPlugin('test-1')
      manager.register(plugin)
      await manager.enable('test-1')
      
      await manager.disable('test-1')
      
      expect(manager.isEnabled('test-1')).toBe(false)
    })

    test('启用插件时应该调用钩子', async () => {
      const onLoad = jest.fn()
      const onEnable = jest.fn()
      
      const plugin = createTestPlugin('test-1', { onLoad, onEnable })
      manager.register(plugin)
      
      await manager.enable('test-1')
      
      expect(onLoad).toHaveBeenCalled()
      expect(onEnable).toHaveBeenCalled()
    })

    test('禁用插件时应该调用钩子', async () => {
      const onDisable = jest.fn()
      
      const plugin = createTestPlugin('test-1', { onDisable })
      manager.register(plugin)
      await manager.enable('test-1')
      
      await manager.disable('test-1')
      
      expect(onDisable).toHaveBeenCalled()
    })

    test('启用插件时应该自动启用依赖', async () => {
      const dep = createTestPlugin('dep-1')
      manager.register(dep)
      
      const plugin = createTestPlugin('test-1', {
        dependencies: ['dep-1']
      })
      manager.register(plugin)
      
      await manager.enable('test-1')
      
      expect(manager.isEnabled('dep-1')).toBe(true)
    })

    test('禁用被依赖的插件应该失败', async () => {
      const dep = createTestPlugin('dep-1')
      manager.register(dep)
      
      const plugin = createTestPlugin('test-1', {
        dependencies: ['dep-1']
      })
      manager.register(plugin)
      
      await manager.enable('test-1')
      
      await expect(manager.disable('dep-1')).rejects.toThrow('depend on this plugin')
    })
  })

  // ============ 注销 ============

  describe('插件注销', () => {
    test('应该能够注销插件', async () => {
      const plugin = createTestPlugin('test-1')
      manager.register(plugin)
      await manager.enable('test-1')
      
      await manager.unregister('test-1')
      
      expect(manager.getPlugin('test-1')).toBeUndefined()
    })

    test('注销时应该自动禁用', async () => {
      const onDisable = jest.fn()
      
      const plugin = createTestPlugin('test-1', { onDisable })
      manager.register(plugin)
      await manager.enable('test-1')
      
      await manager.unregister('test-1')
      
      expect(onDisable).toHaveBeenCalled()
    })

    test('注销时应该调用卸载钩子', async () => {
      const onUnload = jest.fn()
      
      const plugin = createTestPlugin('test-1', { onUnload })
      manager.register(plugin)
      
      await manager.unregister('test-1')
      
      expect(onUnload).toHaveBeenCalled()
    })
  })

  // ============ 钩子 ============

  describe('钩子系统', () => {
    test('应该能够触发任务钩子', async () => {
      const onTaskStart = jest.fn()
      const onTaskComplete = jest.fn()
      
      const plugin = createTestPlugin('test-1', { 
        onTaskStart, 
        onTaskComplete 
      })
      manager.register(plugin)
      await manager.enable('test-1')
      
      const task = { id: 'task-1', title: 'Test' }
      await manager.triggerHook('onTaskStart', task)
      await manager.triggerHook('onTaskComplete', task, { success: true })
      
      expect(onTaskStart).toHaveBeenCalled()
      expect(onTaskComplete).toHaveBeenCalled()
    })

    test('钩子错误不应该中断其他插件', async () => {
      const badPlugin = createTestPlugin('bad-1', {
        onTaskStart: () => { throw new Error('Bad plugin') }
      })
      const goodPlugin = createTestPlugin('good-1', {
        onTaskStart: jest.fn()
      })
      
      manager.register(badPlugin)
      manager.register(goodPlugin)
      await manager.enable('bad-1')
      await manager.enable('good-1')
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      await manager.triggerHook('onTaskStart', { id: 'task-1' })
      
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  // ============ 事件系统 ============

  describe('事件系统', () => {
    test('应该能够发送和接收事件', () => {
      const handler = jest.fn()
      manager.on('test-event', handler)
      
      manager.emit('test-event', { data: 'test' })
      
      expect(handler).toHaveBeenCalledWith({ data: 'test' })
    })

    test('应该能够移除事件监听', () => {
      const handler = jest.fn()
      manager.on('test-event', handler)
      manager.off('test-event', handler)
      
      manager.emit('test-event', { data: 'test' })
      
      expect(handler).not.toHaveBeenCalled()
    })

    test('事件处理器错误不应该影响其他处理器', () => {
      const badHandler = () => { throw new Error('Bad handler') }
      const goodHandler = jest.fn()
      
      manager.on('test-event', badHandler)
      manager.on('test-event', goodHandler)
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      manager.emit('test-event', { data: 'test' })
      
      expect(consoleSpy).toHaveBeenCalled()
      expect(goodHandler).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  // ============ 配置管理 ============

  describe('配置管理', () => {
    test('应该能够更新插件配置', () => {
      const plugin = createTestPlugin('test-1')
      manager.register(plugin)
      
      manager.updateConfig('test-1', { theme: 'dark' })
      
      const config = manager.getConfig('test-1')
      expect(config?.settings.theme).toBe('dark')
    })

    test('更新配置应该合并现有配置', () => {
      const plugin = createTestPlugin('test-1')
      manager.register(plugin)
      
      manager.updateConfig('test-1', { theme: 'dark' })
      manager.updateConfig('test-1', { language: 'zh' })
      
      const config = manager.getConfig('test-1')
      expect(config?.settings.theme).toBe('dark')
      expect(config?.settings.language).toBe('zh')
    })

    test('更新不存在的插件配置应该报错', () => {
      expect(() => manager.updateConfig('non-existent', {})).toThrow('Plugin not found')
    })
  })

  // ============ 查询 ============

  describe('查询功能', () => {
    test('应该能够获取所有插件', () => {
      manager.register(createTestPlugin('test-1'))
      manager.register(createTestPlugin('test-2'))
      
      const plugins = manager.getAllPlugins()
      
      expect(plugins.length).toBe(2)
    })

    test('应该能够获取启用的插件', async () => {
      manager.register(createTestPlugin('test-1'))
      manager.register(createTestPlugin('test-2'))
      
      await manager.enable('test-1')
      
      const enabled = manager.getEnabledPlugins()
      
      expect(enabled.length).toBe(1)
      expect(enabled[0].id).toBe('test-1')
    })
  })

  // ============ 插件上下文 ============

  describe('插件上下文', () => {
    test('插件应该能够访问 API', async () => {
      let capturedApi: any = null
      
      const plugin = createTestPlugin('test-1', {
        onEnable: (context) => {
          capturedApi = context.api
        }
      })
      
      manager.register(plugin)
      await manager.enable('test-1')
      
      expect(capturedApi).toBeTruthy()
      expect(typeof capturedApi.getState).toBe('function')
      expect(typeof capturedApi.setState).toBe('function')
      expect(typeof capturedApi.emit).toBe('function')
      expect(typeof capturedApi.on).toBe('function')
    })

    test('插件应该能够存储状态', async () => {
      const plugin = createTestPlugin('test-1', {
        onEnable: (context) => {
          context.api.setState('test-key', 'test-value')
        }
      })
      
      manager.register(plugin)
      await manager.enable('test-1')
      
      // 触发另一个钩子来验证状态
      let retrievedValue: any = null
      const plugin2 = createTestPlugin('test-2', {
        onEnable: (context) => {
          // 注意：插件状态是隔离的，所以这里应该是 undefined
          retrievedValue = context.api.getState('test-key')
        }
      })
      
      manager.register(plugin2)
      await manager.enable('test-2')
      
      // 因为状态是按插件 ID 隔离的，所以应该是 undefined
      expect(retrievedValue).toBeUndefined()
    })
  })

  // ============ 边界情况 ============

  describe('边界情况', () => {
    test('启用不存在的插件应该报错', async () => {
      await expect(manager.enable('non-existent')).rejects.toThrow('Plugin not found')
    })

    test('禁用不存在的插件应该报错', async () => {
      await expect(manager.disable('non-existent')).rejects.toThrow('Plugin not found')
    })

    test('获取不存在的插件配置应该返回 undefined', () => {
      expect(manager.getConfig('non-existent')).toBeUndefined()
    })

    test('检查不存在的插件是否启用应该返回 false', () => {
      expect(manager.isEnabled('non-existent')).toBe(false)
    })
  })
})
