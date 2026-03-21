/**
 * Plugin System - 插件系统
 * 
 * 功能：
 * - 插件注册和加载
 * - 生命周期钩子
 * - 插件依赖管理
 * - 插件配置
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * 插件元数据
 */
export interface PluginMetadata {
  name: string
  version: string
  description?: string
  author?: string
  dependencies?: string[]
}

/**
 * 插件配置
 */
export interface PluginConfig {
  enabled: boolean
  settings: Record<string, any>
}

/**
 * 插件上下文
 */
export interface PluginContext {
  logger: Console
  config: PluginConfig
  api: PluginAPI
}

/**
 * 插件 API
 */
export interface PluginAPI {
  getState: (key: string) => any
  setState: (key: string, value: any) => void
  emit: (event: string, data: any) => void
  on: (event: string, handler: (data: any) => void) => void
  off: (event: string, handler: (data: any) => void) => void
}

/**
 * 插件生命周期钩子
 */
export interface PluginHooks {
  onLoad?: (context: PluginContext) => Promise<void> | void
  onEnable?: (context: PluginContext) => Promise<void> | void
  onDisable?: (context: PluginContext) => Promise<void> | void
  onUnload?: (context: PluginContext) => Promise<void> | void
  onTaskStart?: (task: any, context: PluginContext) => Promise<void> | void
  onTaskComplete?: (task: any, result: any, context: PluginContext) => Promise<void> | void
  onTaskError?: (task: any, error: Error, context: PluginContext) => Promise<void> | void
}

/**
 * 插件接口
 */
export interface Plugin extends PluginMetadata, PluginHooks {
  id: string
}

/**
 * 插件管理器配置
 */
export interface PluginManagerOptions {
  pluginsDir?: string
  autoLoad?: boolean
}

