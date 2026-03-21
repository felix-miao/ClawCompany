# Workflow Engine - 工作流引擎

## 概述

工作流引擎是 ClawCompany Priority 2 的核心功能，提供高级任务编排能力。

## 核心特性

### 1. 任务依赖图

支持复杂的任务依赖关系，自动解析执行顺序：

```typescript
const workflow = new WorkflowBuilder()
  .addNode('task-1', task1, { dependencies: [] })
  .addNode('task-2', task2, { dependencies: ['task-1'] })
  .addNode('task-3', task3, { dependencies: ['task-1'] })
  .addNode('task-4', task4, { dependencies: ['task-2', 'task-3'] })
  .build('复杂依赖图')
```

### 2. 并行执行

独立任务自动并行执行，提高效率：

```typescript
const engine = new WorkflowEngine(workflow, executor, {
  maxConcurrency: 8  // 最多同时执行 8 个任务
})
```

**优势：**
- 任务 2 和任务 3 依赖任务 1，但它们之间没有依赖
- 引擎会自动识别并并行执行
- 执行时间从 300ms 降低到 200ms（示例）

### 3. 条件分支

根据运行时条件决定是否执行任务：

```typescript
.addNode('advanced-feature', task, {
  dependencies: ['base-feature'],
  condition: (context) => context.variables.enableAdvanced === true
})
```

**应用场景：**
- A/B 测试：根据配置执行不同路径
- 可选功能：根据用户设置跳过某些任务
- 环境差异：开发/生产环境执行不同逻辑

### 4. 失败重试

自动重试失败的任务：

```typescript
.addNode('api-call', task, {
  retryCount: 3,    // 最多重试 3 次
  retryDelay: 1000  // 每次间隔 1 秒
})
```

**重试策略：**
- 线性延迟：每次重试间隔固定时间
- 自动清理：重试前清理上次的副作用
- 失败记录：记录所有失败尝试的详细信息

### 5. 上下文管理

在任务间共享数据和状态：

```typescript
// 设置变量
engine.setVariable('config', { theme: 'dark' })

// 在任务中访问
const executor: TaskExecutor = {
  execute: async (task, context) => {
    const config = context.variables.config
    // 使用配置...
    
    // 存储结果供后续任务使用
    context.results.set('task-1', result)
  }
}
```

## 架构设计

### 核心类

#### WorkflowEngine

主引擎类，负责：
- 解析依赖图
- 调度任务执行
- 管理并发
- 处理错误和重试

```typescript
class WorkflowEngine {
  constructor(
    workflow: Workflow,
    executor: TaskExecutor,
    options?: { maxConcurrency?: number }
  )
  
  async run(): Promise<WorkflowResult>
  setVariable(key: string, value: any): void
  getVariable(key: string): any
}
```

#### WorkflowBuilder

流畅 API 构建器：

```typescript
class WorkflowBuilder {
  addNode(id: string, task: Task, options?: Partial<WorkflowNode>): WorkflowBuilder
  setStartNode(nodeId: string): WorkflowBuilder
  build(name: string): Workflow
}
```

#### TaskExecutor

任务执行接口：

```typescript
interface TaskExecutor {
  execute(task: Task, context: WorkflowContext): Promise<any>
}
```

### 数据流

```
用户请求
  ↓
WorkflowBuilder.build()
  ↓
WorkflowEngine.run()
  ↓
┌─────────────────────┐
│  依赖解析           │
│  ↓                  │
│  并行调度           │
│  ↓                  │
│  条件检查           │
│  ↓                  │
│  任务执行           │
│  ↓                  │
│  结果收集           │
└─────────────────────┘
  ↓
WorkflowResult
```

## 使用示例

### 示例 1: CI/CD 流水线

