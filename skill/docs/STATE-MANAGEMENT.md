# State Management System

状态管理系统为 ClawCompany 提供强大的状态持久化、快照和回滚能力。

## 功能特性

- ✅ **基本操作** - set/get/delete/clear
- ✅ **状态快照** - 创建、恢复、删除快照
- ✅ **状态回滚** - 回滚到任意历史版本
- ✅ **导入导出** - 序列化和反序列化状态
- ✅ **类型安全** - 完整的 TypeScript 支持
- ✅ **持久化** - 支持内存和文件存储

## 快速开始

### 基本使用

```typescript
import { StateManager } from 'clawcompany'

// 创建状态管理器
const state = new StateManager<string>()

// 基本操作
state.set('user', 'Alice')
state.set('count', 42)

console.log(state.get('user'))  // 'Alice'
console.log(state.has('count')) // true

state.delete('count')
console.log(state.has('count')) // false
```

### 状态快照

```typescript
// 创建快照
state.set('config', { theme: 'dark' })
const snapshotId = state.createSnapshot('初始配置', ['config'])

// 修改状态
state.set('config', { theme: 'light' })

// 恢复到快照
state.restoreSnapshot(snapshotId)
console.log(state.get('config')) // { theme: 'dark' }
```

### 状态回滚

```typescript
state.set('name', 'Alice')
state.set('name', 'Bob')
state.set('name', 'Charlie')

// 回滚到上一次变更
state.rollback()
console.log(state.get('name')) // 'Bob'

// 回滚多次
state.rollbackN(2)
console.log(state.get('name')) // undefined
```

### 导入导出

```typescript
// 导出状态
const exported = state.export()
// { state: {...}, snapshots: [...] }

// 导入状态
const newState = new StateManager()
newState.import(exported)
```

## API 参考

### StateManager

#### 构造函数

```typescript
new StateManager<T>(options?: StateManagerOptions)
```

**选项：**
- `persistence`: 'memory' | 'file' - 持久化类型
- `storagePath`: string - 文件存储路径
- `maxHistorySize`: number - 最大历史记录数 (默认 100)
- `maxSnapshots`: number - 最大快照数 (默认 50)
- `autoSaveInterval`: number - 自动保存间隔 (ms，0 禁用)

#### 方法

| 方法 | 描述 |
|------|------|
| `set(key, value)` | 设置状态值 |
| `get(key)` | 获取状态值 |
| `has(key)` | 检查状态是否存在 |
| `delete(key)` | 删除状态值 |
| `clear()` | 清空所有状态 |
| `keys()` | 获取所有键 |
| `values()` | 获取所有值 |
| `entries()` | 获取所有条目 |

#### 快照方法

| 方法 | 描述 |
|------|------|
| `createSnapshot(description?, tags?)` | 创建快照，返回快照 ID |
| `restoreSnapshot(snapshotId)` | 恢复到指定快照 |
| `getSnapshots()` | 获取所有快照 |
| `deleteSnapshot(snapshotId)` | 删除指定快照 |

#### 回滚方法

| 方法 | 描述 |
|------|------|
| `rollback()` | 回滚到上一次变更 |
| `rollbackN(n)` | 回滚 n 次变更 |
| `getHistory(limit?)` | 获取变更历史 |
| `clearHistory()` | 清空历史记录 |

#### 导入导出方法

| 方法 | 描述 |
|------|------|
| `export()` | 导出状态和快照 |
| `import(data)` | 导入状态和快照 |
| `destroy()` | 销毁管理器（保存状态） |

## 类型定义

```typescript
interface StateSnapshot<T> {
  id: string
  timestamp: string
  data: T
  metadata: {
    version: string
    description?: string
    tags?: string[]
  }
}

interface StateChange<T> {
  id: string
  key: string
  timestamp: string
  previousValue: T | undefined
  newValue: T
  operation: 'set' | 'delete' | 'clear'
}
```

## 使用场景

### 1. 工作流状态管理

```typescript
const workflowState = new StateManager<{
  status: string
  currentTask: string
  results: any[]
}>()

// 保存工作流状态
workflowState.set('status', 'running')
workflowState.createSnapshot('工作流开始')

// 更新状态
workflowState.set('currentTask', 'task-1')

// 出错时回滚
workflowState.rollback()
```

### 2. 用户会话管理

```typescript
const sessionState = new StateManager<UserSession>({
  persistence: 'file',
  storagePath: './sessions',
  autoSaveInterval: 30000  // 30秒自动保存
})

sessionState.set(sessionId, {
  userId: '123',
  lastActive: Date.now(),
  preferences: { theme: 'dark' }
})
```

### 3. 配置管理

```typescript
const configState = new StateManager<AppConfig>()

// 加载默认配置
configState.set('app', defaultConfig)
const initialConfig = configState.createSnapshot('默认配置')

// 用户修改配置
configState.set('app', userConfig)

// 恢复默认配置
configState.restoreSnapshot(initialConfig)
```

## 性能考虑

- **内存存储**: 适合临时状态，重启后丢失
- **文件存储**: 适合持久化状态，有 I/O 开销
- **快照数量**: 建议控制在 50 以内，避免内存占用过高
- **历史记录**: 建议控制在 100 条以内，避免内存占用过高

## 最佳实践

1. **及时创建快照**: 在重要操作前创建快照
2. **合理设置历史大小**: 根据实际需求调整 `maxHistorySize`
3. **使用类型参数**: 为 StateManager 指定明确的类型
4. **销毁时保存**: 使用 `destroy()` 确保状态保存
5. **标签分类**: 为快照添加标签便于管理

## 与 Workflow Engine 集成

```typescript
import { StateManager } from './state'
import { WorkflowEngine } from './workflow'

const state = new StateManager()
const engine = new WorkflowEngine(workflow, executor)

// 执行前保存状态
state.set('workflow', { status: 'running' })
state.createSnapshot('工作流开始')

// 执行工作流
const result = await engine.run()

// 保存结果
state.set('workflow', { 
  status: result.success ? 'completed' : 'failed',
  result 
})
```

---

*版本: 1.0.0*
*创建时间: 2026-03-21*