/**
 * 插件管理器
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map()
  private configs: Map<string, PluginConfig> = new Map()
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map()
  private state: Map<string, any> = new Map()
  private pluginsDir: string

  constructor(options: PluginManagerOptions = {}) {
    this.pluginsDir = options.pluginsDir || './plugins'
    
    if (options.autoLoad !== false) {
      this.loadAllPlugins()
    }
  }

  /**
   * 注册插件
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`⚠️ 插件已存在: ${plugin.id}`)
      return
    }

    // 检查依赖
    if (plugin.dependencies?.length) {
      const missing = plugin.dependencies.filter(dep => !this.plugins.has(dep))
      if (missing.length > 0) {
        console.error(`❌ 插件 ${plugin.id} 缺少依赖: ${missing.join(', ')}`)
        throw new Error(`Missing dependencies: ${missing.join(', ')}`)
      }
    }

    this.plugins.set(plugin.id, plugin)
    this.configs.set(plugin.id, { enabled: false, settings: {} })
    console.log(`✅ 注册插件: ${plugin.name} v${plugin.version}`)
  }

  /**
   * 注销插件
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      console.warn(`⚠️ 插件不存在: ${pluginId}`)
      return
    }

    // 先禁用
    if (this.isEnabled(pluginId)) {
      await this.disable(pluginId)
    }

    // 调用卸载钩子
    if (plugin.onUnload) {
      await plugin.onUnload(this.createContext(pluginId))
    }

    this.plugins.delete(pluginId)
    this.configs.delete(pluginId)
    console.log(`🗑️ 注销插件: ${plugin.name}`)
  }

  /**
   * 启用插件
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    const config = this.configs.get(pluginId)!
    if (config.enabled) {
      console.warn(`⚠️ 插件已启用: ${pluginId}`)
      return
    }

    // 启用依赖
    if (plugin.dependencies?.length) {
      for (const dep of plugin.dependencies) {
        if (!this.isEnabled(dep)) {
          await this.enable(dep)
        }
      }
    }

    // 调用加载钩子
    if (plugin.onLoad) {
      await plugin.onLoad(this.createContext(pluginId))
    }

    // 调用启用钩子
    if (plugin.onEnable) {
      await plugin.onEnable(this.createContext(pluginId))
    }

    config.enabled = true
    console.log(`🟢 启用插件: ${plugin.name}`)
  }

  /**
   * 禁用插件
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    const config = this.configs.get(pluginId)!
    if (!config.enabled) {
      console.warn(`⚠️ 插件已禁用: ${pluginId}`)
      return
    }

    // 检查是否有其他插件依赖此插件
    const dependents = this.getDependents(pluginId)
    if (dependents.length > 0) {
      throw new Error(`Cannot disable: ${dependents.join(', ')} depend on this plugin`)
    }

    // 调用禁用钩子
    if (plugin.onDisable) {
      await plugin.onDisable(this.createContext(pluginId))
    }

    config.enabled = false
    console.log(`🔴 禁用插件: ${plugin.name}`)
  }

  /**
   * 检查插件是否启用
   */
  isEnabled(pluginId: string): boolean {
    const config = this.configs.get(pluginId)
    return config?.enabled ?? false
  }

  /**
   * 获取插件
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取启用的插件
   */
  getEnabledPlugins(): Plugin[] {
    return this.getAllPlugins().filter(p => this.isEnabled(p.id))
  }

  /**
   * 更新插件配置
   */
  updateConfig(pluginId: string, settings: Record<string, any>): void {
    const config = this.configs.get(pluginId)
    if (!config) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }
    config.settings = { ...config.settings, ...settings }
    console.log(`⚙️ 更新插件配置: ${pluginId}`)
  }

  /**
   * 获取插件配置
   */
  getConfig(pluginId: string): PluginConfig | undefined {
    return this.configs.get(pluginId)
  }

  /**
   * 触发钩子
   */
  async triggerHook<K extends keyof PluginHooks>(
    hookName: K,
    ...args: any[]
  ): Promise<void> {
    const enabledPlugins = this.getEnabledPlugins()
    
    for (const plugin of enabledPlugins) {
      const hook = (plugin as any)[hookName]
      if (typeof hook === 'function') {
        try {
          const context = this.createContext(plugin.id)
          // 根据钩子类型传递正确的参数
          if (hookName === 'onLoad' || hookName === 'onEnable' || 
              hookName === 'onDisable' || hookName === 'onUnload') {
            await hook(context)
          } else if (hookName === 'onTaskStart') {
            await hook(args[0], context)
          } else if (hookName === 'onTaskComplete') {
            await hook(args[0], args[1], context)
          } else if (hookName === 'onTaskError') {
            await hook(args[0], args[1], context)
          }
        } catch (error) {
          console.error(`❌ 插件 ${plugin.id} 钩子 ${hookName} 执行失败:`, error)
        }
      }
    }
  }

  /**
   * 发送事件
   */
  emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`❌ 事件处理器执行失败:`, error)
        }
      })
    }
  }

  /**
   * 监听事件
   */
  on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * 移除事件监听
   */
  off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * 从文件加载插件
   */
  async loadPluginFromFile(pluginPath: string): Promise<void> {
    try {
      // 动态导入插件
      const pluginModule = require(pluginPath)
      const plugin = pluginModule.default || pluginModule
      
      if (!plugin.id || !plugin.name) {
        throw new Error('Invalid plugin: missing id or name')
      }
      
      this.register(plugin)
      
      // 自动启用
      await this.enable(plugin.id)
    } catch (error) {
      console.error(`❌ 加载插件失败: ${pluginPath}`, error)
    }
  }

  /**
   * 加载所有插件
   */
  async loadAllPlugins(): Promise<void> {
    if (!fs.existsSync(this.pluginsDir)) {
      console.log(`📁 插件目录不存在: ${this.pluginsDir}`)
      return
    }

    const files = fs.readdirSync(this.pluginsDir)
    
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.ts')) {
        const pluginPath = path.join(this.pluginsDir, file)
        await this.loadPluginFromFile(pluginPath)
      }
    }
  }

  // ============ 私有方法 ============

  private createContext(pluginId: string): PluginContext {
    const self = this
    return {
      logger: console,
      config: this.configs.get(pluginId) || { enabled: false, settings: {} },
      api: {
        getState: (key) => self.state.get(`${pluginId}:${key}`),
        setState: (key, value) => self.state.set(`${pluginId}:${key}`, value),
        emit: (event, data) => self.emit(`${pluginId}:${event}`, data),
        on: (event, handler) => self.on(`${pluginId}:${event}`, handler),
        off: (event, handler) => self.off(`${pluginId}:${event}`, handler)
      }
    }
  }

  private getDependents(pluginId: string): string[] {
    const dependents: string[] = []
    for (const [id, plugin] of this.plugins) {
      if (plugin.dependencies?.includes(pluginId)) {
        dependents.push(id)
      }
    }
    return dependents
  }
}

// 导出类型和类
export default PluginManager
