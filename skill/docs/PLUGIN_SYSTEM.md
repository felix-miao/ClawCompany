# Plugin System - 插件系统文档

## 概述

ClawCompany 的插件系统允许开发者扩展和定制 AI 虚拟团队的功能。通过插件，您可以：
- 添加自定义任务处理逻辑
- 扩展 Agent 能力
- 集成外部服务
- 自定义工作流行为

## 快速开始

### 1. 创建一个简单的插件

```typescript
import { Plugin } from 'clawcompany'

const myPlugin: Plugin = {
  // 基本信息
  id: 'my-plugin',
  name: 'My First Plugin',
  version: '1.0.0',
  description: 'A simple example plugin',
  
  // 生命周期钩子
  onLoad: async (context) => {
    context.logger.log('Plugin loaded!')
  },
  
  onEnable: async (context) => {
    context.logger.log('Plugin enabled!')
    // 初始化插件状态
    context.api.setState('counter', 0)
  },
  
  onTaskStart: async (task, context) => {
    context.logger.log(`Starting task: ${task.title}`)
    // 增加计数器
    const counter = context.api.getState('counter') || 0
    context.api.setState('counter', counter + 1)
  },
  
  onTaskComplete: async (task, result, context) => {
    context.logger.log(`Task completed: ${task.title}`)
    context.logger.log(`Success: ${result.success}`)
  },
  
  onDisable: async (context) => {
    context.logger.log('Plugin disabled!')
    const counter = context.api.getState('counter')
    context.logger.log(`Total tasks processed: ${counter}`)
  }
}
```

### 2. 注册和使用插件

```typescript
import { ClawCompanyOrchestrator, PluginManager } from 'clawcompany'

// 创建 Orchestrator
const orchestrator = new ClawCompanyOrchestrator()

// 获取 PluginManager 实例
const pluginManager = new PluginManager()

// 注册插件
pluginManager.register(myPlugin)

// 启用插件
await pluginManager.enable('my-plugin')

// 执行任务（插件钩子会自动触发）
const result = await orchestrator.execute('创建一个登录页面')

// 禁用插件
await pluginManager.disable('my-plugin')
```

## 核心 API

### Plugin 接口

```typescript
interface Plugin extends PluginMetadata, PluginHooks {
  id: string  // 唯一标识符
}

interface PluginMetadata {
  name: string              // 插件名称
  version: string           // 版本号
  description?: string      // 描述
  author?: string          // 作者
  dependencies?: string[]  // 依赖的其他插件 ID
}
```

### 生命周期钩子

```typescript
interface PluginHooks {
  // 插件加载时（注册后立即调用）
  onLoad?: (context: PluginContext) => Promise<void> | void
  
  // 插件启用时
  onEnable?: (context: PluginContext) => Promise<void> | void
  
  // 插件禁用时
  onDisable?: (context: PluginContext) => Promise<void> | void
  
  // 插件卸载时（注销前调用）
  onUnload?: (context: PluginContext) => Promise<void> | void
  
  // 任务开始时
  onTaskStart?: (task: any, context: PluginContext) => Promise<void> | void
  
  // 任务完成时
  onTaskComplete?: (task: any, result: any, context: PluginContext) => Promise<void> | void
  
  // 任务出错时
  onTaskError?: (task: any, error: Error, context: PluginContext) => Promise<void> | void
}
```

### PluginContext

```typescript
interface PluginContext {
  logger: Console        // 日志记录器
  config: PluginConfig   // 插件配置
  api: PluginAPI        // 插件 API
}
```

### PluginAPI

```typescript
interface PluginAPI {
  // 状态管理（按插件 ID 隔离）
  getState: (key: string) => any
  setState: (key: string, value: any) => void
  
  // 事件系统（全局）
  emit: (event: string, data: any) => void
  on: (event: string, handler: (data: any) => void) => void
  off: (event: string, handler: (data: any) => void) => void
}
```

## 高级特性

### 插件依赖

插件可以声明依赖其他插件：

```typescript
const analyticsPlugin: Plugin = {
  id: 'analytics',
  name: 'Analytics Plugin',
  version: '1.0.0',
  dependencies: ['database'],  // 依赖 database 插件
  onEnable: async (context) => {
    // database 插件会自动被启用
    context.logger.log('Analytics ready!')
  }
}

// 注册顺序不重要，依赖会自动处理
pluginManager.register(analyticsPlugin)
pluginManager.register(databasePlugin)

// 启用 analytics 时，database 会自动启用
await pluginManager.enable('analytics')
```