```typescript
const pipeline = new WorkflowBuilder()
  // 阶段 1: 代码检查
  .addNode('lint', lintTask, { dependencies: [] })
  .addNode('test', testTask, { dependencies: ['lint'] })
  
  // 阶段 2: 构建（并行）
  .addNode('build-web', buildWebTask, { dependencies: ['test'] })
  .addNode('build-api', buildApiTask, { dependencies: ['test'] })
  .addNode('build-mobile', buildMobileTask, { 
    dependencies: ['test'],
    condition: (ctx) => ctx.variables.buildMobile === true
  })
  
  // 阶段 3: 部署
  .addNode('deploy', deployTask, { 
    dependencies: ['build-web', 'build-api', 'build-mobile'],
    condition: (ctx) => ctx.variables.branch === 'main'
  })
  .build('CI/CD Pipeline')

const engine = new WorkflowEngine(pipeline, executor, { maxConcurrency: 4 })
engine.setVariable('branch', 'main')
engine.setVariable('buildMobile', true)

const result = await engine.run()
```

### 示例 2: 数据处理流水线

```typescript
const etl = new WorkflowBuilder()
  .addNode('extract', extractTask, { 
    dependencies: [],
    retryCount: 3,
    retryDelay: 2000
  })
  .addNode('transform-1', transform1Task, { dependencies: ['extract'] })
  .addNode('transform-2', transform2Task, { dependencies: ['extract'] })
  .addNode('validate', validateTask, { 
    dependencies: ['transform-1', 'transform-2'] 
  })
  .addNode('load', loadTask, { 
    dependencies: ['validate'],
    retryCount: 5
  })
  .build('ETL Pipeline')
```

### 示例 3: 微服务编排

```typescript
const orderWorkflow = new WorkflowBuilder()
  .addNode('validate-order', validateTask, { dependencies: [] })
  .addNode('check-inventory', inventoryTask, { dependencies: ['validate-order'] })
  .addNode('reserve-items', reserveTask, { 
    dependencies: ['check-inventory'],
    retryCount: 3
  })
  .addNode('process-payment', paymentTask, { 
    dependencies: ['reserve-items'],
    retryCount: 3
  })
  .addNode('confirm-order', confirmTask, { 
    dependencies: ['process-payment'] 
  })
  .addNode('rollback-reservation', rollbackTask, { 
    dependencies: ['reserve-items'],
    condition: (ctx) => ctx.errors.has('process-payment')
  })
  .build('订单处理流程')
```

## 性能优化

### 1. 并发控制

- 默认最大并发数：8
- 可根据系统资源调整
- 过高的并发可能导致资源竞争

### 2. 内存管理

- 执行完成后清理中间结果
- 大型工作流考虑分批执行
- 使用流式处理大数据集

### 3. 错误处理

- 失败节点不影响其他独立节点
- 错误信息保存在上下文中
- 可实现补偿事务（Saga 模式）

## 测试覆盖

当前测试覆盖率：**100%**

- ✅ 基础功能：2 个测试
- ✅ 并行执行：2 个测试
- ✅ 条件分支：2 个测试
- ✅ 错误处理和重试：3 个测试
- ✅ 上下文管理：2 个测试
- ✅ 复杂场景：1 个测试

**总计：12 个测试，全部通过**

## 下一步计划

### Priority 2 - 状态管理（下一个任务）

- [ ] 状态持久化（保存/恢复）
- [ ] 状态回滚（Undo/Redo）
- [ ] 状态快照
- [ ] 分布式状态同步

### Priority 2 - 插件系统

- [ ] 自定义 Agent 插件
- [ ] 任务类型扩展
- [ ] 中间件机制
- [ ] 事件钩子

## 参考资料

- [工作流模式](https://www.workflowpatterns.com/)
- [DAG 调度算法](https://en.wikipedia.org/wiki/Directed_acyclic_graph)
- [Saga 分布式事务模式](https://microservices.io/patterns/data/saga.html)

---

**创建时间:** 2026-03-21  
**版本:** 1.0.0  
**作者:** ClawCompany Team
