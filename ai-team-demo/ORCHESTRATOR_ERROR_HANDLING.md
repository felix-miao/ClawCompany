# Orchestrator 错误处理和重试机制

## 实现概述

为 ClawCompany 项目的 Orchestrator 实现了完善的错误处理和重试机制，采用 TDD（测试驱动开发）方式。

## 实现的功能

### 1. 重试机制（指数退避）

- **最多重试次数**: 3次（可配置）
- **退避策略**: 指数退避
  - 初始延迟: 1秒
  - 最大延迟: 10秒
  - 退避倍数: 2
  - 延迟序列: 1s → 2s → 4s → ...

**示例**:
```typescript
const orchestrator = new Orchestrator('project-id', {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
})
```

### 2. 部分任务失败处理

- 当某个任务失败时，继续执行其他任务
- 记录失败的任务信息
- 返回详细的执行统计

**行为**:
- PM 任务失败: 立即返回错误，不执行后续任务
- Dev 任务失败: 记录错误，继续执行其他 Dev 任务
- Review 任务失败: 记录错误，继续执行其他任务

### 3. 错误日志和监控

#### 日志输出
- 重试警告: `[Orchestrator] Retry X/3 for {role} agent after {delay}ms: {error}`
- 失败错误: `[Orchestrator] All 3 retries failed for {role} agent: {error}`
- 文件保存错误: `[Orchestrator] Failed to save file {path}: {error}`
- 文件保存成功: `[Orchestrator] Saved file: {path}`

#### 统计信息
```typescript
interface WorkflowStats {
  totalTasks: number        // 总任务数
  successfulTasks: number   // 成功任务数
  failedTasks: number       // 失败任务数
  totalRetries: number      // 总重试次数
  executionTime: number     // 执行时间（毫秒）
}
```

### 4. 错误信息

#### WorkflowResult 接口
```typescript
interface WorkflowResult {
  success: boolean           // 是否成功（至少一个任务成功）
  messages: Message[]        // 聊天历史
  tasks: Task[]             // 所有任务
  files?: File[]            // 生成的文件
  error?: WorkflowError     // 全局错误
  failedTasks?: FailedTask[] // 失败的任务列表
  stats?: WorkflowStats     // 执行统计
}

interface FailedTask {
  taskId: string            // 任务ID
  taskTitle: string         // 任务标题
  error: string             // 错误信息
  retryCount: number        // 重试次数
  timestamp: Date           // 失败时间
}

interface WorkflowError {
  message: string           // 错误消息
  code?: string             // 错误代码
  task?: string             // 相关任务ID
  timestamp: Date           // 错误时间
  retryCount?: number       // 重试次数
}
```

## 测试覆盖

### 测试文件
- `src/lib/orchestrator/__tests__/orchestrator.test.ts`

### 测试场景

#### 重试机制（3个测试）
- ✅ 应该在Agent执行失败时自动重试（最多3次）
- ✅ 应该在重试3次后仍然失败时返回错误
- ✅ 应该使用指数退避策略进行重试

#### 部分任务失败处理（2个测试）
- ✅ 应该在部分任务失败时继续执行其他任务
- ✅ 应该记录失败的任务及其错误信息

#### 错误日志和监控（3个测试）
- ✅ 应该记录所有错误到日志
- ✅ 应该记录重试次数和原因
- ✅ 应该返回详细的执行统计信息

#### 文件操作错误处理（1个测试）
- ✅ 应该在文件创建失败时记录错误但继续执行

#### 超时处理（1个测试）
- ✅ 应该在Agent执行超时时触发重试

### 测试结果
```
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

## 向后兼容性

- ✅ 所有原有测试通过（283个测试）
- ✅ 接口向后兼容
- ✅ 默认行为保持不变

## 使用示例

### 基本使用
```typescript
import { Orchestrator } from '@/lib/orchestrator'

const orchestrator = new Orchestrator('my-project')
const result = await orchestrator.executeUserRequest('实现用户登录功能')

if (result.success) {
  console.log('任务执行成功')
  console.log(`成功: ${result.stats?.successfulTasks}/${result.stats?.totalTasks}`)
} else {
  console.log('任务执行失败')
  console.log(`失败任务: ${result.failedTasks?.map(t => t.taskTitle).join(', ')}`)
}
```

### 自定义重试配置
```typescript
const orchestrator = new Orchestrator('my-project', {
  maxRetries: 5,           // 最多重试5次
  initialDelay: 2000,      // 初始延迟2秒
  maxDelay: 30000,         // 最大延迟30秒
  backoffMultiplier: 3     // 退避倍数3
})
```

### 错误处理
```typescript
const result = await orchestrator.executeUserRequest('实现功能')

if (result.error) {
  // 全局错误（PM任务失败）
  console.error('全局错误:', result.error.message)
}

if (result.failedTasks && result.failedTasks.length > 0) {
  // 部分任务失败
  result.failedTasks.forEach(task => {
    console.error(`任务 ${task.taskTitle} 失败: ${task.error}`)
  })
}
```

## 技术细节

### 重试逻辑
```typescript
async executeAgentWithRetry(role: AgentRole, task: Task) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this.executeAgent(role, task)
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        )
        await this.sleep(delay)
      }
    }
  }
  return null // 所有重试都失败
}
```

### 成功判断逻辑
```typescript
// PM成功但没有子任务，或者至少有一个子任务成功
const hasSuccess = subTaskIds.length === 0 || failedTasks.length < subTaskIds.length
return { success: hasSuccess, ... }
```

## 性能考虑

- 重试会导致执行时间增加
- 指数退避避免了立即重试造成的资源浪费
- 最大延迟限制避免了过长的等待时间

## 未来改进

- [ ] 支持任务依赖关系的智能重试
- [ ] 添加断路器模式（Circuit Breaker）
- [ ] 支持自定义重试条件
- [ ] 添加重试指标上报
- [ ] 支持任务优先级和取消