### 插件配置

```typescript
// 注册插件时可以设置初始配置
pluginManager.register(configurablePlugin)

// 更新插件配置（会合并现有配置）
pluginManager.updateConfig('my-plugin', {
  theme: 'dark',
  language: 'zh'
})

// 获取配置
const config = pluginManager.getConfig('my-plugin')
console.log(config.settings.theme)  // 'dark'
```

### 事件系统

插件之间可以通过事件系统通信：

```typescript
// 插件 A：发送事件
const pluginA: Plugin = {
  id: 'plugin-a',
  onTaskComplete: async (task, result, context) => {
    // 发送事件
    context.api.emit('task:completed', {
      taskId: task.id,
      duration: result.duration
    })
  }
}

// 插件 B：监听事件
const pluginB: Plugin = {
  id: 'plugin-b',
  onEnable: async (context) => {
    context.api.on('task:completed', (data) => {
      context.logger.log(`Task ${data.taskId} took ${data.duration}ms`)
    })
  }
}
```

### 状态管理

每个插件都有独立的状态存储：

```typescript
const statefulPlugin: Plugin = {
  id: 'stateful',
  onEnable: async (context) => {
    // 存储状态
    context.api.setState('totalTasks', 0)
    context.api.setState('config', { debug: true })
  },
  
  onTaskStart: async (task, context) => {
    // 读取状态
    const total = context.api.getState('totalTasks') || 0
    const config = context.api.getState('config')
    
    // 更新状态
    context.api.setState('totalTasks', total + 1)
    
    if (config.debug) {
      context.logger.log('Debug mode enabled')
    }
  }
}
```

## 实际示例

### 示例 1：性能监控插件

```typescript
const performancePlugin: Plugin = {
  id: 'performance-monitor',
  name: 'Performance Monitor',
  version: '1.0.0',
  
  onEnable: async (context) => {
    context.api.setState('metrics', [])
  },
  
  onTaskStart: async (task, context) => {
    context.api.setState(`startTime:${task.id}`, Date.now())
  },
  
  onTaskComplete: async (task, result, context) => {
    const startTime = context.api.getState(`startTime:${task.id}`)
    const duration = Date.now() - startTime
    
    const metrics = context.api.getState('metrics') || []
    metrics.push({
      taskId: task.id,
      duration,
      success: result.success
    })
    context.api.setState('metrics', metrics)
    
    // 发送性能事件
    context.api.emit('performance:metric', {
      taskId: task.id,
      duration
    })
  },
  
  onDisable: async (context) => {
    const metrics = context.api.getState('metrics')
    const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
    
    context.logger.log(`Average task duration: ${avgDuration}ms`)
    context.logger.log(`Total tasks: ${metrics.length}`)
  }
}
```

### 示例 2：通知插件

```typescript
const notificationPlugin: Plugin = {
  id: 'notifications',
  name: 'Notification System',
  version: '1.0.0',
  
  onEnable: async (context) => {
    // 监听任务完成事件
    context.api.on('task:completed', (data) => {
      // 这里可以集成邮件、Slack、钉钉等
      context.logger.log(`📢 Task completed: ${data.taskId}`)
    })
    
    // 监听性能事件
    context.api.on('performance:metric', (data) => {
      if (data.duration > 5000) {
        context.logger.warn(`⚠️ Slow task detected: ${data.taskId} (${data.duration}ms)`)
      }
    })
  }
}
```

### 示例 3：Git 集成插件

```typescript
import { execSync } from 'child_process'

const gitPlugin: Plugin = {
  id: 'git-integration',
  name: 'Git Integration',
  version: '1.0.0',
  
  onTaskComplete: async (task, result, context) => {
    if (result.success && result.filesChanged) {
      try {
        // 自动提交
        execSync('git add .')
        execSync(`git commit -m "feat: ${task.title}"`)
        
        context.logger.log('✅ Changes committed to Git')
        
        // 通知其他插件
        context.api.emit('git:committed', {
          taskId: task.id,
          message: `feat: ${task.title}`
        })
      } catch (error) {
        context.logger.error('Failed to commit changes:', error)
      }
    }
  }
}
```

## PluginManager API

### 方法列表

