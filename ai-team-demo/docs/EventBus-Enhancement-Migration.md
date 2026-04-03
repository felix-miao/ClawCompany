# EventBus 增强功能迁移指南

## 概述

EventBusEnhanced 提供了比原始 EventBus 更强大的错误处理、事件验证和监控功能，同时保持完全的向后兼容性。

## 主要改进

### 1. 增强的错误处理
- **自动重试机制**: 配置的失败处理器自动重试（默认最多2次）
- **详细错误日志**: 包含错误上下文和性能指标
- **错误统计**: 跟踪错误频率和类型

### 2. 事件验证
- **必需字段验证**: 确保事件包含必需的数据
- **时间戳自动修正**: 无效时间戳自动修正为当前时间
- **类型安全**: 针对不同事件类型进行验证

### 3. 性能监控
- **处理器计数**: 跟踪每个事件类型的处理器数量
- **错误率计算**: 实时计算错误率
- **历史记录管理**: 可配置的历史记录大小限制

### 4. 配置选项
```typescript
const eventBus = new EventBusEnhanced({
  maxHistorySize: 100,           // 历史记录最大长度
  enableErrorLogging: true,      // 启用错误日志
  enableEventValidation: true,   // 启用事件验证
  maxErrorHandlerRetries: 2      // 失败处理器最大重试次数
});
```

## 迁移步骤

### 1. 直接替换
由于 EventBusEnhanced 完全兼容原始 EventBus 的 API，可以直接替换：

```typescript
// 原始方式
import { EventBus } from './EventBus';

// 新方式
import { EventBusEnhanced } from './EventBusEnhanced';

// 直接替换，API完全兼容
const eventBus = new EventBusEnhanced();
```

### 2. 启用增强功能
```typescript
// 启用所有增强功能
const eventBus = new EventBusEnhanced({
  enableErrorLogging: true,
  enableEventValidation: true,
  maxErrorHandlerRetries: 3
});
```

### 3. 使用新的监控功能
```typescript
// 获取性能指标
const metrics = eventBus.getPerformanceMetrics();
console.log('错误率:', metrics.errorRate);
console.log('处理器数量:', metrics.handlerCounts);

// 获取错误统计
const errorStats = eventBus.getErrorStats();
console.log('总错误数:', errorStats.totalErrors);
console.log('错误类型分布:', errorStats.errorsByType);
```

## 使用示例

### 基本使用（与原始 EventBus 相同）
```typescript
const eventBus = new EventBusEnhanced();

// 注册处理器
eventBus.on('agent:status-change', (event) => {
  console.log('Agent status changed:', event);
});

// 发送事件
eventBus.emit({
  type: 'agent:status-change',
  timestamp: Date.now(),
  agentId: 'agent-1'
});
```

### 带验证的事件发送
```typescript
const eventBus = new EventBusEnhanced({
  enableEventValidation: true
});

// 无效事件会被拒绝
const invalidEvent = {
  type: 'agent:status-change',
  timestamp: Date.now()
  // 缺少必需的 agentId
};

eventBus.emit(invalidEvent); // 会被验证失败并记录错误

// 有效事件会正常处理
const validEvent = {
  type: 'agent:status-change',
  timestamp: Date.now(),
  agentId: 'agent-1'
};

eventBus.emit(validEvent); // 正常处理
```

### 错误处理和重试
```typescript
const eventBus = new EventBusEnhanced({
  maxErrorHandlerRetries: 3
});

eventBus.on('agent:status-change', (event) => {
  // 这个处理器如果失败，会自动重试最多3次
  if (Math.random() > 0.5) {
    throw new Error('Random failure');
  }
  console.log('Success:', event);
});
```

## 测试

运行增强功能的测试：

```bash
npm test -- --testPathPatterns="EventBusEnhanced.test.ts"
```

## 向后兼容性

- ✅ 完全兼容原始 EventBus 的所有 API
- ✅ 无需修改现有的事件处理器
- ✅ 现有的事件类型和结构无需改变
- ✅ 可以逐步启用新功能

## 性能考虑

- 历史记录管理防止内存泄漏
- 错误统计有上限，避免无限增长
- 可配置的重试策略平衡可靠性和性能
- 验证功能可以禁用以获得最大性能