```typescript
class PluginManager {
  // 注册插件
  register(plugin: Plugin): void
  
  // 注销插件
  unregister(pluginId: string): Promise<void>
  
  // 启用插件
  enable(pluginId: string): Promise<void>
  
  // 禁用插件
  disable(pluginId: string): Promise<void>
  
  // 获取插件
  getPlugin(pluginId: string): Plugin | undefined
  
  // 获取所有插件
  getAllPlugins(): Plugin[]
  
  // 获取启用的插件
  getEnabledPlugins(): Plugin[]
  
  // 检查插件是否启用
  isEnabled(pluginId: string): boolean
  
  // 获取插件配置
  getConfig(pluginId: string): PluginConfig | undefined
  
  // 更新插件配置
  updateConfig(pluginId: string, settings: Record<string, any>): void
  
  // 触发钩子
  triggerHook(hookName: string, ...args: any[]): Promise<void>
  
  // 事件系统
  on(event: string, handler: (data: any) => void): void
  off(event: string, handler: (data: any) => void): void
  emit(event: string, data: any): void
}
```

## 最佳实践

### 1. 错误处理

```typescript
const robustPlugin: Plugin = {
  id: 'robust',
  onTaskStart: async (task, context) => {
    try {
      // 可能出错的操作
      await riskyOperation()
    } catch (error) {
      context.logger.error('Operation failed:', error)
      // 不要抛出错误，避免影响其他插件
    }
  }
}
```

### 2. 清理资源

```typescript
const resourcePlugin: Plugin = {
  id: 'resource',
  onEnable: async (context) => {
    // 初始化资源
    const timer = setInterval(() => {}, 1000)
    context.api.setState('timer', timer)
  },
  
  onDisable: async (context) => {
    // 清理资源
    const timer = context.api.getState('timer')
    if (timer) {
      clearInterval(timer)
    }
  }
}
```

### 3. 依赖管理

```typescript
const dependentPlugin: Plugin = {
  id: 'dependent',
  dependencies: ['base-plugin'],
  onEnable: async (context) => {
    // 依赖已自动启用，可以安全使用
    context.logger.log('Dependencies satisfied!')
  }
}
```

### 4. 配置验证

```typescript
const configurablePlugin: Plugin = {
  id: 'configurable',
  onEnable: async (context) => {
    const config = context.config.settings
    
    // 验证配置
    if (!config.apiKey) {
      throw new Error('API key is required')
    }
    
    if (config.timeout && config.timeout < 0) {
      throw new Error('Timeout must be positive')
    }
  }
}
```

## 测试插件

```typescript
import { PluginManager, Plugin } from 'clawcompany'

describe('My Plugin', () => {
  let manager: PluginManager
  
  beforeEach(() => {
    manager = new PluginManager({ autoLoad: false })
  })
  
  test('should process tasks', async () => {
    const plugin: Plugin = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      onTaskStart: jest.fn()
    }
    
    manager.register(plugin)
    await manager.enable('test')
    
    await manager.triggerHook('onTaskStart', { id: 'task-1' })
    
    expect(plugin.onTaskStart).toHaveBeenCalled()
  })
})
```

## 发布插件

1. 创建独立的 npm 包或包含在项目中
2. 提供清晰的 README 和文档
3. 包含类型定义（TypeScript）
4. 编写测试用例
5. 遵循语义化版本控制

## 调试技巧

```typescript
const debugPlugin: Plugin = {
  id: 'debug',
  onEnable: async (context) => {
    // 启用详细日志
    if (context.config.settings.debug) {
      context.api.on('performance:metric', (data) => {
        console.log('[DEBUG] Performance:', data)
      })
    }
  },
  
  onTaskStart: async (task, context) => {
    if (context.config.settings.debug) {
      console.log('[DEBUG] Task starting:', task)
    }
  }
}
```

## 常见问题

### Q: 插件之间如何共享数据？
A: 使用事件系统（`emit`/`on`）进行通信，避免直接耦合。

### Q: 如何确保插件加载顺序？
A: 使用 `dependencies` 声明依赖，PluginManager 会自动处理加载顺序。

### Q: 插件可以修改任务结果吗？
A: 可以，但建议通过事件系统通知其他插件，而不是直接修改结果。

### Q: 如何处理插件冲突？
A: 使用命名空间隔离状态（如 `plugin-id:key`），通过事件系统协调。

## 下一步

- 查看 [Workflow Engine 文档](./WORKFLOW_ENGINE.md)
- 了解 [State Management](./STATE_MANAGEMENT.md)
- 阅读 [API Reference](./API_REFERENCE.md)

---

*最后更新: 2026-03-21*
*版本: 1.0.0*
